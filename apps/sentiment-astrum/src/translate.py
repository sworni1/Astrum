import os
from urllib.parse import urlparse, urlunparse

import httpx


class TranslationUpstreamError(RuntimeError):
    pass


def _normalize_translate_base_url(url: str) -> str:
    stripped = url.strip()
    parsed = urlparse(stripped)
    host = (parsed.hostname or "").lower()
    if host == "0.0.0.0" or host in ("::",):
        port = parsed.port
        netloc = f"127.0.0.1:{port}" if port else "127.0.0.1"
        parsed = parsed._replace(netloc=netloc)
        stripped = urlunparse(parsed)
    return stripped.rstrip("/")


def get_translate_base_url() -> str:
    raw = os.environ.get("TRANSLATE_SERVICE_URL", "").strip().rstrip("/")
    if not raw:
        raw = "http://127.0.0.1:3313"
    return _normalize_translate_base_url(raw)


def translate_ru_to_en(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return text
    base = get_translate_base_url()
    pair = (os.environ.get("TRANSLATE_LANG_PAIR") or "ru-en").strip() or "ru-en"
    service = (os.environ.get("TRANSLATE_PROVIDER") or "msedge").strip() or "msedge"
    timeout = float(os.environ.get("TRANSLATE_HTTP_TIMEOUT_SEC") or "30")
    url = f"{base}/v2/translate/"
    payload = {"text": stripped, "lang": pair, "service": service}
    try:
        with httpx.Client(timeout=timeout, trust_env=False) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise TranslationUpstreamError(str(exc)) from exc
    translations = data.get("translations")
    if not translations or not isinstance(translations, list):
        raise TranslationUpstreamError("unexpected translate response shape")
    first = str(translations[0]).strip()
    if not first:
        raise TranslationUpstreamError("empty translation")
    return first
