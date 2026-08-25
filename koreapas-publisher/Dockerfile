FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PORT=8080 \
    CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER=/usr/bin/chromedriver

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium chromium-driver fonts-liberation libasound2 libgbm1 libnss3 libxss1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 180 app:app
