"""Local HTTP server for pipeline.html and the DeepSeek Config Agent."""

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

from .catalog import ROOT, load_fixed_scenario, load_reference_catalog, load_scenario_registry
from .models import AgentCandidate
from .service import (
    ConfigAgentError,
    ConfigAgent,
    NarrativeAgent,
    save_agent_run,
    save_narrative_run,
    validate_candidate,
)
from ..instance.generator import generate_instance
from ..instance.batch import generate_batch, traverse_domain


MAX_REQUEST_BYTES = 1_000_000
LOG_PATH = ROOT / ".agent_runs" / "agent-events.jsonl"
RUN_STATUS: dict[str, dict[str, Any]] = {}
RUN_STATUS_LOCK = threading.Lock()


def _safe_exception_text(exc: Exception) -> str:
    text = f"{type(exc).__name__}: {exc}"
    for name in ("DEEPSEEK_API_KEY",):
        secret = os.environ.get(name)
        if secret:
            text = text.replace(secret, "<redacted>")
    return text[:500]


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
        return os.environ.get("DEEPSEEK_PRO_MODEL", "deepseek-chat")
    if tier == "lite":
        return os.environ.get("DEEPSEEK_LITE_MODEL", "deepseek-chat")
    return os.environ.get("DEEPSEEK_FLASH_MODEL", "deepseek-chat")


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
            catalog = load_reference_catalog()
            self._json(HTTPStatus.OK, {
                "status": "ready" if os.environ.get("DEEPSEEK_API_KEY") else "missing_api_key",
                "agent_ready": bool(os.environ.get("DEEPSEEK_API_KEY")),
                "flash_model": _model_for_tier("flash"),
                "lite_model": _model_for_tier("lite"),
                "pro_model": _model_for_tier("pro"),
                "catalog_version": catalog["catalog_version"],
                "catalog_scope": catalog["scope"],
                "catalog_counts": catalog["counts"],
                "catalog_source_versions": catalog["source_versions"],
            })
            return
        if parsed.path == "/api/catalog":
            catalog = load_reference_catalog()
            self._json(HTTPStatus.OK, {
                "catalog_version": catalog["catalog_version"],
                "scope": catalog["scope"],
                "source_versions": catalog["source_versions"],
                "counts": catalog["counts"],
                "abilities": catalog["abilities"],
                "gal_cells": [{
                    "cell": item["cell"],
                    "a_id": item["a_id"],
                    "level": item["level"],
                    "ability": item["ability"],
                    "level_label": item["level_label"],
                    "cumulative_responsibilities": item["cumulative_responsibilities"],
                    "required_jd_ids": item["required_jd_ids"],
                } for item in catalog["gal_cells"]],
                "jd_fields": [{
                    "id": item["id"],
                    "name": item["name"],
                    "scope": item["scope"],
                    "owner_a": item["owner_a"],
                } for item in catalog["jd_fields"]],
            })
            return
        if parsed.path == "/api/scenario":
            scenario_id = (parse_qs(parsed.query).get("scenario_id") or [None])[0]
            try:
                self._json(HTTPStatus.OK, load_fixed_scenario(scenario_id))
            except KeyError:
                self._json(HTTPStatus.NOT_FOUND, {"error": "scenario_not_found"})
            return
        if parsed.path == "/api/scenarios":
            self._json(HTTPStatus.OK, load_scenario_registry())
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
        if self.path not in {
            "/api/config-agent/expand",
            "/api/config-agent/analyze",
            "/api/config-agent/revise",
            "/api/instance/generate",
            "/api/instance/batch",
            "/api/instance/traverse",
        }:
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

            if self.path in {"/api/instance/generate", "/api/instance/batch", "/api/instance/traverse"}:
                template = payload.get("template") or payload.get("task_template")
                if not isinstance(template, dict):
                    raise ValueError("Missing 'template' (task_template JSON object).")
                if self.path == "/api/instance/generate":
                    seed = int(payload.get("seed", 0))
                    instance = generate_instance(template, seed)
                    self._json(HTTPStatus.OK, {"instance": instance})
                elif self.path == "/api/instance/batch":
                    seeds = payload.get("seeds", [0])
                    if isinstance(seeds, str):
                        from ..instance.batch import parse_seed_spec
                        seeds = parse_seed_spec(seeds)
                    instances = generate_batch(template, seeds)
                    self._json(HTTPStatus.OK, {
                        "count": len(instances),
                        "instances": instances,
                    })
                else:
                    steps = int(payload.get("steps_per_range", 3))
                    instances = traverse_domain(template, steps_per_range=steps)
                    self._json(HTTPStatus.OK, {
                        "count": len(instances),
                        "instances": instances,
                    })
                return

            task_description = str(payload.get("task_description") or "").strip()
            scenario_id = str(payload.get("scenario_id") or load_scenario_registry()["default_scenario_id"])
            try:
                fixed_scenario = load_fixed_scenario(scenario_id)
            except KeyError as exc:
                raise ValueError(f"unknown scenario_id: {scenario_id}") from exc
            if self.path == "/api/config-agent/revise":
                parent_run_id = str(payload.get("parent_run_id") or "")
                if not re.fullmatch(r"agent-[a-z0-9-]{6,64}", parent_run_id):
                    raise ValueError("invalid parent_run_id")
                candidate = AgentCandidate.model_validate(payload.get("candidate"))
                issues = validate_candidate(candidate, task_description, fixed_scenario)
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
                    "scenario_id": scenario_id,
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

            api_key = os.environ.get("DEEPSEEK_API_KEY")
            if not api_key:
                self._json(HTTPStatus.SERVICE_UNAVAILABLE, {
                    "error": "missing_api_key",
                    "message": "本地 Agent 服务未设置 DEEPSEEK_API_KEY。",
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
                "scenario_id": scenario_id,
                "operation": "narrative_expand" if self.path == "/api/config-agent/expand" else "classification_and_extraction",
                "task_characters": len(task_description),
            })

            if self.path == "/api/config-agent/expand":
                narrative_agent = NarrativeAgent(api_key=api_key, model=model)
                narrative_result = narrative_agent.expand(
                    task_description,
                    fixed_scenario=fixed_scenario,
                    run_id=run_id,
                    progress=lambda event, details: _log_event(run_id, event, details),
                )
                run_path = save_narrative_run(task_description, narrative_result, fixed_scenario)
                with RUN_STATUS_LOCK:
                    RUN_STATUS.setdefault(run_id, {})["result"] = narrative_result.model_dump(mode="json")
                    RUN_STATUS[run_id]["status"] = "completed"
                _log_event(run_id, "run_saved", {
                    "artifact_type": "narrative_expansion_run",
                    "path": str(run_path.relative_to(ROOT)),
                })
                self._json(HTTPStatus.OK, {
                    "result": narrative_result.model_dump(mode="json"),
                    "local_record": str(run_path.relative_to(ROOT)),
                })
                return

            source_task_description = str(payload.get("source_task_description") or "").strip() or None
            narrative_parent_run_id = str(payload.get("narrative_parent_run_id") or "").strip() or None
            if narrative_parent_run_id and not re.fullmatch(r"agent-[a-z0-9-]{6,64}", narrative_parent_run_id):
                raise ValueError("invalid narrative_parent_run_id")
            agent = ConfigAgent(api_key=api_key, model=model)
            result = agent.analyze(
                task_description,
                fixed_scenario=fixed_scenario,
                run_id=run_id,
                progress=lambda event, details: _log_event(run_id, event, details),
            )
            run_path = save_agent_run(
                task_description,
                result,
                fixed_scenario,
                source_task_description=source_task_description,
                narrative_parent_run_id=narrative_parent_run_id,
            )
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
        except Exception as exc:
            if "run_id" in locals():
                _log_event(run_id, "run_failed", {"error": _safe_exception_text(exc)})
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {
                "error": "internal_error",
                "message": "本地 Agent 服务发生未预期错误；请查看启动终端。",
            })


def main() -> None:
    host = os.environ.get("UAV_AGENT_HOST", "127.0.0.1")
    port = int(os.environ.get("UAV_AGENT_PORT", "8765"))
    server = ThreadingHTTPServer((host, port), PipelineRequestHandler)
    print(f"UAV Benchmark Config Agent: http://{host}:{port}")
    print("API Key is read from DEEPSEEK_API_KEY and is never sent to pipeline.html.")
    print(f"Event log: {LOG_PATH.relative_to(ROOT)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
