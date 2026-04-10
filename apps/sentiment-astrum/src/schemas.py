from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    text: str = Field(min_length=1)


class PredictMeta(BaseModel):
    detectedLanguage: str
    translate_error: str | None = None


class PredictResponse(BaseModel):
    label: str
    score: float
    meta: PredictMeta

