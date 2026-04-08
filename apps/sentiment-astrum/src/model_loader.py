import os
from functools import lru_cache

from transformers import pipeline


def get_model_dir() -> str | None:
    env_dir = os.environ.get("SENTIMENT_MODEL_DIR")
    if env_dir and os.path.exists(env_dir):
        return env_dir
    repo_relative = os.path.join("apps", "sentiment-astrum", "model")
    if os.path.exists(repo_relative):
        return repo_relative
    return None


@lru_cache(maxsize=1)
def get_predictor():
    model_dir = get_model_dir()
    if model_dir:
        return pipeline("text-classification", model=model_dir, tokenizer=model_dir)
    return pipeline("sentiment-analysis")

