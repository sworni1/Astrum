# sentiment-astrum

FastAPI-сервис для определения характера отзыва.

## Требования

Используй **Python 3.12 или 3.13**.

## Стек модели

Сервис соответствует учебному стеку:

- `scikit-learn`
- `pandas`
- `nltk`
- методы: `TF-IDF` + `LogisticRegression`

Модель обучается локально, сохраняется в `apps/sentiment-astrum/model/sentiment_model.joblib` и затем используется FastAPI-сервисом для предсказаний.

## Перевод русских отзывов

Тональность считается по **английскому** тексту. Русский текст сначала уходит в **[FOSWLY translate-backend](https://github.com/FOSWLY/translate-backend)** (отдельный сервис).

1. Подними translate (из корня монорепо):

   ```bash
   docker compose up astrum-translate -d
   ```

   Либо клонируй репозиторий и `bun install && bun start` (порт по умолчанию `3313`).

2. Скопируй `apps/sentiment-astrum/.env.example` в `.env` в этой папке и задай `TRANSLATE_SERVICE_URL`. Файл `.env` подхватывается при старте (`python-dotenv`). Для исходящих запросов **нельзя** использовать `0.0.0.0` — только `127.0.0.1` / `localhost` (локально) или `http://astrum-translate:3313` из другого контейнера.

Опционально: `TRANSLATE_LANG_PAIR` (по умолчанию `ru-en`), `TRANSLATE_PROVIDER` (по умолчанию `msedge`). Если `TRANSLATE_SERVICE_URL` не задан, используется `http://127.0.0.1:3313` (локально; **в Docker** — `http://astrum-translate:3313`). Запросы к translate идут с `trust_env=False`, чтобы не подмешивался системный прокси из `HTTP_PROXY` (иначе при VPN/прокси возможны ложные ошибки к `localhost`).

## Customer (Next.js) и прокси тональности

Форма отзыва ходит на **`/api-gateway/sentiment/predict`** на том же origin, что и фронт; Next.js проксирует на API (`rewrites` в `next.config.ts`). Локально цель по умолчанию `http://127.0.0.1:3580`. В Docker при сборке образа customer задай **`API_GATEWAY_INTERNAL_URL`** (в compose уже передаётся `http://astrum-api:3580`).

## Запуск (dev)

```bash
cd apps/sentiment-astrum
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8088 --app-dir .
```

## Обучение (Amazon Reviews / amazon_polarity)

Скачивание датасета `amazon_polarity` произойдёт автоматически при первом запуске и может занять время/диск.

```bash
.\.venv\Scripts\activate
pip install -r requirements.txt
python scripts/train.py
```

Опциональные env-параметры обучения:

- `SENTIMENT_TRAIN_SAMPLES` по умолчанию `10000`
- `SENTIMENT_EVAL_SAMPLES` по умолчанию `2000`
- `SENTIMENT_MAX_FEATURES` по умолчанию `20000`
- `SENTIMENT_NGRAM_MAX` по умолчанию `2`
- `SENTIMENT_MAX_ITER` по умолчанию `200`

Быстрый smoke-режим для проверки пайплайна обучения:

```bash
$env:SENTIMENT_QUICK_TRAIN="1"
python scripts/train.py
```

В `quick mode` используются более лёгкие параметры:

- `SENTIMENT_TRAIN_SAMPLES=1000`
- `SENTIMENT_EVAL_SAMPLES=200`
- `SENTIMENT_MAX_FEATURES=5000`
- `SENTIMENT_MAX_ITER=100`

Если нужно, их всё равно можно переопределить обычными env-переменными.

Оценка качества:

```bash
python scripts/evaluate.py
```

## API

- `GET /health`
- `POST /predict` `{ "text": "..." }`
