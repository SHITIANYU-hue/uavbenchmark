"""Offline checks for the provider-neutral Agent API and four-step UI."""

from __future__ import annotations

from pathlib import Path

from uav_benchmark.agent.models import CoverageResult
from uav_benchmark.agent.providers import proxy_client_args, response_schema
from uav_benchmark.agent.server import _default_provider, _provider_health


ROOT = Path(__file__).resolve().parents[1]


def test_transport_schema_is_accepted_by_gemini_subset() -> None:
    assert "additionalProperties" not in str(response_schema(CoverageResult))


def test_health_reports_deepseek_and_gemini(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "local-test-key")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    health = _provider_health()
    assert set(health) == {"deepseek", "gemini"}
    assert health["deepseek"]["ready"] is True
    assert health["gemini"]["ready"] is False
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


def test_ui_keeps_team_flow_and_adds_human_review_controls() -> None:
    html = (ROOT / "pipeline.html").read_text(encoding="utf-8")
    assert "特定任务模版" in html
    assert "可选：加载场景示例" in html
    assert 'id="providerSelect"' in html
    assert "changeCoverageLevel" in html
    assert "人工补充 Runtime Dependency" in html
    assert "完整 68 单元目录" in html
