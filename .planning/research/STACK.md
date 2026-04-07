# STACK: ML-анализ отзывов

**Date:** 2026-04-08

## Python ML-сервис

### Основные технологии
- **Python 3.12** — стабильная версия, поддержка всех зависимостей
- **scikit-learn 1.5+** — TF-IDF + Naive Bayes / Logistic Regression
- **FastAPI 0.115+** — асинхронный HTTP-слой для ML-сервиса
- **uvicorn** — ASGI-сервер для продакшена
- **joblib** — сериализация обученных моделей

### NLP для русского языка
- **pymorphy3** — морфологический анализ русского языка (форк pymorphy2)
- **razdel** — токенизация и сентенс-сплиттинг для русского языка
- **nltk** — базовые NLP-утилиты (стоп-слова, стемминг)

### PostgreSQL из Python
- **psycopg2** или **asyncpg** — драйверы PostgreSQL
- **SQLAlchemy 2.0+** — ORM/SQL-билдер при необходимости прямого чтения
- Альтернатива: Express передаёт текст отзыва в ML-сервис по HTTP, Python не нужен прямой доступ к БД

### Интеграция
- **Express → FastAPI**: HTTP POST `/api/sentiment` с `{ text: string }`, ответ `{ sentiment: 'positive' | 'negative' | 'neutral', confidence: number }`
- **Docker**: Новый сервис `astrum-ml` в docker-compose, порт 8500
- **Модель**: joblib-файл, загружается при старте FastAPI. Переобучается по крон-задаче или через endpoint

### Датасеты
- Kaggle Amazon Reviews — большой, на английском. Хорош для тренировки пайплайна
- Ozon / RuReviews — русскоязычные отзывы, более релевантны для продакшена
- IMDB Reviews — бинарная классификация (positive/negative)

### Что НЕ использовать
- BERT/transformers — слишком тяжело для прототипа, TF-IDF достаточно
- External LLM API — defeats the purpose, нужен self-hosted baseline
- Flask — FastAPI лучше для async и auto-docs
