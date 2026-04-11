import os
from pathlib import Path

try:
    from bootstrap import ensure_project_root_on_path
except ModuleNotFoundError:
    from scripts.bootstrap import ensure_project_root_on_path

ensure_project_root_on_path()

import numpy as np
from datasets import load_dataset
from joblib import load
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score

from src.model_paths import MODEL_ARTIFACT_PATH


def main() -> None:
    model_dir = Path(os.environ.get("SENTIMENT_MODEL_DIR") or MODEL_ARTIFACT_PATH.parent)
    model_path = model_dir / MODEL_ARTIFACT_PATH.name

    if not model_path.exists():
        raise RuntimeError(f"Model artifact not found: {model_path}")

    dataset = load_dataset("amazon_polarity")
    pipeline = load(model_path)

    eval_samples = int(os.environ.get("SENTIMENT_EVAL_SAMPLES", "5000"))
    split_df = pd.DataFrame(
        dataset["test"].shuffle(seed=42).select(range(eval_samples))
    )[["content", "label"]]
    labels = np.array(split_df["label"])
    preds = pipeline.predict(split_df["content"])

    accuracy = float(accuracy_score(labels, preds))
    f1 = float(f1_score(labels, preds, average="macro"))
    print({"accuracy": accuracy, "f1_macro": f1})


if __name__ == "__main__":
    main()
