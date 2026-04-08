from fastapi.testclient import TestClient

from src.app import app


def test_predict_returns_unknown_for_russian_text() -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "Очень хороший товар"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["label"] == "UNKNOWN"
    assert payload["meta"]["detectedLanguage"] == "ru"


def test_predict_returns_positive_or_negative_for_english_text() -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "This product is amazing"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["label"] in {"POSITIVE", "NEGATIVE", "UNKNOWN"}
    assert 0.0 <= float(payload["score"]) <= 1.0

