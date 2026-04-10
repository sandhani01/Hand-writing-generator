FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app/projects

COPY requirements-production.txt /tmp/requirements-production.txt
RUN pip install --upgrade pip \
    && pip install -r /tmp/requirements-production.txt

COPY . /app/projects

ENV APP_ROLE=api

CMD ["sh", "-c", "if [ \"$APP_ROLE\" = \"worker\" ]; then celery -A backend.celery_app.celery_app worker --loglevel=info; else uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}; fi"]
