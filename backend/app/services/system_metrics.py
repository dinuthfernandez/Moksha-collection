"""CPU / RAM metrics that are correct both on a dev machine and inside a
container (Render), where psutil would otherwise report the whole host."""
import os
import threading
import time
from pathlib import Path

import psutil

_CG = Path("/sys/fs/cgroup")
_lock = threading.Lock()
_process = psutil.Process()
_last: dict = {"t": 0.0, "usage": 0.0, "cpu": 0.0, "proc_cpu": 0.0}

_process.cpu_percent(None)


def _read(path: Path) -> str | None:
    try:
        return path.read_text().strip()
    except OSError:
        return None


def _cgroup_memory() -> tuple[int, int] | None:
    """Return (used_bytes, limit_bytes) for the container, or None."""
    current = _read(_CG / "memory.current")
    if current is not None:  # cgroup v2
        limit_raw = _read(_CG / "memory.max")
        used = int(current)
        stat = _read(_CG / "memory.stat") or ""
        for line in stat.splitlines():
            if line.startswith("inactive_file "):
                used = max(used - int(line.split()[1]), 0)
        limit = int(limit_raw) if limit_raw and limit_raw != "max" else psutil.virtual_memory().total
        return used, min(limit, psutil.virtual_memory().total)
    usage = _read(_CG / "memory" / "memory.usage_in_bytes")  # cgroup v1
    if usage is not None:
        limit = int(_read(_CG / "memory" / "memory.limit_in_bytes") or 0)
        total = psutil.virtual_memory().total
        return int(usage), limit if 0 < limit < total else total
    return None


def _cgroup_cpu() -> tuple[float, float] | None:
    """Return (cumulative_cpu_seconds, cpu_limit_in_cores), or None."""
    cores = float(os.cpu_count() or 1)
    stat = _read(_CG / "cpu.stat")
    if stat is not None:  # cgroup v2
        usage = next((int(l.split()[1]) for l in stat.splitlines() if l.startswith("usage_usec")), None)
        if usage is None:
            return None
        parts = (_read(_CG / "cpu.max") or "max").split()
        if parts[0] != "max" and len(parts) == 2 and int(parts[1]) > 0:
            cores = min(cores, int(parts[0]) / int(parts[1]))
        return usage / 1e6, cores
    usage = _read(_CG / "cpuacct" / "cpuacct.usage")  # cgroup v1
    if usage is None:
        usage = _read(_CG / "cpu,cpuacct" / "cpuacct.usage")
    if usage is not None:
        quota = int(_read(_CG / "cpu" / "cpu.cfs_quota_us") or -1)
        period = int(_read(_CG / "cpu" / "cpu.cfs_period_us") or 0)
        if quota > 0 and period > 0:
            cores = min(cores, quota / period)
        return int(usage) / 1e9, cores
    return None


def snapshot() -> dict:
    now = time.time()
    cg_cpu = _cgroup_cpu()
    with _lock:
        elapsed = now - _last["t"]
        if _last["t"] and elapsed < 0.5:
            cpu, proc_cpu = _last["cpu"], _last["proc_cpu"]
        else:
            if cg_cpu:
                usage, cores = cg_cpu
                if _last["t"] and _last["usage"]:
                    cpu = max((usage - _last["usage"]) / elapsed / cores * 100, 0.0)
                else:
                    cpu = psutil.cpu_percent(None)
                _last["usage"] = usage
            else:
                cpu = psutil.cpu_percent(None)
            proc_cpu = _process.cpu_percent(None) / (os.cpu_count() or 1)
            _last.update(t=now, cpu=cpu, proc_cpu=proc_cpu)

    mem = _cgroup_memory()
    source = "container"
    if mem is None:
        vm = psutil.virtual_memory()
        mem, source = (vm.total - vm.available, vm.total), "host"
    used, total = mem
    return {
        "timestamp": now,
        "source": source,
        "cpu_percent": round(min(cpu, 100.0), 1),
        "cpu_cores": round(cg_cpu[1], 2) if cg_cpu else os.cpu_count(),
        "memory_percent": round(used / total * 100, 1) if total else 0.0,
        "memory_used_mb": round(used / 1048576, 1),
        "memory_total_mb": round(total / 1048576, 1),
        "process_cpu_percent": round(min(proc_cpu, 100.0), 1),
        "process_memory_mb": round(_process.memory_info().rss / 1048576, 1),
    }
