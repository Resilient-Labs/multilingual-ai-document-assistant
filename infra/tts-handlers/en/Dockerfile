FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        espeak-ng \
        libsndfile1 \
        gcc \
        g++ \
        git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy handler into the expected location for HF inference toolkit
COPY handler.py /repository/handler.py
