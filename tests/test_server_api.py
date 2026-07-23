from __future__ import annotations

import json
import threading
from contextlib import contextmanager
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit

from uav_benchmark.agent.server import PipelineRequestHandler
from uav_benchmark.instance.domain_template import build_domain_template


@contextmanager
def _pipeline_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), PipelineRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _request_json(url: str, method: str, payload: dict | None = None) -> tuple[int, dict]:
    parsed = urlsplit(url)
    connection = HTTPConnection(parsed.hostname, parsed.port, timeout=3)
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {} if body is None else {"Content-Type": "application/json"}
    try:
        connection.request(
            method,
            parsed.path + (f"?{parsed.query}" if parsed.query else ""),
            body=body,
            headers=headers,
        )
        response = connection.getresponse()
        raw = response.read().decode("utf-8")
        return response.status, json.loads(raw)
    finally:
        connection.close()


def _get_json(url: str) -> tuple[int, dict]:
    return _request_json(url, "GET")


def _post_json(url: str, payload: dict) -> tuple[int, dict]:
    return _request_json(url, "POST", payload)


def test_jd_tree_slice_endpoint_returns_bounded_v2_nodes() -> None:
    with _pipeline_server() as base_url:
        status, payload = _get_json(
            f"{base_url}/api/jd-tree/slice?ability=A6&include_global=false"
        )

    assert status == 200
    assert payload["schema_version"] == "2.3"
    assert payload["catalog_version"] == "2.4.0-merged"
    assert payload["selected_node_count"] == 17
    assert {node["owner_a"] for node in payload["nodes"]} == {"A6"}
    assert payload["metrics_apply_by_default"] is False
    assert payload["metric_status"] == "candidate"


def test_health_reports_the_team_delivered_v2_identity() -> None:
    with _pipeline_server() as base_url:
        status, payload = _get_json(f"{base_url}/api/health")

    assert status == 200
    assert payload["jd_tree"]["source_tree"] == "jd_variable_tree_version2.json"
    assert payload["jd_tree"]["schema_version"] == "2.3"
    assert payload["jd_tree"]["catalog_version"] == "2.4.0-merged"
    assert payload["jd_tree"]["node_count"] == 444


def test_jd_tree_slice_endpoint_rejects_unknown_ability() -> None:
    with _pipeline_server() as base_url:
        status, payload = _get_json(
            f"{base_url}/api/jd-tree/slice?ability=A99&include_global=false"
        )

    assert status == 400
    assert payload["error"] == "invalid_jd_tree_slice"


def test_jd_tree_domain_endpoint_filters_by_native_v2_group() -> None:
    with _pipeline_server() as base_url:
        status, payload = _get_json(
            f"{base_url}/api/jd-tree/domains?node_id=jd-6.1"
        )

    assert status == 200
    assert payload["selected_node_ids"] == ["jd-6.1"]
    assert set(payload["slots"]) == {"jd-6.1"}
    assert payload["slots"]["jd-6.1"]["nodes"][0]["node_path"][:2] == [
        "A6",
        "jd-6.1",
    ]


def test_task_template_generate_uses_one_deterministic_contract() -> None:
    domain = build_domain_template(
        task_title="V2 API contract",
        jd_edits=[{
            "slot_id": "jd-6.1.1",
            "name": "目标类型集",
            "binding_mode": "enum",
            "allowed_values": ["target", "obstacle"],
        }],
    )

    with _pipeline_server() as base_url:
        status, payload = _post_json(
            f"{base_url}/api/task-template/generate",
            {"domain_template": domain, "seed": 7},
        )

    assert status == 200
    assert payload["task_template"] == payload["instance"]
    assert payload["task_template"] == payload["task"]
    assert payload["task_template"]["artifact_type"] == "task_instance"
    assert payload["task_template"]["seed"] == 7
    assert "quality" not in payload["task_template"]
    assert "protocols" not in payload["task_template"]
    assert "scoring" not in payload["task_template"]


def test_legacy_template_payload_uses_same_task_contract_without_defaults() -> None:
    domain = build_domain_template(
        task_title="legacy payload",
        jd_edits=[{
            "slot_id": "jd-6.2.1",
            "name": "感知模态集",
            "binding_mode": "fixed",
            "value": "RGB",
        }],
    )

    with _pipeline_server() as base_url:
        status, payload = _post_json(
            f"{base_url}/api/task-template/generate",
            {
                "ability": "A6",
                "template": domain,
                "seed": 3,
                "scoring": {"SR": True},
            },
        )

    assert status == 200
    assert payload["task"] == payload["task_template"]
    assert payload["task"]["slot_bindings"][0]["value"] == "RGB"
    assert "scoring" not in payload["task"]
