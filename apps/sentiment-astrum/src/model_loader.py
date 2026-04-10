import os
import threading

from transformers import pipeline

_predictor_lock = threading.Lock()
_predictor = None


def get_model_dir() -> str | None:
    env_dir = os.environ.get("SENTIMENT_MODEL_DIR")
    if env_dir and os.path.exists(env_dir):
        return env_dir
    repo_relative = os.path.join("apps", "sentiment-astrum", "model")
    if os.path.exists(repo_relative):
        return repo_relative
    return None


def get_predictor():
    global _predictor
    if _predictor is not None:
        return _predictor
    with _predictor_lock:
        if _predictor is not None:
            return _predictor
        model_dir = get_model_dir()
        if model_dir:
            _predictor = pipeline(
                "text-classification",
                model=model_dir,
                tokenizer=model_dir,
                model_kwargs={"low_cpu_mem_usage": False},
            )
        else:
            _predictor = pipeline(
                "sentiment-analysis",
                model_kwargs={"low_cpu_mem_usage": False},
            )
        return _predictor


def warmup_predictor() -> None:
    get_predictor()
