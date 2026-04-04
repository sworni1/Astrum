# Architecture — Система отзывов товаров

**Project:** Astrum Reviews + ML Sentiment Analysis
**Mode:** Architecture dimension
**Confidence:** HIGH

## Component Boundaries

| Компонент | Ответственность | Где размещён |
|-----------|----------------|-------------|
| Review Module | CRUD отзывов, проверка покупки | `api-astrum/src/reviews/` |
| Moderation Module | State machine PENDING → APPROVED/REJECTED | `api-astrum/src/reviews/moderation.*` |
| Photo Module | Загрузка/хранение фото отзывов | `api-astrum/src/reviews/photo.*` |
| Reply Module | Ответы продавца на отзывы | `api-astrum/src/reviews/reply.*` |
| ML Client | Отправка на ML-анализ, фоллбэк заглушка | `api-astrum/src/reviews/ml-client.service.ts` |
| ML Service | Python FastAPI: POST /sentiment | `services/ml-astrum/` (новый воркспейс) |

## Data Flow: Submission → ML → Moderation → Publication

**Ключевое решение: Async ML, не блокирует создание отзыва.**

```
User POST /api/reviews
  → verify purchased (OrderItem exists + DELIVERED)
  → create Review (status = PENDING_MODERATION)
  → fire-and-forget ML analysis
  → return 201 Created

ML service (async)
  → analyze text → UPDATE review SET sentiment, sentimentScore

Moderator
  → GET pending reviews → approve/reject
  → if APPROVED: recalculate Product.aggregate (stars, reviewCount)
  → review visible on product page
```

**Почему async, не sync:**
- Python ML-сервис — внешний процесс
- Синхронный вызов: 200-2000ms latency + точка отказа
- При async: отзыв проходит модерацию даже при сбое ML

## Database Schema Pattern

**Критически важно: `Review → OrderItem`, а не `Review → Product`.**

Это гарантирует, что пользователь действительно покупал этот конкретный товар.

**Ключевые поля:**
```prisma
enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ReviewSentiment {
  NOT_ANALYZED
  POSITIVE
  NEGATIVE
  NEUTRAL
}

model Review {
  id              String    @id @default(uuid())
  orderItemId     String    // связь с заказом, НЕ с Product
  userId          String
  productId       String    // денормализация для удобства запросов
  rating          Int
  qualityRating   Int
  deliveryRating  Int
  accuracyRating  Int
  text            String
  status          ReviewStatus @default(PENDING)
  sentiment       ReviewSentiment @default(NOT_ANALYZED)
  sentimentScore  Float?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**Кэшированные агрегаты на Product:**
- `reviewCount` — Int
- `stars` — Float
- `ratingDistribution` — JSON {1: N, 2: N, 3: N, 4: N, 5: N}

## ML Integration Pattern: Stub → Real Model Swap

**Strategy / Dependency Injection:**

```typescript
interface SentimentAnalyzer {
  analyze(text: string): Promise<{ sentiment: string; confidence: number }>;
}

// Сейчас: заглушка на ключевых словах
class StubSentimentAnalyzer implements SentimentAnalyzer {
  analyze(text: string) {
    const positiveWords = ['отличный', 'хороший', 'нравится', 'доволен'];
    const negativeWords = ['плохой', 'ужасный', 'разочарован', 'брак'];
    // simple keyword counting → sentiment
    return { sentiment: 'POSITIVE', confidence: 0.8 };
  }
}

// Позже: HTTP-вызов Python сервиса
class MlSentimentAnalyzer implements SentimentAnalyzer {
  async analyze(text: string) {
    const res = await fetch(`${ML_SERVICE_URL}/sentiment`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    return res.json();
  }
}

// Выбор через env flag
const analyzer = process.env.ML_SERVICE_URL
  ? new MlSentimentAnalyzer()
  : new StubSentimentAnalyzer();
```

## ML Service Architecture (Python/FastAPI)

```python
# services/ml-astrum/main.py
from fastapi import FastAPI
from pydantic import BaseModel
import joblib

app = FastAPI()
model = joblib.load("models/sentiment_model.pkl")
vectorizer = joblib.load("models/vectorizer.pkl")

class AnalyzeRequest(BaseModel):
    text: str

@app.post("/sentiment")
def analyze(req: AnalyzeRequest):
    features = vectorizer.transform([req.text])
    prediction = model.predict(features)[0]
    confidence = model.predict_proba(features)[0].max()
    return {
        "sentiment": "POSITIVE" if prediction > 0 else "NEGATIVE",
        "confidence": float(confidence),
    }
```

## Build Order — 7 фаз

| # | Фаза | Зависимости | Параллельно с |
|---|------|-------------|---------------|
| 1 | Prisma schema + CRUD | — | — |
| 2 | Photo upload | Требует storage | 3 (не зависит) |
| 3 | Moderation workflow | Требует CRUD | 2 (не зависит) |
| 4 | ML stub | Внутри API, без внешних | 3 |
| 5 | Python ML service | Инфраструктура, Docker | 3 (не зависит) |
| 6 | Frontend UI | Требует готовый API | 6 (не зависит) |
| 7 | Reply system | Дополнительная | 6 (не зависит) |

**Build order:** `ml-astrum` не зависит от других воркспейсов — параллельная сборка с остальными сервисами.

## Anti-Patterns to Avoid

- **Sync ML в цепочке создания** — блокирует пользователя, непредсказуемая latency
- **Compute aggregates on the fly** — N+1 проблема, кэшируйте на Product
- **Review → Product без связи с OrderItem** — нет верификации покупки
- **DELETE вместо REJECT** — теряется audit trail, невозможно аналитики
- **Review без проверки покупки** — открыто для спама

## Open Questions

1. **Storage для фото** — текущий проект не имеет S3. Нужна отдельная фаза проектирования.
2. **ML model selection** — stub vs готовые библиотеки (sentiment-ru для русского).
3. **Admin moderation UI** — существующий frontend не имеет admin surface.
4. **Rate limiting на отзывы** — как ограничить спам?
5. **Multi-language sentiment** — автодетекция языка для ML.

---
*Last updated: 2026-04-04*
