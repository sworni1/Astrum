import os
from dataclasses import dataclass
from pathlib import Path

try:
    from bootstrap import ensure_project_root_on_path
except ModuleNotFoundError:
    from scripts.bootstrap import ensure_project_root_on_path

ensure_project_root_on_path()

from datasets import load_dataset
from joblib import dump
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import Pipeline

from src.model_paths import MODEL_ARTIFACT_PATH
from src.text_preprocess import normalize_text


@dataclass(frozen=True)
class TrainingConfig:
    output_dir: Path
    train_samples: int
    eval_samples: int
    max_features: int
    ngram_max: int
    max_iter: int


def _is_quick_train_enabled() -> bool:
    value = os.environ.get("SENTIMENT_QUICK_TRAIN", "").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, str(default)))


def get_training_config() -> TrainingConfig:
    quick_train = _is_quick_train_enabled()
    default_train_samples = 1000 if quick_train else 10000
    default_eval_samples = 200 if quick_train else 2000
    default_max_features = 5000 if quick_train else 20000
    default_max_iter = 100 if quick_train else 200

    return TrainingConfig(
        output_dir=Path(os.environ.get("SENTIMENT_MODEL_DIR") or MODEL_ARTIFACT_PATH.parent),
        train_samples=_env_int("SENTIMENT_TRAIN_SAMPLES", default_train_samples),
        eval_samples=_env_int("SENTIMENT_EVAL_SAMPLES", default_eval_samples),
        max_features=_env_int("SENTIMENT_MAX_FEATURES", default_max_features),
        ngram_max=_env_int("SENTIMENT_NGRAM_MAX", 2),
        max_iter=_env_int("SENTIMENT_MAX_ITER", default_max_iter),
    )


def main() -> None:
    config = get_training_config()

    dataset = load_dataset("amazon_polarity")
    train_df = pd.DataFrame(
        dataset["train"].shuffle(seed=42).select(range(config.train_samples))
    )[["content", "label"]]
    eval_df = pd.DataFrame(
        dataset["test"].shuffle(seed=42).select(range(config.eval_samples))
    )[["content", "label"]]

    pipeline = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    preprocessor=normalize_text,
                    ngram_range=(1, config.ngram_max),
                    max_features=config.max_features,
                ),
            ),
            ("classifier", LogisticRegression(max_iter=config.max_iter)),
        ]
    )

    pipeline.fit(train_df["content"], train_df["label"])
    predictions = pipeline.predict(eval_df["content"])
    accuracy = float(accuracy_score(eval_df["label"], predictions))
    f1 = float(f1_score(eval_df["label"], predictions, average="macro"))

    config.output_dir.mkdir(parents=True, exist_ok=True)
    dump(pipeline, config.output_dir / MODEL_ARTIFACT_PATH.name)
    print(
        {
            "model_dir": str(config.output_dir),
            "accuracy": accuracy,
            "f1_macro": f1,
        }
    )


if __name__ == "__main__":
    main()
