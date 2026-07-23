"""Structured-output transports for selectable Config Agent providers.

The pipeline API is provider-neutral.  Provider adapters own SDK-specific
request/response handling while the Agent service keeps one set of prompts,
catalog lookups, validators, and artifacts.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any


SUPPORTED_PROVIDERS = ("deepseek", "gemini")


class ProviderError(RuntimeError):
    """A user-safe provider failure."""


@dataclass
class StructuredResponse:
    """Provider-independent structured model response."""

    raw_text: str
    parsed: Any | None
    finish_reason: str | None
    reasoning: str | None
    usage: dict[str, int | float | str | None]


def gemini_accepts_temperature(model: str) -> bool:
    """Whether a Gemini model still accepts the legacy sampling parameter.

    Gemini 3.6 Flash and Gemini 3.5 Flash-Lite deprecate ``temperature``.
    Omitting it keeps generateContent requests compatible with those models
    while older configured models can retain the existing behavior.
    """

    normalized = model.strip().lower()
    return not normalized.startswith(("gemini-3.6-flash", "gemini-3.5-flash-lite"))


def proxy_client_args() -> dict[str, Any]:
    """Prefer one explicit SOCKS proxy when the environment declares several.

    On macOS proxy tools commonly export HTTP_PROXY, HTTPS_PROXY, and
    ALL_PROXY together.  httpx otherwise chooses the HTTPS entry for an HTTPS
    request, which can produce TLS EOF errors on mixed proxy ports.  An
    explicit ``UAV_LLM_PROXY`` wins; otherwise a configured SOCKS ALL_PROXY is
    preferred because the project installs socksio.
    """

    explicit = os.environ.get("UAV_LLM_PROXY", "").strip()
    all_proxy = os.environ.get("ALL_PROXY", "").strip() or os.environ.get("all_proxy", "").strip()
    proxy = explicit or (all_proxy if all_proxy.lower().startswith(("socks5://", "socks5h://")) else "")
    return {"proxy": proxy, "trust_env": False} if proxy else {}


def response_schema(model_cls: type[Any]) -> dict[str, Any]:
    """Return a transport-safe Pydantic JSON schema.

    Gemini rejects ``additionalProperties`` in some response-schema paths.
    Local Pydantic validation remains strict after the response returns.
    """

    def sanitize(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: sanitize(item)
                for key, item in value.items()
                if key != "additionalProperties"
            }
        if isinstance(value, list):
            return [sanitize(item) for item in value]
        return value

    return sanitize(model_cls.model_json_schema())


def schema_instruction(model_cls: type[Any]) -> str:
    schema_text = json.dumps(response_schema(model_cls), ensure_ascii=False, indent=2)
    return (
        "\n\nYou must respond with a single valid JSON object that strictly "
        "conforms to the following JSON Schema. Output ONLY the raw JSON "
        "object—no markdown fences, no commentary, no surrounding text:\n\n"
        + schema_text
    )


def _provider_message(provider: str, exc: Exception) -> ProviderError:
    message = str(exc)
    upper = message.upper()
    label = "Gemini" if provider == "gemini" else "DeepSeek"
    if "API_KEY" in upper or "401" in message or "403" in message or "UNAUTHENTICATED" in upper:
        return ProviderError(f"{label} API Key 无效、无权限或对应模型不可用。")
    if "429" in message or "RESOURCE_EXHAUSTED" in upper or "RATE LIMIT" in upper:
        return ProviderError(f"{label} 请求频率已达到当前额度（429）。请稍后重试。")
    if "503" in message or "UNAVAILABLE" in upper or "HIGH DEMAND" in upper:
        return ProviderError(f"{label} 当前临时高负载（503）。本次输入与 Run ID 已保存，请稍后重试。")
    if "CONNECTION" in upper or "CONNECT" in upper:
        return ProviderError(f"无法连接 {label} 服务：{message[:240]}")
    return ProviderError(f"{label} 调用失败：{message[:240]}")


class DeepSeekProvider:
    name = "deepseek"

    def __init__(self, api_key: str, model: str) -> None:
        try:
            import httpx
        except ImportError as exc:  # pragma: no cover - installation failure
            raise ProviderError("缺少 DeepSeek HTTP 依赖，请重新安装项目的 agent 依赖。") from exc
        self.model = model
        self.endpoint = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/") + "/chat/completions"
        try:
            self.client = httpx.Client(
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                timeout=90.0,
                **proxy_client_args(),
            )
        except Exception as exc:
            if "socksio" in str(exc).lower():
                raise ProviderError("检测到 SOCKS 代理但缺少 socksio，请重新安装项目的 agent 依赖。") from exc
            raise _provider_message(self.name, exc) from exc

    def generate(
        self,
        *,
        system_instruction: str,
        user_content: str,
        response_model: type[Any],
        temperature: float,
        max_output_tokens: int,
    ) -> StructuredResponse:
        messages = [
            {"role": "system", "content": system_instruction + schema_instruction(response_model)},
            {"role": "user", "content": user_content},
        ]
        try:
            response = self.client.post(
                self.endpoint,
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_output_tokens,
                    "response_format": {"type": "json_object"},
                },
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:
            raise _provider_message(self.name, exc) from exc

        choices = payload.get("choices") or []
        if not choices:
            raise ProviderError("DeepSeek 返回中没有候选结果。")
        choice = choices[0]
        message = choice.get("message") or {}
        usage: dict[str, int | float | str | None] = {}
        raw_usage = payload.get("usage") or {}
        if raw_usage:
            for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
                value = raw_usage.get(key)
                if isinstance(value, (int, float)):
                    usage[key] = value
        return StructuredResponse(
            raw_text=message.get("content") or "",
            parsed=None,
            finish_reason=str(choice.get("finish_reason")) if choice.get("finish_reason") else None,
            reasoning=message.get("reasoning_content") or None,
            usage=usage,
        )


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str) -> None:
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:  # pragma: no cover - installation failure
            raise ProviderError("缺少 Gemini 依赖，请重新安装项目的 agent 依赖。") from exc
        self.model = model
        self._types = types
        try:
            self.client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(
                    timeout=90_000,
                    retry_options=types.HttpRetryOptions(attempts=2),
                    client_args=proxy_client_args() or None,
                    async_client_args=proxy_client_args() or None,
                ),
            )
        except Exception as exc:
            if "socksio" in str(exc).lower():
                raise ProviderError("检测到 SOCKS 代理但缺少 socksio，请重新安装项目的 agent 依赖。") from exc
            raise _provider_message(self.name, exc) from exc

    def generate(
        self,
        *,
        system_instruction: str,
        user_content: str,
        response_model: type[Any],
        temperature: float,
        max_output_tokens: int,
    ) -> StructuredResponse:
        response = None
        for attempt in range(2):
            try:
                config_args: dict[str, Any] = {
                    "system_instruction": system_instruction,
                    "max_output_tokens": max_output_tokens,
                    "response_mime_type": "application/json",
                    "response_schema": response_schema(response_model),
                }
                if gemini_accepts_temperature(self.model):
                    config_args["temperature"] = temperature
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=user_content,
                    config=self._types.GenerateContentConfig(**config_args),
                )
                break
            except Exception as exc:
                retryable_tls = any(marker in str(exc).upper() for marker in ("UNEXPECTED_EOF", "SSL", "TLS"))
                if attempt == 0 and retryable_tls:
                    continue
                raise _provider_message(self.name, exc) from exc
        if response is None:  # pragma: no cover - defensive guard
            raise ProviderError("Gemini 未返回响应。")

        parsed = getattr(response, "parsed", None)
        usage: dict[str, int | float | str | None] = {}
        usage_metadata = getattr(response, "usage_metadata", None)
        if usage_metadata is not None:
            raw_usage = usage_metadata.model_dump(exclude_none=True)
            for key, value in raw_usage.items():
                if isinstance(value, (int, float, str)) or value is None:
                    usage[key] = value
        candidates = getattr(response, "candidates", None) or []
        finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
        return StructuredResponse(
            raw_text=getattr(response, "text", "") or "",
            parsed=parsed,
            finish_reason=str(finish_reason) if finish_reason else None,
            reasoning=None,
            usage=usage,
        )


def create_provider(provider: str, *, api_key: str, model: str) -> DeepSeekProvider | GeminiProvider:
    normalized = provider.strip().lower()
    if normalized == "deepseek":
        return DeepSeekProvider(api_key, model)
    if normalized == "gemini":
        return GeminiProvider(api_key, model)
    raise ProviderError(f"不支持的模型 Provider：{provider}")
