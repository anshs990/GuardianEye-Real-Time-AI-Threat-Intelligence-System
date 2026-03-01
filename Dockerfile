FROM python:3.12-slim

WORKDIR /app

# Install system deps for OpenCV + YOLO
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy project
COPY agent.py .
COPY requirements.txt .

# Install Python deps
RUN uv venv --python 3.12 && \
    uv add "vision-agents[anthropic,ultralytics,moondream,deepgram,elevenlabs,getstream]" && \
    uv add opencv-python-headless python-dotenv

EXPOSE 8080

# Production mode by default
CMD ["python", "agent.py", "serve", "--host", "0.0.0.0", "--port", "8080"]
