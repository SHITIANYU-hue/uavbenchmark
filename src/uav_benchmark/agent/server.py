"""Local HTTP server for pipeline.html and the Gemini Config Agent."""

from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from .catalog import ROOT
from .models import AgentCandidate
from .service import ConfigAgentError, GeminiConfigAgent, save_agent_run, validate_candidate


MAX_REQUEST_BYTES = 1_000_000
LOG_PATH = ROOT / ".agent_runs" / "agent-events.jsonl"
RUN_STATUS: dict[str, dict[str, Any]] = {}
RUN_STATUS_LOCK = threading.Lock()


def _log_event(run_id: str, event: str, details: dict[str, Any] | None = None) -> None:
    LOG_PATH.parent.mkdir(exist_ok=True)
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "event": event,
        "details": details or {},
    }
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")
    with RUN_STATUS_LOCK:
        status = RUN_STATUS.setdefault(run_id, {"run_id": run_id, "status": "running"})
        status["event"] = event
        status["details"] = details or {}
        status["updated_at"] = record["timestamp"]
        if event == "run_failed":
            status["status"] = "failed"
    detail_text = " " + json.dumps(details, ensure_ascii=False) if details else ""
    print(f"[{run_id}] {event}{detail_text}", flush=True)


def _model_for_tier(tier: str) -> str:
    if tier == "pro":
        return os.environ.get("GEMINI_PRO_MODEL", "gemini-2.5-pro")
    if tier == "lite":
        return os.environ.get("GEMINI_LITE_MODEL", "gemini-3.1-flash-lite")
    return os.environ.get("GEMINI_FLASH_MODEL", "gemini-3.5-flash")


class PipelineRequestHandler(SimpleHTTPRequestHandler):
    server_version = "UAVBenchmarkAgent/0.1"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(encoded)
        except (BrokenPipeError, ConnectionResetError):
            print("Browser disconnected before the response was delivered; run state remains recoverable.", flush=True)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._json(HTTPStatus.OK, {
                "status": "ready" if os.environ.get("GEMINI_API_KEY") else "missing_api_key",
                "agent_ready": bool(os.environ.get("GEMINI_API_KEY")),
                "flash_model": _model_for_tier("flash"),
                "lite_model": _model_for_tier("lite"),
                "pro_model": _model_for_tier("pro"),
                "catalog_scope": "partial_demo_catalog",
            })
            return
        if parsed.path == "/api/config-agent/status":
            run_id = (parse_qs(parsed.query).get("run_id") or [""])[0]
            if not re.fullmatch(r"agent-[a-z0-9-]{6,64}", run_id):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_run_id"})
                return
            with RUN_STATUS_LOCK:
                status = dict(RUN_STATUS.get(run_id) or {})
            if not status:
                saved_path = ROOT / ".agent_runs" / f"{run_id}.json"
                if saved_path.exists():
                    saved = json.loads(saved_path.read_text(encoding="utf-8"))
                    status = {
                        "run_id": run_id,
                        "status": "completed",
                        "event": "run_saved",
                        "result": saved["result"],
                    }
            if not status:
                self._json(HTTPStatus.NOT_FOUND, {"error": "run_not_found"})
                return
            self._json(HTTPStatus.OK, status)
            return
        if self.path == "/":
            self.path = "/pipeline.html"
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {"/api/config-agent/analyze", "/api/config-agent/revise"}:
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request_size"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            task_description = str(payload.get("task_description") or "").strip()
            if self.path == "/api/config-agent/revise":
                parent_run_id = str(payload.get("parent_run_id") or "")
                if not re.fullmatch(r"agent-[a-z0-9-]{6,64}", parent_run_id):
                    raise ValueError("invalid parent_run_id")
                candidate = AgentCandidate.model_validate(payload.get("candidate"))
                issues = validate_candidate(candidate, task_description)
                revision_number = max(1, int(payload.get("revision_number") or 1))
                revision_id = f"{parent_run_id}-r{revision_number}-{uuid.uuid4().hex[:6]}"
                record = {
                    "artifact_type": "human_revision",
                    "revision_id": revision_id,
                    "parent_run_id": parent_run_id,
                    "revision_number": revision_number,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "change_summary": payload.get("change_summary") or [],
                    "task_description": task_description,
                    "candidate": candidate.model_dump(mode="json"),
                    "validation_status": "needs_review" if issues else "pass",
                    "validation_issues": [item.model_dump(mode="json") for item in issues],
                }
                revision_path = ROOT / ".agent_runs" / f"{revision_id}.json"
                revision_path.parent.mkdir(exist_ok=True)
                revision_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                _log_event(revision_id, "revision_saved", {
                    "parent_run_id": parent_run_id,
                    "issue_count": len(issues),
                    "path": str(revision_path.relative_to(ROOT)),
                })
                self._json(HTTPStatus.OK, {
                    "revision_id": revision_id,
                    "candidate": candidate.model_dump(mode="json"),
                    "validation_status": record["validation_status"],
                    "validation_issues": record["validation_issues"],
                    "local_record": str(revision_path.relative_to(ROOT)),
                })
                return

            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                self._json(HTTPStatus.SERVICE_UNAVAILABLE, {
                    "error": "missing_api_key",
                    "message": "本地 Agent 服务未设置 GEMINI_API_KEY。",
                })
                return
            tier = str(payload.get("model_tier") or "flash").lower()
            if tier not in {"flash", "lite", "pro"}:
                raise ValueError("model_tier must be flash, lite, or pro")
            requested_run_id = str(payload.get("run_id") or "")
            run_id = requested_run_id if re.fullmatch(r"agent-[a-z0-9-]{6,64}", requested_run_id) else f"agent-{uuid.uuid4().hex[:12]}"
            model = _model_for_tier(tier)
            _log_event(run_id, "request_received", {
                "model": model,
                "task_characters": len(task_description),
            })
            agent = GeminiConfigAgent(api_key=api_key, model=model)
            result = agent.analyze(
                task_description,
                run_id=run_id,
                progress=lambda event, details: _log_event(run_id, event, details),
            )
            run_path = save_agent_run(task_description, result)
            with RUN_STATUS_LOCK:
                RUN_STATUS.setdefault(run_id, {})["result"] = result.model_dump(mode="json")
                RUN_STATUS[run_id]["status"] = "completed"
            _log_event(run_id, "run_saved", {"path": str(run_path.relative_to(ROOT))})
            self._json(HTTPStatus.OK, {
                "result": result.model_dump(mode="json"),
                "local_record": str(run_path.relative_to(ROOT)),
            })
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request", "message": str(exc)})
        except ConfigAgentError as exc:
            if "run_id" in locals():
                _log_event(run_id, "run_failed", {"error": str(exc)[:500]})
            self._json(HTTPStatus.BAD_GATEWAY, {"error": "agent_error", "message": str(exc)})
        except Exception:
            if "run_id" in locals():
                _log_event(run_id, "run_failed", {"error": "unexpected_internal_error"})
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {
                "error": "internal_error",
                "message": "本地 Agent 服务发生未预期错误；请查看启动终端。",
            })


def main() -> None:
    host = os.environ.get("UAV_AGENT_HOST", "127.0.0.1")
    port = int(os.environ.get("UAV_AGENT_PORT", "8765"))
    server = ThreadingHTTPServer((host, port), PipelineRequestHandler)
    print(f"UAV Benchmark Config Agent: http://{host}:{port}")
    print("API Key is read from GEMINI_API_KEY and is never sent to pipeline.html.")
    print(f"Event log: {LOG_PATH.relative_to(ROOT)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
