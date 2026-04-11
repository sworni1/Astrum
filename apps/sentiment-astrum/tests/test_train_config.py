import os

from scripts.train import get_training_config


def test_training_config_defaults_to_full_training(monkeypatch) -> None:
    monkeypatch.delenv("SENTIMENT_QUICK_TRAIN", raising=False)
    monkeypatch.delenv("SENTIMENT_TRAIN_SAMPLES", raising=False)
    monkeypatch.delenv("SENTIMENT_EVAL_SAMPLES", raising=False)
    monkeypatch.delenv("SENTIMENT_MAX_FEATURES", raising=False)
    monkeypatch.delenv("SENTIMENT_MAX_ITER", raising=False)

    config = get_training_config()

    assert config.train_samples == 10000
    assert config.eval_samples == 2000
    assert config.max_features == 20000
    assert config.max_iter == 200


def test_training_config_uses_quick_mode_presets(monkeypatch) -> None:
    monkeypatch.setenv("SENTIMENT_QUICK_TRAIN", "1")
    monkeypatch.delenv("SENTIMENT_TRAIN_SAMPLES", raising=False)
    monkeypatch.delenv("SENTIMENT_EVAL_SAMPLES", raising=False)
    monkeypatch.delenv("SENTIMENT_MAX_FEATURES", raising=False)
    monkeypatch.delenv("SENTIMENT_MAX_ITER", raising=False)

    config = get_training_config()

    assert config.train_samples == 1000
    assert config.eval_samples == 200
    assert config.max_features == 5000
    assert config.max_iter == 100


def test_training_config_allows_overrides_in_quick_mode(monkeypatch) -> None:
    monkeypatch.setenv("SENTIMENT_QUICK_TRAIN", "1")
    monkeypatch.setenv("SENTIMENT_TRAIN_SAMPLES", "321")
    monkeypatch.setenv("SENTIMENT_EVAL_SAMPLES", "123")
    monkeypatch.setenv("SENTIMENT_MAX_FEATURES", "777")
    monkeypatch.setenv("SENTIMENT_MAX_ITER", "55")

    config = get_training_config()

    assert config.train_samples == 321
    assert config.eval_samples == 123
    assert config.max_features == 777
    assert config.max_iter == 55
