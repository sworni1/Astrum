import os
from dataclasses import dataclass

import torch
from datasets import load_dataset
from transformers import __version__ as transformers_version
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)


@dataclass(frozen=True)
class TrainingConfig:
    model_name: str
    output_dir: str
    max_length: int
    train_samples: int
    eval_samples: int
    num_train_epochs: int
    max_steps: int
    train_batch_size: int
    eval_batch_size: int
    learning_rate: float
    dataloader_pin_memory: bool


def get_training_config() -> TrainingConfig:
    return TrainingConfig(
        model_name=os.environ.get("SENTIMENT_BASE_MODEL", "distilbert-base-uncased"),
        output_dir=os.environ.get(
            "SENTIMENT_MODEL_DIR",
            os.path.join("apps", "sentiment-astrum", "model"),
        ),
        max_length=int(os.environ.get("SENTIMENT_MAX_LENGTH", "256")),
        train_samples=int(os.environ.get("SENTIMENT_TRAIN_SAMPLES", "10000")),
        eval_samples=int(os.environ.get("SENTIMENT_EVAL_SAMPLES", "2000")),
        num_train_epochs=int(os.environ.get("SENTIMENT_EPOCHS", "1")),
        max_steps=int(os.environ.get("SENTIMENT_MAX_STEPS", "0")),
        train_batch_size=int(os.environ.get("SENTIMENT_TRAIN_BATCH", "8")),
        eval_batch_size=int(os.environ.get("SENTIMENT_EVAL_BATCH", "8")),
        learning_rate=float(os.environ.get("SENTIMENT_LR", "2e-5")),
        dataloader_pin_memory=os.environ.get("SENTIMENT_PIN_MEMORY", "0") == "1",
    )


def main() -> None:
    config = get_training_config()

    dataset = load_dataset("amazon_polarity")
    tokenizer = AutoTokenizer.from_pretrained(config.model_name)

    def tokenize(batch: dict) -> dict:
        return tokenizer(
            batch["content"],
            truncation=True,
            padding="max_length",
            max_length=config.max_length,
        )

    tokenized = dataset.map(tokenize, batched=True)
    tokenized = tokenized.rename_column("label", "labels")
    tokenized.set_format(
        type="torch",
        columns=["input_ids", "attention_mask", "labels"],
    )

    model = AutoModelForSequenceClassification.from_pretrained(
        config.model_name,
        num_labels=2,
        id2label={0: "NEGATIVE", 1: "POSITIVE"},
        label2id={"NEGATIVE": 0, "POSITIVE": 1},
    )

    train_split = (
        tokenized["train"].shuffle(seed=42).select(range(config.train_samples))
    )
    eval_split = tokenized["test"].shuffle(seed=42).select(range(config.eval_samples))

    common_args = dict(
        output_dir=config.output_dir,
        save_strategy="epoch",
        num_train_epochs=config.num_train_epochs,
        per_device_train_batch_size=config.train_batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        learning_rate=config.learning_rate,
        weight_decay=0.01,
        logging_steps=50,
        report_to=[],
        fp16=torch.cuda.is_available(),
        dataloader_pin_memory=config.dataloader_pin_memory,
    )
    try:
        args = TrainingArguments(
            **common_args,
            evaluation_strategy="epoch",
        )
    except TypeError:
        args = TrainingArguments(
            **common_args,
            eval_strategy="epoch",
        )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_split,
        eval_dataset=eval_split,
        tokenizer=tokenizer,
    )
    trainer.train()
    trainer.save_model(config.output_dir)
    tokenizer.save_pretrained(config.output_dir)
    print(
        {
            "transformers": transformers_version,
            "model_dir": config.output_dir,
        }
    )


if __name__ == "__main__":
    main()

