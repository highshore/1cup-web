# Cloud Run image for the growth agent. Includes headless Chromium so the
# koreapas Selenium adapter can post. Selenium 4.20+ bundles Selenium Manager,
# which resolves a matching chromedriver at runtime.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8080 \
    CHROME_BIN=/usr/bin/chromium

# Chromium + the shared libs it needs to run headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium chromium-driver \
        fonts-liberation libnss3 libxss1 libasound2 libgbm1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Single worker, long timeout — a posting run drives a browser and can take a while.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 4 --timeout 600 main:app
