import os

import numpy as np
from datasets import load_dataset
from sklearn.metrics import accuracy_score, f1_score
from transformers import AutoModelForSequenceClassification, AutoTokenizer


def main() -> None:
    model_dir = os.environ.get(
        "SENTIMENT_MODEL_DIR",
        os.path.join("apps", "sentiment-astrum", "model"),
    )

    if not os.path.exists(model_dir):
        raise RuntimeError(f"Model dir not found: {model_dir}")

    dataset = load_dataset("amazon_polarity")
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()

    eval_samples = int(os.environ.get("SENTIMENT_EVAL_SAMPLES", "5000"))
    max_length = int(os.environ.get("SENTIMENT_MAX_LENGTH", "256"))

    split = dataset["test"].shuffle(seed=42).select(range(eval_samples))
    texts = split["content"]
    labels = np.array(split["label"])

    batch_size = int(os.environ.get("SENTIMENT_EVAL_BATCH", "32"))
    preds: list[int] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        encoded = tokenizer(
            batch,
            truncation=True,
            padding=True,
            max_length=max_length,
            return_tensors="pt",
        )
        with torch.no_grad():
            out = model(**encoded)
        batch_preds = out.logits.argmax(dim=-1).cpu().numpy().tolist()
        preds.extend(batch_preds)

    accuracy = float(accuracy_score(labels, preds))
    f1 = float(f1_score(labels, preds, average="macro"))
    print({"accuracy": accuracy, "f1_macro": f1})


if __name__ == "__main__":
    import torch

    main()

