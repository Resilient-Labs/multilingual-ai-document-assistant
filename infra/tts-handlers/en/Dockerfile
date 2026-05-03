FROM python:3.10-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        espeak-ng \
        libsndfile1 \
        gcc \
        g++ \
        git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 80

CMD ["python", "app.py"]
