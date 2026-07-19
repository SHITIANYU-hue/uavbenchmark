"""Local HTTP server for pipeline.html and selectable Config Agent providers."""

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
from ..instance.generator import generate_instance, validate_instance
from ..instance.domain_template import build_domain_template, normalize_domain_template
from ..instance.batch import generate_batch, traverse_domain


MAX_REQUEST_BYTES = 1_000_000
LOG_PATH = ROOT / ".agent_runs" / "agent-events.jsonl"
RUN_STATUS: dict[str, dict[str, Any]] = {}
RUN_STATUS_LOCK = threading.Lock()


def _safe_exception_text(exc: Exception) -> str:
    text = f"{type(exc).__name__}: {exc}"
    for name in ("DEEPSEEK_API_KEY", "GEMINI_API_KEY"):
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


PROVIDER_CONFIG = {
    "deepseek": {
        "label": "DeepSeek",
        "key_env": "DEEPSEEK_API_KEY",
        "models": {
            "flash": ("DEEPSEEK_FLASH_MODEL", "deepseek-chat"),
            "lite": ("DEEPSEEK_LITE_MODEL", "deepseek-chat"),
            "pro": ("DEEPSEEK_PRO_MODEL", "deepseek-chat"),
        },
    },
    "gemini": {
        "label": "Gemini",
        "key_env": "GEMINI_API_KEY",
        "models": {
            "flash": ("GEMINI_FLASH_MODEL", "gemini-3.5-flash"),
            "lite": ("GEMINI_LITE_MODEL", "gemini-3.1-flash-lite"),
            "pro": ("GEMINI_PRO_MODEL", "gemini-2.5-pro"),
        },
    },
}


def _model_for_tier(provider: str, tier: str) -> str:
    env_name, fallback = PROVIDER_CONFIG[provider]["models"][tier]
    return os.environ.get(env_name, fallback)


def _provider_health() -> dict[str, dict[str, Any]]:
    return {
        provider: {
            "label": config["label"],
            "ready": bool(os.environ.get(config["key_env"])),
            "models": {tier: _model_for_tier(provider, tier) for tier in ("flash", "lite", "pro")},
        }
        for provider, config in PROVIDER_CONFIG.items()
    }


