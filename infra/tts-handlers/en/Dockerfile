FROM huggingface/transformers-pytorch-cpu:latest

# Install espeak-ng — required by Coqui VITS phonemizer
RUN apt-get update && \
    apt-get install -y --no-install-recommends espeak-ng && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (coqui-tts capped below transformers 5.x)
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Copy handler into the expected location for HF inference toolkit
COPY handler.py /repository/handler.py
