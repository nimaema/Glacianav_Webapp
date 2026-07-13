#!/usr/bin/env python3
"""Filesystem-queue worker for Nova's networkless Python sandbox."""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import resource
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any


JOBS_ROOT = Path(os.environ.get("NOVA_JOBS_DIR", "/jobs")).resolve()
INBOX = JOBS_ROOT / "inbox"
PROCESSING = JOBS_ROOT / "processing"
RESULTS = JOBS_ROOT / "results"
MAX_CODE_CHARS = 200_000
MAX_INPUT_BYTES = 40 * 1024 * 1024
MAX_OUTPUT_BYTES = 30 * 1024 * 1024
MAX_LOG_CHARS = 24_000
SANDBOX_UID = 1002
SANDBOX_GID = 1002
MIME_OVERRIDES = {
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".md": "text/markdown",
    ".svg": "image/svg+xml",
}


def safe_name(value: Any) -> str:
    name = Path(str(value or "")).name.strip()
    if not name or name in {".", ".."} or "\x00" in name:
        raise ValueError("Invalid sandbox file name")
    return name[:160]


def limit_process() -> None:
    # Docker applies the primary memory/CPU/PID limits. These are a second
    # boundary around each individual script.
    os.setgroups([])
    os.setgid(SANDBOX_GID)
    os.setuid(SANDBOX_UID)
    resource.setrlimit(resource.RLIMIT_CPU, (185, 185))
    resource.setrlimit(resource.RLIMIT_FSIZE, (35 * 1024 * 1024, 35 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NOFILE, (128, 128))
    resource.setrlimit(resource.RLIMIT_NPROC, (96, 96))
    os.umask(0o007)


def write_result(job_id: str, payload: dict[str, Any]) -> None:
    RESULTS.mkdir(parents=True, exist_ok=True)
    temporary = RESULTS / f".{job_id}.tmp"
    final = RESULTS / f"{job_id}.json"
    temporary.write_text(json.dumps(payload), encoding="utf-8")
    temporary.replace(final)


def recover_and_prune_queue() -> None:
    now = time.time()
    for orphan in PROCESSING.glob("*.json"):
        try:
            orphan.replace(INBOX / orphan.name)
        except FileNotFoundError:
            pass
    for stale in [*RESULTS.glob("*.json"), *INBOX.glob(".*.tmp"), *RESULTS.glob(".*.tmp")]:
        try:
            if now - stale.stat().st_mtime > 3600:
                stale.unlink(missing_ok=True)
        except FileNotFoundError:
            pass


def run_job(request_path: Path) -> None:
    started = time.monotonic()
    job_id = request_path.stem
    workspace: Path | None = None
    try:
        request = json.loads(request_path.read_text(encoding="utf-8"))
        if request.get("id") != job_id:
            raise ValueError("Job identifier mismatch")
        code = str(request.get("code") or "").strip()
        if not code or len(code) > MAX_CODE_CHARS:
            raise ValueError("Python source is empty or too large")
        expected = [safe_name(value) for value in request.get("expectedOutputs", [])][:16]
        if not expected:
            raise ValueError("No output files were declared")

        workspace = Path(tempfile.mkdtemp(prefix=f"nova-{job_id[:8]}-", dir="/workspace"))
        input_total = 0
        for item in request.get("inputFiles", [])[:8]:
            name = safe_name(item.get("filename"))
            data = base64.b64decode(str(item.get("dataBase64") or ""), validate=True)
            input_total += len(data)
            if input_total > MAX_INPUT_BYTES:
                raise ValueError("Sandbox inputs exceed 40 MB")
            (workspace / name).write_bytes(data)

        script_path = workspace / "main.py"
        script_path.write_text(code, encoding="utf-8")
        os.chmod(workspace, 0o770)
        os.chown(workspace, SANDBOX_UID, SANDBOX_GID)
        for child_path in workspace.iterdir():
            os.chmod(child_path, 0o660)
            os.chown(child_path, SANDBOX_UID, SANDBOX_GID)
        timeout = min(180, max(5, int(request.get("timeoutSeconds") or 120)))
        args = [str(value)[:240] for value in request.get("args", [])[:12]]
        # The queue is already isolated from model-authored code by ownership:
        # JOBS_ROOT is root:worker(1001) mode 770, and limit_process() drops the
        # child to uid/gid 1002 with NO supplementary groups, so it cannot read,
        # traverse, or write anything under /jobs. The previous defense chmod'd
        # JOBS_ROOT to 000 for the subprocess lifetime, but that raced concurrent
        # web-side queue writes and the worker's own next iteration, surfacing as
        # "[Errno 13] Permission denied: /jobs/processing/<id>.json". Ownership
        # alone is sufficient, so we no longer touch JOBS_ROOT's mode here.
        completed = subprocess.run(
            ["python", "-I", "-B", str(script_path), *args],
            cwd=workspace,
            env={
                "HOME": str(workspace),
                "TMPDIR": str(workspace),
                "PATH": "/usr/local/bin:/usr/bin:/bin",
                "LANG": "C.UTF-8",
                "MPLBACKEND": "Agg",
                "PYTHONUNBUFFERED": "1",
            },
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            check=False,
            preexec_fn=limit_process,
        )
        if completed.returncode != 0:
            detail = completed.stderr.strip().splitlines()[-1] if completed.stderr.strip() else "unknown error"
            raise RuntimeError(f"Python exited with status {completed.returncode}: {detail[:500]}")

        files = []
        output_total = 0
        for name in expected:
            output_path = workspace / name
            if not output_path.is_file():
                raise ValueError(f"Expected output was not created: {name}")
            data = output_path.read_bytes()
            output_total += len(data)
            if output_total > MAX_OUTPUT_BYTES:
                raise ValueError("Sandbox outputs exceed 30 MB")
            files.append(
                {
                    "filename": name,
                    "mimeType": MIME_OVERRIDES.get(Path(name).suffix.lower()) or mimetypes.guess_type(name)[0] or "application/octet-stream",
                    "dataBase64": base64.b64encode(data).decode("ascii"),
                    "byteSize": len(data),
                }
            )

        write_result(
            job_id,
            {
                "ok": True,
                "stdout": completed.stdout[-MAX_LOG_CHARS:],
                "stderr": completed.stderr[-12_000:],
                "files": files,
                "durationMs": round((time.monotonic() - started) * 1000),
            },
        )
    except subprocess.TimeoutExpired:
        write_result(job_id, {"ok": False, "error": "Python job exceeded its time limit", "files": [], "stdout": "", "stderr": "", "durationMs": round((time.monotonic() - started) * 1000)})
    except Exception as error:
        write_result(job_id, {"ok": False, "error": str(error)[:800], "files": [], "stdout": "", "stderr": "", "durationMs": round((time.monotonic() - started) * 1000)})
    finally:
        request_path.unlink(missing_ok=True)
        if workspace:
            shutil.rmtree(workspace, ignore_errors=True)


def main() -> None:
    # The supervisor can read sandbox-owned outputs through this group. The
    # child clears supplementary groups before running, so it still cannot
    # traverse the root-owned /jobs queue.
    os.setgroups([1001, SANDBOX_GID])
    os.chmod(JOBS_ROOT, 0o770)
    for directory in (INBOX, PROCESSING, RESULTS):
        directory.mkdir(parents=True, exist_ok=True)
    recover_and_prune_queue()
    print("Nova sandbox worker ready", flush=True)
    last_cleanup = time.monotonic()
    while True:
        claimed = False
        for pending in sorted(INBOX.glob("*.json")):
            processing = PROCESSING / pending.name
            try:
                pending.replace(processing)
            except FileNotFoundError:
                continue
            claimed = True
            run_job(processing)
        if not claimed:
            time.sleep(0.2)
        if time.monotonic() - last_cleanup > 60:
            recover_and_prune_queue()
            last_cleanup = time.monotonic()


if __name__ == "__main__":
    main()
