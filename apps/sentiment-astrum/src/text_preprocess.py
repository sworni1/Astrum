import re

from nltk.stem import PorterStemmer

_TOKEN_RE = re.compile(r"[a-zA-Z']+")
_STEMMER = PorterStemmer()


def normalize_text(text: str) -> str:
    tokens = _TOKEN_RE.findall(text.lower())
    stems = [_STEMMER.stem(token) for token in tokens]
    return " ".join(stems)
