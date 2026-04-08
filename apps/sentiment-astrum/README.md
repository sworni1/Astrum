# sentiment-astrum

FastAPI-сервис для определения характера отзыва.

## Требования

Используй **Python 3.12 или 3.13**. На Python 3.14 сейчас падает установка `pydantic-core` (ограничение PyO3), поэтому зависимости не поставятся.

## Запуск (dev)

```bash
cd apps/sentiment-astrum
py -3.12 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8088 --app-dir .
```

## Обучение (Amazon Reviews / amazon_polarity)

Скачивание датасета произойдёт автоматически при первом запуске и может занять время/диск.

```bash
.\.venv\Scripts\activate
pip install -r requirements.txt
python scripts/train.py
```

Оценка качества:

```bash
python scripts/evaluate.py
```

## API

- `GET /health`
- `POST /predict` `{ "text": "..." }`

