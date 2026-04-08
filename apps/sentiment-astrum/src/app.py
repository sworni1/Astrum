from fastapi import FastAPI

from src.lang_detect import detect_language
from src.model_loader import get_predictor
from src.schemas import PredictRequest, PredictResponse, PredictMeta

app = FastAPI()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    detected_language = detect_language(body.text)
    if detected_language == "ru":
        return PredictResponse(
            label="UNKNOWN",
            score=0.0,
            meta=PredictMeta(detectedLanguage="ru"),
        )
    predictor = get_predictor()
    result = predictor(body.text, truncation=True)[0]
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