def _default_provider(providers: dict[str, dict[str, Any]] | None = None) -> str:
    providers = providers or _provider_health()
    requested = os.environ.get("UAV_LLM_PROVIDER", "deepseek").strip().lower()
    if requested in PROVIDER_CONFIG and providers[requested]["ready"]:
        return requested
    for provider in ("deepseek", "gemini"):
        if providers[provider]["ready"]:
            return provider
    return requested if requested in PROVIDER_CONFIG else "deepseek"


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
            providers = _provider_health()
            default_provider = _default_provider(providers)
            self._json(HTTPStatus.OK, {
                "status": "ready" if any(item["ready"] for item in providers.values()) else "missing_api_key",
                "agent_ready": any(item["ready"] for item in providers.values()),
                "default_provider": default_provider,
                "providers": providers,
                "flash_model": providers[default_provider]["models"]["flash"],
                "lite_model": providers[default_provider]["models"]["lite"],
                "pro_model": providers[default_provider]["models"]["pro"],
                "catalog_version": catalog["catalog_version"],
                "ability_id_scheme": catalog["ability_id_scheme"],
                "catalog_scope": catalog["scope"],
                "catalog_counts": catalog["counts"],
                "catalog_source_versions": catalog["source_versions"],
            })
            return
        if parsed.path == "/api/catalog":
            catalog = load_reference_catalog()
            self._json(HTTPStatus.OK, {
                "catalog_version": catalog["catalog_version"],
                "ability_id_scheme": catalog["ability_id_scheme"],
                "scope": catalog["scope"],
                "source_versions": catalog["source_versions"],
                "counts": catalog["counts"],
                "level_policy": catalog["level_policy"],
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
        if parsed.path == "/api/pipeline/load":
            p = ROOT / "saved_pipeline.json"
            if p.exists():
                self._json(HTTPStatus.OK, json.loads(p.read_text(encoding="utf-8")))
            else:
                self._json(HTTPStatus.NOT_FOUND, {"error": "no_saved_pipeline"})
            return
        if self.path == "/":
            self.path = "/pipeline.html"
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in {
            "/api/config-agent/expand",
            "/api/config-agent/classify",
            "/api/config-agent/extract",
            "/api/config-agent/analyze",
            "/api/config-agent/fill-tbd",
            "/api/config-agent/revise",
            "/api/instance/generate",
            "/api/instance/batch",
            "/api/instance/traverse",
            "/api/task-template/generate",
            "/api/task-template/batch",
            "/api/task-template/traverse",
            "/api/domain-template/build",
            "/api/pipeline/save",
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

            if self.path == "/api/pipeline/save":
                record = dict(payload)
                record["savedAt"] = datetime.now(timezone.utc).isoformat()
                save_path = ROOT / "saved_pipeline.json"
                save_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                self._json(HTTPStatus.OK, {"status": "saved", "savedAt": record["savedAt"]})
                return

            if self.path == "/api/domain-template/build":
                candidate = payload.get("candidate") or {}
                jd_edits = payload.get("jd_edits") or payload.get("domain_edits") or []
                if isinstance(jd_edits, dict):
                    # UI may send {slot_id: patch}; merge onto candidate slots.
                    base = {
                        j.get("slot_id"): dict(j)
                        for j in (candidate.get("jd_candidates") or [])
                        if j.get("slot_id")
                    }
                    for slot_id, patch in jd_edits.items():
                        merged = dict(base.get(slot_id) or {"slot_id": slot_id})
                        merged.update(patch or {})
                        base[slot_id] = merged
                    jd_edits = list(base.values())
                domain = build_domain_template(
                    task_title=str(candidate.get("task_title") or payload.get("task_title") or "domain_tpl"),
                    scenario_summary=str(candidate.get("scenario_summary") or ""),
                    coverage=candidate.get("coverage_candidates") or [],
                    runtime_dependencies=candidate.get("runtime_dependencies") or [],
                    jd_edits=jd_edits,
                )
                self._json(HTTPStatus.OK, {"domain_template": domain})
                return

            if self.path in {
                "/api/instance/generate", "/api/instance/batch", "/api/instance/traverse",
                "/api/task-template/generate", "/api/task-template/batch", "/api/task-template/traverse",
            }:
                template = payload.get("domain_template") or payload.get("template") or payload.get("task_template")
                if not isinstance(template, dict) and payload.get("candidate"):
                    candidate = payload.get("candidate") or {}
                    template = build_domain_template(
                        task_title=str(candidate.get("task_title") or "domain_tpl"),
                        scenario_summary=str(candidate.get("scenario_summary") or ""),
                        coverage=candidate.get("coverage_candidates") or [],
                        runtime_dependencies=candidate.get("runtime_dependencies") or [],
                        jd_edits=payload.get("jd_edits") or candidate.get("jd_candidates") or [],
                    )
                if not isinstance(template, dict):
                    raise ValueError("Missing Domain Template ('domain_template' / 'template').")
                domain = normalize_domain_template(template)
                path = self.path
                if path.endswith("/generate"):
                    seed = int(payload.get("seed", 0))
                    artifact = generate_instance(domain, seed)
                    if payload.get("validate", True):
                        validate_instance(artifact, schema_path=ROOT / "schemas" / "task_instance.schema.json")
                    # Product name: Task Template. Wire alias: instance.
                    self._json(HTTPStatus.OK, {
                        "task_template": artifact,
                        "domain_template": domain,
                        "instance": artifact,
                    })
                elif path.endswith("/batch"):
                    seeds = payload.get("seeds", [0])
                    if isinstance(seeds, str):
                        from ..instance.batch import parse_seed_spec
                        seeds = parse_seed_spec(seeds)
                    artifacts = generate_batch(domain, seeds)
                    self._json(HTTPStatus.OK, {
                        "count": len(artifacts),
                        "task_templates": artifacts,
                        "domain_template": domain,
                        "instances": artifacts,
                    })
                else:
                    steps = int(payload.get("steps_per_range", 3))
                    artifacts = traverse_domain(domain, steps_per_range=steps)
                    self._json(HTTPStatus.OK, {
                        "count": len(artifacts),
                        "task_templates": artifacts,
                        "domain_template": domain,
                        "instances": artifacts,
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

            provider = str(payload.get("provider") or _default_provider()).strip().lower()
            if provider not in PROVIDER_CONFIG:
                raise ValueError("provider must be deepseek or gemini")
            api_key = os.environ.get(PROVIDER_CONFIG[provider]["key_env"])
            if not api_key:
                self._json(HTTPStatus.SERVICE_UNAVAILABLE, {
                    "error": "missing_api_key",
                    "provider": provider,
                    "message": f"本地 Agent 服务未设置 {PROVIDER_CONFIG[provider]['key_env']}。",
                })
                return
            tier = str(payload.get("model_tier") or "flash").lower()
            if tier not in {"flash", "lite", "pro"}:
                raise ValueError("model_tier must be flash, lite, or pro")
            requested_run_id = str(payload.get("run_id") or "")
            run_id = requested_run_id if re.fullmatch(r"agent-[a-z0-9-]{6,64}", requested_run_id) else f"agent-{uuid.uuid4().hex[:12]}"
            model = _model_for_tier(provider, tier)
            operation = {
                "/api/config-agent/expand": "narrative_expand",
                "/api/config-agent/classify": "coverage_classification",
                "/api/config-agent/extract": "jd_extraction",
                "/api/config-agent/fill-tbd": "fill_tbd_domains",
            }.get(self.path, "classification_and_extraction")
            _log_event(run_id, "request_received", {
                "provider": provider,
                "model": model,
                "scenario_id": scenario_id,
                "operation": operation,
                "task_characters": len(task_description),
            })

            if self.path == "/api/config-agent/expand":
                target_coverage = payload.get("target_coverage") or []
                if not isinstance(target_coverage, list):
                    raise ValueError("target_coverage must be a list of A×L cell IDs")
                narrative_agent = NarrativeAgent(api_key=api_key, model=model, provider=provider)
                narrative_result = narrative_agent.expand(
                    task_description,
                    fixed_scenario=fixed_scenario,
                    target_coverage=[str(c) for c in target_coverage],
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

            if self.path == "/api/config-agent/fill-tbd":
                tbd_slots = payload.get("tbd_slots") or []
                resolved_slots = payload.get("resolved_slots") or []
                if not isinstance(tbd_slots, list) or not tbd_slots:
                    raise ValueError("tbd_slots must be a non-empty list")
                agent = ConfigAgent(api_key=api_key, model=model, provider=provider)
                fill_result = agent.fill_tbd_domains(
                    task_description,
                    tbd_slots=tbd_slots,
                    resolved_slots=resolved_slots if isinstance(resolved_slots, list) else [],
                    fixed_scenario=fixed_scenario,
                    run_id=run_id,
                    progress=lambda event, details: _log_event(run_id, event, details),
                )
                with RUN_STATUS_LOCK:
                    RUN_STATUS.setdefault(run_id, {})["result"] = fill_result.model_dump(mode="json")
                    RUN_STATUS[run_id]["status"] = "completed"
                _log_event(run_id, "fill_tbd_completed", {
                    "filled": len(fill_result.jd_candidates),
                    "requested": len(tbd_slots),
                })
                self._json(HTTPStatus.OK, {
                    "run_id": run_id,
                    "model": model,
                    "filled": fill_result.model_dump(mode="json"),
                })
                return

            if self.path == "/api/config-agent/classify":
                preferred_coverage = payload.get("preferred_coverage") or payload.get("target_coverage") or []
                if not isinstance(preferred_coverage, list):
                    raise ValueError("preferred_coverage must be a list of A×L cell IDs")
                agent = ConfigAgent(api_key=api_key, model=model, provider=provider)
                result = agent.classify_coverage(
                    task_description,
                    fixed_scenario=fixed_scenario,
                    preferred_coverage=[str(c) for c in preferred_coverage],
                    run_id=run_id,
                    progress=lambda event, details: _log_event(run_id, event, details),
                )
                with RUN_STATUS_LOCK:
                    RUN_STATUS.setdefault(run_id, {})["result"] = result.model_dump(mode="json")
                    RUN_STATUS[run_id]["status"] = "completed"
                _log_event(run_id, "coverage_completed", {
                    "cells": len(result.candidate.coverage_candidates),
                })
                self._json(HTTPStatus.OK, {"result": result.model_dump(mode="json")})
                return

            if self.path == "/api/config-agent/extract":
                coverage_candidates = payload.get("coverage_candidates") or []
                if not isinstance(coverage_candidates, list) or not coverage_candidates:
                    raise ValueError("coverage_candidates must be a non-empty list")
                source_task_description = str(payload.get("source_task_description") or "").strip() or None
                narrative_parent_run_id = str(payload.get("narrative_parent_run_id") or "").strip() or None
                if narrative_parent_run_id and not re.fullmatch(r"agent-[a-z0-9-]{6,64}", narrative_parent_run_id):
                    raise ValueError("invalid narrative_parent_run_id")
                agent = ConfigAgent(api_key=api_key, model=model, provider=provider)
                result = agent.extract_jd(
                    task_description,
                    coverage_candidates=coverage_candidates,
                    task_title=str(payload.get("task_title") or "").strip() or "任务域模版",
                    scenario_summary=str(payload.get("scenario_summary") or "").strip(),
                    responsibility_boundaries=payload.get("responsibility_boundaries") or [],
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
                return

            source_task_description = str(payload.get("source_task_description") or "").strip() or None
            narrative_parent_run_id = str(payload.get("narrative_parent_run_id") or "").strip() or None
            if narrative_parent_run_id and not re.fullmatch(r"agent-[a-z0-9-]{6,64}", narrative_parent_run_id):
                raise ValueError("invalid narrative_parent_run_id")
            preferred_coverage = payload.get("preferred_coverage") or payload.get("target_coverage") or []
            if not isinstance(preferred_coverage, list):
                raise ValueError("preferred_coverage must be a list of A×L cell IDs")
            agent = ConfigAgent(api_key=api_key, model=model, provider=provider)
            result = agent.analyze(
                task_description,
                fixed_scenario=fixed_scenario,
                preferred_coverage=[str(c) for c in preferred_coverage],
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
            self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request", "message": str(exc)[:800]})
        except Exception as exc:
            from jsonschema.exceptions import ValidationError
            if isinstance(exc, ValidationError):
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_request", "message": str(exc)[:800]})
                return
            if isinstance(exc, ConfigAgentError):
                if "run_id" in locals():
                    _log_event(run_id, "run_failed", {"error": str(exc)[:500]})
                self._json(HTTPStatus.BAD_GATEWAY, {"error": "agent_error", "message": str(exc)})
                return
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
    print("API Keys are read from DEEPSEEK_API_KEY / GEMINI_API_KEY and are never sent to pipeline.html.")
    print(f"Event log: {LOG_PATH.relative_to(ROOT)}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
