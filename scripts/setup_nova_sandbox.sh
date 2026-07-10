#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
JOBS_DIR="$ROOT_DIR/.nova-jobs"
IMAGE_NAME="glacianav-nova-worker:dev"
CONTAINER_NAME="glacianav-nova-worker-dev"

mkdir -p "$JOBS_DIR/inbox" "$JOBS_DIR/processing" "$JOBS_DIR/results"
chmod -R 700 "$JOBS_DIR"
docker build -f "$ROOT_DIR/nova-worker/Dockerfile" -t "$IMAGE_NAME" "$ROOT_DIR"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network none \
  --read-only \
  --cap-drop ALL \
  --cap-add CHOWN \
  --cap-add FOWNER \
  --cap-add SETGID \
  --cap-add SETUID \
  --security-opt no-new-privileges:true \
  --memory 2g \
  --cpus 2 \
  --pids-limit 128 \
  --tmpfs /workspace:rw,nosuid,nodev,noexec,size=768m \
  --tmpfs /tmp:rw,nosuid,nodev,noexec,size=128m \
  -e NOVA_JOBS_DIR=/jobs \
  -v "$JOBS_DIR:/jobs" \
  "$IMAGE_NAME"

echo "Nova sandbox is running without network access."
