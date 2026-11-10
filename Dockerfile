FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CELESTIAL_DATA_ROOT=/data/celestial-odyssey

WORKDIR /opt/celestial-odyssey
COPY pyproject.toml README.md ./
COPY celestial_pipeline ./celestial_pipeline
RUN python -m pip install --no-cache-dir .

VOLUME ["/data"]
ENTRYPOINT ["celestial-data"]
