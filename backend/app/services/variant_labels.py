def display_size(size: str | None, kids_size: str | None) -> str | None:
    """Size label for display: kids items show their age range, e.g. "Kids 2-3 Yrs"."""
    if kids_size:
        return f"Kids {kids_size} Yrs"
    return size
