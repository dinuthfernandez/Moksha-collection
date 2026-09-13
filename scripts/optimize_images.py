"""One-off dev script: shrink the huge source DSLR photos (5504x8256, ~0.5MB
each but 45-megapixel) down to sane web dimensions, in-place, emit a WebP
sibling, and bake a tiny pre-blurred placeholder (so the UI never needs a
live CSS blur() filter on a full-size image — cheaper and glitch-free).
Run manually when new photos are added — not part of the app runtime.
"""
from pathlib import Path
from PIL import Image, ImageFilter

HERO_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "assets" / "hero"
MAX_LONG_EDGE = 1800
JPEG_QUALITY = 82
WEBP_QUALITY = 78
BLUR_PLACEHOLDER_WIDTH = 48


def optimize(path: Path) -> None:
    with Image.open(path) as img:
        img = img.convert("RGB")
        w, h = img.size
        long_edge = max(w, h)
        if long_edge > MAX_LONG_EDGE:
            scale = MAX_LONG_EDGE / long_edge
            img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)

        img.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        img.save(path.with_suffix(".webp"), "WEBP", quality=WEBP_QUALITY)

        # Tiny pre-blurred placeholder used as the "full image, no crop" backdrop.
        bw = BLUR_PLACEHOLDER_WIDTH
        bh = round(bw * img.size[1] / img.size[0])
        placeholder = img.resize((bw, bh), Image.BILINEAR).filter(ImageFilter.GaussianBlur(radius=4))
        placeholder = placeholder.point(lambda p: int(p * 0.55))  # darken to match the onyx theme
        blur_path = path.parent / f"{path.stem.split('.')[0]}.blur.jpg"
        placeholder.save(blur_path, "JPEG", quality=60)

        print(f"{path.name}: -> {img.size[0]}x{img.size[1]}, {path.stat().st_size / 1024:.0f} KB (+ blur placeholder)")


if __name__ == "__main__":
    sources = [f for f in HERO_DIR.glob("*.jpeg") if ".blur." not in f.name]
    sources += [f for f in HERO_DIR.glob("*.jpg") if ".blur." not in f.name]
    for file in sorted(sources):
        optimize(file)


