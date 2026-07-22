"""Normalize the reviewed Markdown YAML catalogs after the 2026-07-22 tail renumbering.

The semantic migration is A15=审计日志, A16=合规申报, A17=安全包络.
This helper only restores deterministic A1..A17 / jd-0..jd-17 ordering and the
declared v2->v3 migration map; it does not create or rewrite business semantics.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
JD_PATH = ROOT / "JD业务变量字典_66槽位_机读版.md"
AXL_PATH = ROOT / "AxL责任定义字典_17A_68单元_机读版.md"
BLOCK_RE = re.compile(
    r"(<!-- machine-readable-yaml:start -->\s*```yaml\s*)(.*?)(\s*```\s*<!-- machine-readable-yaml:end -->)",
    re.DOTALL,
)

ABILITY_MIGRATION = {
    "A7a": "A7",
    "A7b": "A8",
    "A8": "A9",
    "A9": "A10",
    "A10": "A11",
    "A11a": "A12",
    "A11b": "A13",
    "A12": "A14",
    "A15": "A15",
    "A13": "A16",
    "A14": "A17",
}
JD_MIGRATION = {
    "jd-7a": "jd-7",
    "jd-7b": "jd-8",
    "jd-8": "jd-9",
    "jd-9": "jd-10",
    "jd-10": "jd-11",
    "jd-11a": "jd-12",
    "jd-11b": "jd-13",
    "jd-12": "jd-14",
    "jd-15": "jd-15",
    "jd-13": "jd-16",
    "jd-14": "jd-17",
}


def ability_number(value: str) -> int:
    return int(value.removeprefix("A"))


def jd_key(item: dict) -> tuple[int, int, int]:
    jd_id = item["id"]
    match = re.fullmatch(r"jd-(\d+)\.(\d+)", jd_id)
    if not match:
        raise ValueError(f"Unexpected JD ID: {jd_id}")
    owner, slot = (int(part) for part in match.groups())
    return (0 if owner == 0 else 1, owner, slot)


def normalize(path: Path, kind: str) -> None:
    text = path.read_text(encoding="utf-8")
    match = BLOCK_RE.search(text)
    if not match:
        raise ValueError(f"{path.name}: machine-readable YAML block not found")
    payload = yaml.safe_load(match.group(2))
    payload["ability_id_migration_v2_to_v3"] = ABILITY_MIGRATION
    if kind == "jd":
        payload["jd_local_prefix_migration_v2_to_v3"] = JD_MIGRATION
        payload["variables"] = sorted(payload["variables"], key=jd_key)
        reverse = payload.get("reverse_index_by_a") or {}
        payload["reverse_index_by_a"] = {
            ability_id: reverse[ability_id]
            for ability_id in sorted(reverse, key=ability_number)
        }
    else:
        payload["abilities"] = sorted(
            payload["abilities"], key=lambda item: ability_number(item["a_id"])
        )
        payload["flat_a_by_l_index"] = sorted(
            payload["flat_a_by_l_index"],
            key=lambda item: (ability_number(item["a_id"]), int(item["level"][1:])),
        )
    dumped = yaml.safe_dump(
        payload,
        allow_unicode=True,
        sort_keys=False,
        width=100000,
    ).rstrip()
    updated = text[: match.start()] + match.group(1) + dumped + match.group(3) + text[match.end() :]
    path.write_text(updated, encoding="utf-8")


normalize(JD_PATH, "jd")
normalize(AXL_PATH, "axl")
print("Normalized authoritative JD and A×L Markdown YAML ordering.")
