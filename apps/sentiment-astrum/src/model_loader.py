import os
import threading
from pathlib import Path

import joblib

from src.model_paths import MODEL_ARTIFACT_PATH

_predictor_lock = threading.Lock()
_predictor = None


class PredictorNotReadyError(RuntimeError):
    pass


class SklearnSentimentPredictor:
    def __init__(self, artifact_path: Path):
        self._pipeline = joblib.load(artifact_path)

    def __call__(self, text: str) -> dict[str, float | str]:
        probabilities = self._pipeline.predict_proba([text])[0]
        classes = self._pipeline.classes_
        best_index = max(range(len(probabilities)), key=probabilities.__getitem__)
        label_id = int(classes[best_index])
        label = "POSITIVE" if label_id == 1 else "NEGATIVE"
        score = float(probabilities[best_index])
        return {"label": label, "score": score}


def get_model_artifact_path() -> Path:
    env_dir = os.environ.get("SENTIMENT_MODEL_DIR", "").strip()
    if env_dir:
        return Path(env_dir).expanduser().resolve() / MODEL_ARTIFACT_PATH.name
    return MODEL_ARTIFACT_PATH


def get_predictor() -> SklearnSentimentPredictor:
    global _predictor
    if _predictor is not None:
        return _predictor
    with _predictor_lock:
        if _predictor is not None:
            return _predictor
        artifact_path = get_model_artifact_path()
        if not artifact_path.exists():
            raise PredictorNotReadyError(f"trained model not found: {artifact_path}")
        _predictor = SklearnSentimentPredictor(artifact_path)
        return _predictor


def warmup_predictor() -> None:
    get_predictor()
