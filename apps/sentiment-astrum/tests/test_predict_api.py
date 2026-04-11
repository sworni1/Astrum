from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from src.app import app
from src.model_loader import PredictorNotReadyError


class FakePredictor:
    def __call__(self, text: str) -> dict[str, float | str]:
        lowered = text.lower()
        if "terrible" in lowered or "worst" in lowered:
            return {"label": "NEGATIVE", "score": 0.91}
        return {"label": "POSITIVE", "score": 0.87}


@patch("src.app.get_predictor", return_value=FakePredictor())
@patch(
    "src.app.translate_ru_to_en",
    return_value="This product is amazing",
)
def test_predict_russian_text_uses_translation(
    mock_translate: MagicMock,
    mock_get_predictor: MagicMock,
) -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "Очень хороший товар"})
    assert response.status_code == 200
    mock_translate.assert_called_once_with("Очень хороший товар")
    mock_get_predictor.assert_called_once_with()
    payload = response.json()
    assert payload["label"] == "POSITIVE"
    assert payload["meta"]["detectedLanguage"] == "ru"
    assert payload["score"] == 0.87


@patch("src.app.get_predictor", return_value=FakePredictor())
@patch(
    "src.app.translate_ru_to_en",
    return_value="Terrible quality, worst purchase ever",
)
def test_predict_russian_negative_after_translation(
    mock_translate: MagicMock,
    mock_get_predictor: MagicMock,
) -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "Ужасное качество, зря купил"})
    assert response.status_code == 200
    mock_translate.assert_called_once()
    mock_get_predictor.assert_called_once_with()
    payload = response.json()
    assert payload["label"] == "NEGATIVE"
    assert payload["meta"]["detectedLanguage"] == "ru"
    assert payload["score"] == 0.91


@patch("src.app.get_predictor", return_value=FakePredictor())
@patch("src.app.translate_ru_to_en")
def test_predict_english_text_skips_translation(
    mock_translate: MagicMock,
    mock_get_predictor: MagicMock,
) -> None:
    client = TestClient(app)
    response = client.post("/predict", json={"text": "This product is amazing"})
    assert response.status_code == 200
    mock_translate.assert_not_called()
    mock_get_predictor.assert_called_once_with()
    payload = response.json()
    assert payload["label"] == "POSITIVE"
    assert payload["meta"]["detectedLanguage"] == "en"
    assert payload["score"] == 0.87


@patch("src.app.get_predictor", side_effect=PredictorNotReadyError("model not trained"))
def test_health_reports_model_unavailable(mock_get_predictor: MagicMock) -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json() == {"ok": False, "reason": "model not trained"}
    mock_get_predictor.assert_called_once_with()
