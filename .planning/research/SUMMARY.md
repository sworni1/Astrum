# Research Summary: ML-анализ отзывов

**Date:** 2026-04-08

## Key Findings

### Stack
- Python 3.12 + FastAPI + scikit-learn (TF-IDF + Naive Bayes/LogReg)
- joblib для сериализации модели
- pymorphy3 + razdel для русского языка NLP
- Async-вызов Express → ML-сервис (не блокировать создание отзыва)

### Table Stakes
- Классификация отзыва при создании (async)
- Отображение тональности на странице товара
- Агрегированная статистика по товару
- Секция отзывов на frontend (пока отсутствует)

### Watch Out For
- Разрыв между training/production данными (язык отзывов) — обучать на русском
- Latency ML-сервиса — async, не синхронно
- Модель деградирует — нужно переобучение
- Старые отзывы без sentiment — бэкфил скрипт
- Docker Python-сервиса отдельно от pnpm-сборки
