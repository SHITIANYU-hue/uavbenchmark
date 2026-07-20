"""Build the Config Agent knowledge catalog from reviewed Markdown dictionaries.

The Markdown files remain the human-reviewable sources.  This script extracts
their fenced YAML payloads, validates the 17 A / 68 A×L / 66 JD contracts, and
writes deterministic JSON used by the local Config Agent.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
AXL_SOURCE = ROOT / "AxL责任定义字典_17A_68单元_机读版.md"
JD_SOURCE = ROOT / "JD业务变量字典_66槽位_机读版.md"
KNOWLEDGE_DIR = ROOT / "knowledge"
LEVELS = ("L1", "L2", "L3", "L4")
ABILITY_ID_SCHEME = "ability-id-v3-2026-07-20"
EXPECTED_ABILITY_IDS = (
    "A1", "A2", "A3", "A4", "A5",
    "A6", "A7", "A8", "A9",
    "A10", "A11",
    "A12", "A13",
    "A14", "A15",
    "A16", "A17",
)
EXPECTED_ABILITY_GROUPS = {
    "A1": "G1", "A2": "G1", "A3": "G1", "A4": "G1", "A5": "G1",
    "A6": "G2", "A7": "G2", "A8": "G2", "A9": "G2",
    "A10": "G3", "A11": "G3",
    "A12": "G4", "A13": "G4",
    "A14": "G5", "A15": "G5",
    "A16": "G6", "A17": "G6",
}


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _extract_yaml(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    match = re.search(
        r"<!-- machine-readable-yaml:start -->\s*```yaml\s*(.*?)\s*```\s*"
        r"<!-- machine-readable-yaml:end -->",
        text,
        flags=re.DOTALL,
    )
    if match is None:
        raise ValueError(f"{path.name}: machine-readable YAML block not found")
    payload = yaml.safe_load(match.group(1))
    if not isinstance(payload, dict):
        raise ValueError(f"{path.name}: YAML root must be a mapping")
    return payload


def _source_line(path: Path, needle: str) -> int:
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.strip() == needle:
            return number
    raise ValueError(f"{path.name}: source marker not found: {needle}")


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _ordered_union(items: list[list[str]]) -> list[str]:
    result: list[str] = []
    for group in items:
        for item in group:
            if item not in result:
                result.append(item)
    return result


def build_catalog() -> dict[str, Any]:
    axl = _extract_yaml(AXL_SOURCE)
    jd = _extract_yaml(JD_SOURCE)

    variables = jd.get("variables") or []
    jd_by_id = {item["id"]: item for item in variables}
    if len(variables) != 66 or len(jd_by_id) != 66:
        raise ValueError("JD dictionary must contain 66 unique variables")
    if sum(item["scope"] == "global" for item in variables) != 10:
        raise ValueError("JD dictionary must contain 10 global variables")
    if sum(item["scope"] == "local" for item in variables) != 56:
        raise ValueError("JD dictionary must contain 56 local variables")

    abilities = axl.get("abilities") or []
    ability_by_id = {item["a_id"]: item for item in abilities}
    if len(abilities) != 17 or len(ability_by_id) != 17:
        raise ValueError("A×L dictionary must contain 17 unique abilities")
    if tuple(item["a_id"] for item in abilities) != EXPECTED_ABILITY_IDS:
        raise ValueError(
            "A×L dictionary must use ability-id-v3 order: "
            + ", ".join(EXPECTED_ABILITY_IDS)
        )
    actual_groups = {item["a_id"]: item["g_group"] for item in abilities}
    if actual_groups != EXPECTED_ABILITY_GROUPS:
        raise ValueError("A×L dictionary ability-to-group mapping does not match ability-id-v3")
    if axl.get("ability_id_scheme") != ABILITY_ID_SCHEME:
        raise ValueError(f"A×L dictionary must use {ABILITY_ID_SCHEME}")
    if jd.get("ability_id_scheme") != ABILITY_ID_SCHEME:
        raise ValueError(f"JD dictionary must use {ABILITY_ID_SCHEME}")
    if axl.get("ability_id_migration") != jd.get("ability_id_migration"):
        raise ValueError("A×L and JD dictionaries must declare the same v1->v2 ability ID migration")
    if axl.get("ability_id_migration_v2_to_v3") != jd.get("ability_id_migration_v2_to_v3"):
        raise ValueError("A×L and JD dictionaries must declare the same v2->v3 ability ID migration")

    for item in variables:
        if item["scope"] != "local":
            continue
        owner = item.get("owner_a")
        if owner not in ability_by_id:
            raise ValueError(f"{item['id']}: unknown local owner {owner!r}")
        expected_prefix = f"jd-{owner[1:].lower()}."
        if not item["id"].startswith(expected_prefix):
            raise ValueError(
                f"{item['id']}: local ID must follow owner {owner} prefix {expected_prefix}"
            )

    flat_cells = axl.get("flat_a_by_l_index") or []
    if len(flat_cells) != 68 or len({item["cell"] for item in flat_cells}) != 68:
        raise ValueError("A×L dictionary must contain 68 unique cells")

    expected_cells = {
        f"{ability['a_id']}×{level}"
        for ability in abilities
        for level in LEVELS
    }
    if {item["cell"] for item in flat_cells} != expected_cells:
        raise ValueError("A×L flat index is missing or adds cells")

    enriched_cells: list[dict[str, Any]] = []
    referenced_jd: set[str] = set()
    for item in flat_cells:
        ability = ability_by_id[item["a_id"]]
        level = item["level"]
        expected_inherits = list(LEVELS[: LEVELS.index(level)])
        if item.get("inherits_levels") != expected_inherits:
            raise ValueError(f"{item['cell']}: invalid cumulative inheritance")
        nested = ability["levels"][level]
        for key in ("responsibility", "jd_refs", "inherits_levels"):
            if item.get(key) != nested.get(key):
                raise ValueError(f"{item['cell']}: flat and nested {key} differ")

        cumulative_levels = expected_inherits + [level]
        cumulative_responsibilities = [
            ability["levels"][current]["responsibility"] for current in cumulative_levels
        ]
        required_jd = _ordered_union([
            ability["levels"][current].get("jd_refs") or [] for current in cumulative_levels
        ])
        unknown = set(required_jd) - set(jd_by_id)
        if unknown:
            raise ValueError(f"{item['cell']}: unknown JD references {sorted(unknown)}")
        referenced_jd.update(required_jd)
        source_line = _source_line(AXL_SOURCE, f"- cell: {item['cell']}")
        enriched_cells.append({
            **item,
            "cumulative_levels": cumulative_levels,
            "cumulative_responsibilities": cumulative_responsibilities,
            "required_jd_ids": required_jd,
            "source_ref": f"{AXL_SOURCE.name}:{source_line}",
        })

    jd_fields: list[dict[str, Any]] = []
    for item in variables:
        source_line = _source_line(JD_SOURCE, f"- id: {item['id']}")
        jd_fields.append({
            **item,
            "source_ref": f"{JD_SOURCE.name}:{source_line}",
            "extraction_rule": (
                "只绑定用户原文或人工确认值；缺失时保持 TBD。不得生成未提供的阈值、"
                "业务规则、平台能力或 simulator 接口。"
            ),
        })

    for ability in abilities:
        declared = set(ability.get("global_jd") or []) | set(ability.get("local_jd") or [])
        unknown = declared - set(jd_by_id)
        if unknown:
            raise ValueError(f"{ability['a_id']}: unknown declared JD {sorted(unknown)}")

    source_versions = {
        "axl": axl["schema_version"],
        "jd": jd["schema_version"],
    }
    source_sha256 = {
        AXL_SOURCE.name: _sha256(AXL_SOURCE),
        JD_SOURCE.name: _sha256(JD_SOURCE),
    }
    catalog = {
        "catalog_version": "full-17A-68AxL-66JD-ability-id-v3-2026-07-20",
        "scope": "full_17A_L1_L4_66JD_catalog",
        "ability_id_scheme": ABILITY_ID_SCHEME,
        "ability_id_migration": axl["ability_id_migration"],
        "ability_id_migration_v2_to_v3": axl["ability_id_migration_v2_to_v3"],
        "jd_local_prefix_migration": jd["jd_local_prefix_migration"],
        "jd_local_prefix_migration_v2_to_v3": jd[
            "jd_local_prefix_migration_v2_to_v3"
        ],
        "source_versions": source_versions,
        "source_sha256": source_sha256,
        "warning": (
            "A×L 责任定义为累计式；目标等级必须包含全部低等级责任。"
            "未知 threshold、业务规则、平台能力和 simulator 接口必须返回 TBD。"
        ),
        "counts": {
            "g_groups": 6,
            "abilities": len(abilities),
            "levels": 4,
            "gal_cells": len(enriched_cells),
            "jd_fields": len(jd_fields),
            "global_jd": 10,
            "local_jd": 56,
        },
        "level_policy": axl["level_policy"],
        "same_case_leveling_rule": axl["same_case_leveling_rule"],
        "abilities": [{
            "a_id": item["a_id"],
            "g_group": item["g_group"],
            "ability": item["ability"],
            "global_jd": item.get("global_jd") or [],
            "local_jd": item.get("local_jd") or [],
        } for item in abilities],
        "gal_cells": enriched_cells,
        "jd_fields": jd_fields,
        "global_rules": [
            "threshold、正式业务规则、平台能力和 simulator 接口不得由 Agent 发明。",
            "正式评分 Coverage 与 runtime dependency 必须分离。",
            "外部执行器完成的动作不得归因给 SUT。",
            "任务候选必须引用人工确认稿，场景固定值必须引用版本化场景来源。",
            "自然语言模板只表达业务语义，不暴露 A×L、GAL 或 JD 内部编号；JD 保存在结构化结果中。",
            "A×L 等级责任累计：目标 L2/L3/L4 必须包含全部较低等级责任。",
            "所有产物必须保存 A×L 与 JD 源字典的 schema_version。",
        ],
    }

    report = {
        "status": "pass",
        "catalog_version": catalog["catalog_version"],
        "ability_id_scheme": ABILITY_ID_SCHEME,
        "ability_id_migration": catalog["ability_id_migration"],
        "ability_id_migration_v2_to_v3": catalog[
            "ability_id_migration_v2_to_v3"
        ],
        "jd_local_prefix_migration": catalog["jd_local_prefix_migration"],
        "jd_local_prefix_migration_v2_to_v3": catalog[
            "jd_local_prefix_migration_v2_to_v3"
        ],
        "source_versions": source_versions,
        "source_sha256": source_sha256,
        "validated_counts": catalog["counts"],
        "referenced_jd_count": len(referenced_jd),
        "unreferenced_jd_ids": sorted(set(jd_by_id) - referenced_jd),
        "legacy_semantic_conflicts": [
            {
                "legacy_slot_id": "jd-8.1",
                "slot_id": "jd-11.1",
                "legacy_name": "控制接口",
                "current_name": jd_by_id["jd-11.1"]["name"],
            },
            {
                "legacy_slot_id": "jd-8.2",
                "slot_id": "jd-11.2",
                "legacy_name": "控制约束",
                "current_name": jd_by_id["jd-11.2"]["name"],
            },
            {
                "legacy_slot_id": "jd-8.3",
                "slot_id": "jd-11.3",
                "legacy_name": "平台与执行包络",
                "current_name": jd_by_id["jd-11.3"]["name"],
            },
        ],
    }

    KNOWLEDGE_DIR.mkdir(exist_ok=True)
    _write_json(KNOWLEDGE_DIR / "jd_dictionary.json", {
        **jd,
        "source_document": JD_SOURCE.name,
        "source_sha256": source_sha256[JD_SOURCE.name],
    })
    _write_json(KNOWLEDGE_DIR / "axl_responsibility_catalog.json", {
        **axl,
        "source_document": AXL_SOURCE.name,
        "source_sha256": source_sha256[AXL_SOURCE.name],
    })
    _write_json(KNOWLEDGE_DIR / "agent_reference_catalog.json", catalog)
    _write_json(KNOWLEDGE_DIR / "catalog_build_report.json", report)
    return report


if __name__ == "__main__":
    print(json.dumps(build_catalog(), ensure_ascii=False, indent=2))
