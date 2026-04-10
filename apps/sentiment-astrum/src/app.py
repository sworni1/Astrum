from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from src.lang_detect import detect_language
from src.model_loader import get_predictor, warmup_predictor
from src.schemas import PredictRequest, PredictResponse, PredictMeta
from src.translate import TranslationUpstreamError, translate_ru_to_en


def _should_warmup_models() -> bool:
    v = os.environ.get("SENTIMENT_SKIP_WARMUP", "").strip().lower()
    return v not in ("1", "true", "yes", "on")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if _should_warmup_models():
        warmup_predictor()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    detected_language = detect_language(body.text)
    try:
        text_for_sentiment = (
            translate_ru_to_en(body.text) if detected_language == "ru" else body.text
        )
    except TranslationUpstreamError as exc:
        return PredictResponse(
            label="UNKNOWN",
            score=0.0,
            meta=PredictMeta(
                detectedLanguage=detected_language,
                translate_error=str(exc)[:500],
            ),
        )
    predictor = get_predictor()
    result = predictor(text_for_sentiment, truncation=True)[0]
    label_raw = str(result.get("label", "")).upper()
    score = float(result.get("score", 0.0))
    if "NEG" in label_raw:
        label = "NEGATIVE"
    elif "POS" in label_raw:
        label = "POSITIVE"
    else:
        label = "UNKNOWN"
    return PredictResponse(
        label=label,
        score=score,
        meta=PredictMeta(detectedLanguage=detected_language),
    )
