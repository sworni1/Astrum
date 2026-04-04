# Technology Stack — Система отзывов с ML

**Project:** Astrum Reviews System
**Mode:** Stack dimension
**Confidence:** MEDIUM-HIGH

## Core Stack Additions

### Backend (api-astrum)

New dependencies for reviews module:

| Package | Version | Purpose |
|---------|---------|---------|
| `multer` | ^2.0 | File upload handling |
| `@aws-sdk/client-s3` | ^3.x | S3-compatible storage for photos |
| `sharp` | ^0.34 | Image resizing/optimization |
| `uuid` | ^11 | Unique IDs for upload references |
| Existing: `express` | 4.21.2 | Already in use |
| Existing: `class-validator` | ^0.14 | Validation (already project standard) |

### ML Service (NEW: `services/ml-astrum/`)

New workspace — Python FastAPI microservice:

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | ^0.115 | HTTP API for ML service |
| `uvicorn` | ^0.34 | ASGI server |
| `scikit-learn` | ^1.6 | TF-IDF, Naive Bayes, Logistic Regression |
| `pandas` | ^2.2 | Data manipulation |
| `nltk` | ^3.9 | Text preprocessing (tokenization, stemming) |
| `python-dotenv` | ^1.0 | Environment config |

### Frontend (customer)

| Package | Status | Purpose |
|---------|--------|---------|
| Existing: React 19 + shadcn/ui | OK | Star rating component, card layout |
| New: `react-hook-form` | Recommended | Review form handling |
| New: `lucide-react` | Check existing | Star iconography |

## Prisma Schema Additions

New enums:
```
ReviewStatus: PENDING | APPROVED | REJECTED
ReviewSentiment: NOT_ANALYZED | POSITIVE | NEGATIVE | NEUTRAL
```

New models:
- `Review` — links to `OrderItem` (not `Product` directly, for purchase verification)
- `ReviewCriteria` — criteria scores (quality, delivery, accuracy)
- `ReviewPhoto` — attached images
- `ReviewResponse` — seller responses

## ML Integration Architecture

**Recommended:** FastAPI microservice via REST API.

**Why not alternatives:**
- `python-shell` / embedded Python — tightly couples, hard to scale
- ONNX runtime in Node.js — complex setup, overkill for scikit-learn
- Celery / task queue — overkill for MVP, adds Redis dependency

**Flow:**
```
Express API → POST /api/sentiment → FastAPI service
  → TF-IDF transform → model.predict → return { sentiment, confidence }
  → Express updates review.sentiment
```

**Stub Phase 1:** Rule-based keyword analysis until ML service ready. Strategy pattern with interface:

```typescript
interface SentimentAnalyzer {
  analyze(text: string): Promise<{ sentiment: string; confidence: number }>;
}
```

## Image Storage

**Recommended:** S3 compatible storage (MinIO for dev, S3 for prod).

**Why not local disk:**
- Multi-service architecture — services don't share filesystem
- Dockerized deployment — volumes complicate deployment
- Horizontal scaling — needs shared storage

**Flow:**
```
Frontend → POST /api/reviews/photos → get presigned S3 URL
Frontend → PUT to S3 URL → upload image directly
API → store photo URL in ReviewPhoto
```

## Docker

New service in docker-compose.yml:
```yaml
ml-astrum:
  build: services/ml-astrum
  ports: ["8000:8000"]
  environment:
    - MODEL_PATH=./models
  volumes:
    - ./services/ml-astrum/models:/app/models
```

## Version Notes

- Current Express: 4.21.2 (verified from package.json)
- Current Prisma: 7.5.0 (verified)
- Current Next.js: 15.4.2 (verified)
- Current React: 19 (verified)
- Node base image: 20.x (inconsistent — some Dockerfiles use 18, some use 20)
- argon2 version drift: 0.40.3 vs 0.41.1 across packages

## What NOT to Use

- **jsonwebtoken** in Express — project uses cookie-based JWT via auth proxy, not token passing
- **Apollo Client** on backend — dead dependency, no GraphQL server exists
- **Local file storage** for photos — multi-service architecture requires shared storage
- **Synchronous ML in creation flow** — adds 200-2000ms latency, creates failure point

---
*Last updated: 2026-04-04*
