import re


_CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
_LATIN_RE = re.compile(r"[A-Za-z]")


def detect_language(text: str) -> str:
    if _CYRILLIC_RE.search(text):
        return "ru"
    if _LATIN_RE.search(text):
        return "en"
    return "unknown"

