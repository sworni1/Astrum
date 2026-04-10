from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.app import app


@patch(
    "src.app.translate_ru_to_en",
    return_value="This product is amazing",
)
def test_predict_russian_text_uses_translation(mock_translate: MagicMock) -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "Очень хороший товар"})
    assert response.status_code == 200
    mock_translate.assert_called_once_with("Очень хороший товар")
    payload = response.json()
    assert payload["label"] == "POSITIVE"
    assert payload["meta"]["detectedLanguage"] == "ru"
    assert 0.0 <= float(payload["score"]) <= 1.0


@patch(
    "src.app.translate_ru_to_en",
    return_value="Terrible quality, worst purchase ever",
)
def test_predict_russian_negative_after_translation(mock_translate: MagicMock) -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "Ужасное качество, зря купил"})
    assert response.status_code == 200
    mock_translate.assert_called_once()
    payload = response.json()
    assert payload["label"] == "NEGATIVE"
    assert payload["meta"]["detectedLanguage"] == "ru"


def test_predict_returns_positive_or_negative_for_english_text() -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "This product is amazing"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["label"] in {"POSITIVE", "NEGATIVE", "UNKNOWN"}
    assert 0.0 <= float(payload["score"]) <= 1.0
