from pathlib import Path


SERVICE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_DIR = SERVICE_ROOT / "model"
MODEL_ARTIFACT_PATH = DEFAULT_MODEL_DIR / "sentiment_model.joblib"
