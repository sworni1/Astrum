# sentiment-astrum

Сервис тональности отзывов: **FastAPI**, инференс и (опционально) обучение на `amazon_polarity`.

## Требования

- **Python 3.12 или 3.13** (на 3.14 сборка `pydantic-core` часто ломается).
- Зависимости: `pip install -r requirements.txt` в виртуальном окружении.

**Docker для обучения не обязателен** — достаточно venv на машине. Docker удобен для translate и общей инфраструктуры монорепо, но не для самого `train.py`.

## Установка

Из корня репозитория:

```bash
cd apps/sentiment-astrum
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Скопируй `.env.example` в `.env` при необходимости (translate и параметры обучения).

## Запуск API (dev)

Рабочая директория должна быть **`apps/sentiment-astrum`**, иначе импорт `src` не найдётся. Обязательно **`--app-dir .`**:

```bash
cd apps/sentiment-astrum
.\.venv\Scripts\activate
uvicorn src.app:app --reload --port 8088 --app-dir .
```

Проверка: `GET http://127.0.0.1:8088/health`, `POST http://127.0.0.1:8088/predict` с телом `{"text":"..."}`.

- Русский текст без перевода: ответ **`UNKNOWN`** (политика до офлайн-перевода).
- Английский: **`POSITIVE` / `NEGATIVE`** и `score`.

## Обучение (`scripts/train.py`)

Датасет `amazon_polarity` скачивается при первом запуске (долго и много места на диске).

**По умолчанию в скрипте** включено полное обучение по всему train и всему test (`SENTIMENT_FULL_DATASET` по умолчанию `1`). На CPU это может занять много часов.

Быстрый урезанный прогон (без смены кода):

```powershell
$env:SENTIMENT_FULL_DATASET="0"
$env:SENTIMENT_TRAIN_SAMPLES="10000"
$env:SENTIMENT_EVAL_SAMPLES="2000"
python scripts/train.py
```

Оценка после обучения (нужна папка модели, путь см. `SENTIMENT_MODEL_DIR` в `.env.example`):

```bash
python scripts/evaluate.py
```

Артефакты модели по умолчанию: `apps/sentiment-astrum/model` (в `.gitignore`).

## Перевод русских отзывов (опционально)

Тональность считается по английскому тексту. Русский можно прогонять через **translate-backend** (см. `docker compose` и переменные `TRANSLATE_*` в `.env.example`). Подробности поведения — в коде сервиса и в `docker-compose` монорепо.

## Интеграция с backend

В **`apps/api-astrum`** задай:

```env
SENTIMENT_SERVICE_URL=http://127.0.0.1:8088
```

Тогда при создании отзыва в JSON ответа добавляется поле **`sentiment`**.

## Customer (Next.js)

Прокси к API настраивается в `apps/customer` (`rewrites` / gateway). Локально цель API часто `http://127.0.0.1:3580`.

## Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Проверка живости |
| POST | `/predict` | Тело: `{"text":"..."}` |
