"""Offline checks for the provider-neutral Agent API and four-step UI."""

from __future__ import annotations

import re
from pathlib import Path

from uav_benchmark.agent.models import CoverageResult
from uav_benchmark.agent.providers import (
    gemini_accepts_temperature,
    proxy_client_args,
    response_schema,
)
from uav_benchmark.agent.server import _default_provider, _provider_health


ROOT = Path(__file__).resolve().parents[1]


def test_transport_schema_is_accepted_by_gemini_subset() -> None:
    assert "additionalProperties" not in str(response_schema(CoverageResult))


def test_health_reports_deepseek_and_gemini(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "local-test-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_FLASH_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_LITE_MODEL", raising=False)
    monkeypatch.delenv("GEMINI_PRO_MODEL", raising=False)
    health = _provider_health()
    assert set(health) == {"deepseek", "gemini"}
    assert health["deepseek"]["ready"] is True
    assert health["gemini"]["ready"] is False
    assert health["gemini"]["models"] == {
        "flash": "gemini-3.6-flash",
        "lite": "gemini-3.5-flash-lite",
        "pro": "gemini-3.5-flash",
    }
    assert _default_provider(health) == "deepseek"


def test_default_provider_falls_back_to_available_key(monkeypatch) -> None:
    monkeypatch.setenv("UAV_LLM_PROVIDER", "deepseek")
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "local-test-key")
    assert _default_provider(_provider_health()) == "gemini"


def test_explicit_socks_proxy_wins_over_mixed_environment(monkeypatch) -> None:
    monkeypatch.delenv("UAV_LLM_PROXY", raising=False)
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:7890")
    monkeypatch.setenv("ALL_PROXY", "socks5://127.0.0.1:7890")
    assert proxy_client_args() == {"proxy": "socks5://127.0.0.1:7890", "trust_env": False}


def test_new_gemini_models_omit_deprecated_temperature() -> None:
    assert gemini_accepts_temperature("gemini-3.6-flash") is False
    assert gemini_accepts_temperature("gemini-3.5-flash-lite") is False
    assert gemini_accepts_temperature("gemini-3.5-flash") is True


def _ui_blob() -> str:
    html = (ROOT / "pipeline.html").read_text(encoding="utf-8")
    js_dir = ROOT / "pipeline" / "js"
    js = "\n".join(path.read_text(encoding="utf-8") for path in sorted(js_dir.glob("*.js")))
    css = (ROOT / "pipeline" / "css" / "app.css").read_text(encoding="utf-8")
    return html + "\n" + js + "\n" + css


def test_ui_keeps_team_flow_and_provider_checkpoint_controls() -> None:
    """Our 5-step UX is primary; keep ZYY provider select + checkpoint semantics."""
    blob = _ui_blob()
    html = (ROOT / "pipeline.html").read_text(encoding="utf-8")
    assert 'href="pipeline/css/app.css"' in html
    assert 'src="pipeline/js/main.js"' in html
    assert "特定任务模版" in blob
    assert "文案与 A×L" in blob
    assert "随机一批" in blob
    assert "用户侧配置需求" in blob
    assert "世界侧配置需求" in blob
    assert 'id="providerSelect"' in blob
    assert "provider: state.llmProvider" in blob
    assert "Gemini 3.6 Flash（默认）" in blob
    assert "Gemini 3.5 Flash Lite" in blob
    assert "let state = loadState();" in blob or "state = loadState();" in blob
    assert "已开始新任务；手动检查点仍可加载" in blob
    assert "已加载检查点 ✓" in blob
    assert "target_coverage" in blob


def test_ui_splits_coverage_step2_from_jd_extraction_step3() -> None:
    """STEP 2 fixes coverage; STEP 3 confirms a V2 slice before extraction."""
    blob = _ui_blob()
    # dedicated endpoints for the two-step split
    assert "/api/config-agent/classify" in blob
    assert "/api/config-agent/extract" in blob
    # STEP 3 runs (and can retry) extraction on its own
    assert "runExtraction" in blob
    assert "运行 JD 域提取" in blob
    assert "/api/jd-tree/selection/build" in blob
    assert "jd_tree_selection" in blob
    assert "tree.options[0]" not in blob
    assert "const DEFAULT_TARGET_LEVELS = {}" in blob
    assert "按 Seed 随机草案" in blob
    assert "随机结果只是草案" in blob


def test_server_exposes_classify_and_extract_endpoints() -> None:
    server_src = (ROOT / "src" / "uav_benchmark" / "agent" / "server.py").read_text(encoding="utf-8")
    assert '"/api/config-agent/classify"' in server_src
    assert '"/api/config-agent/extract"' in server_src


def test_pipeline_ui_is_split_into_modules() -> None:
    js_dir = ROOT / "pipeline" / "js"
    expected = {
        "constants.js", "utils.js", "state.js", "scenarios.js", "coverage.js",
        "jd.js", "jd_tree_v2.js", "agent.js", "persistence.js", "steps.js", "shell.js", "main.js",
    }
    assert expected <= {p.name for p in js_dir.glob("*.js")}
    assert (ROOT / "pipeline" / "css" / "app.css").is_file()
    html = (ROOT / "pipeline.html").read_text(encoding="utf-8")
    assert "<style>" not in html
    assert not re.search(r"<script(?![^>]*src=)", html)
