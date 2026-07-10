FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV MPLBACKEND=Agg

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    libreoffice-calc \
    libreoffice-writer \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/nova-worker
COPY nova-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY nova-worker/worker.py ./worker.py
RUN useradd --uid 1001 --user-group --create-home --shell /usr/sbin/nologin worker \
  && useradd --uid 1002 --user-group --create-home --shell /usr/sbin/nologin sandbox

CMD ["python", "-I", "/opt/nova-worker/worker.py"]
