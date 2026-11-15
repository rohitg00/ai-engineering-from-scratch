FROM python:3.13.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements-runtime.txt requirements.lock ./
RUN pip install --no-cache-dir -r requirements-runtime.txt -c requirements.lock

COPY app app
COPY data data

ENV PYTHONUNBUFFERED=1 \
    LANGSMITH_TRACING=false \
    OTEL_FILE="" \
    MODEL=fake:primary \
    BACKUP_MODEL=fake:backup

USER 10001
EXPOSE 8000
CMD ["uvicorn", "app.server:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "20"]
