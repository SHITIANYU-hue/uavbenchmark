"""Build a Domain Template (Step 3) ready for Seed → Task Template (Step 4).

Product naming
--------------
- Domain Template: JD binding domains + coverage (input to the seed engine)
- Task Template:   Domain Template + seed → concrete slot values

Wire-format note: Domain Template is shaped like ``task_template.schema.json``
(minimal fields required by the seed engine).  Task Template artifacts use the
``task_instance`` schema ``artifact_type`` for contract compatibility.
"""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence


def slug_id(raw: str, *, fallback: str = "tpl", max_len: int = 48) -> str:
    """Convert an arbitrary title into a schema-safe ASCII id."""

    text = (raw or "").strip()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^A-Za-z0-9._:-]+", "_", text)
    text = text.strip("._:-")
    if not text or not re.match(r"^[A-Za-z0-9]", text):
        text = f"{fallback}_{text}" if text else fallback
    return text[:max_len]


def _binding_from_edit(edit: Mapping[str, Any]) -> dict[str, Any]:
    mode = edit.get("binding_mode") or edit.get("mode") or "TBD"
    binding: dict[str, Any] = {"mode": mode, "status": "verified"}
    if mode == "fixed":
        binding["value"] = edit.get("value")
        if edit.get("value") is None:
            binding["status"] = "TBD"
    elif mode == "enum":
        values = list(edit.get("allowed_values") or [])
        binding["allowed_values"] = values
        if edit.get("value") is not None:
            binding["value"] = edit.get("value")
        if not values:
            binding["status"] = "TBD"
    elif mode == "range":
        binding["minimum"] = edit.get("minimum")
        binding["maximum"] = edit.get("maximum")
        if edit.get("minimum") is None or edit.get("maximum") is None:
            binding["status"] = "TBD"
    else:
        binding["mode"] = "TBD"
        binding["status"] = "TBD"
    return binding


def build_domain_template(
    *,
    task_title: str,
    scenario_summary: str = "",
    coverage: Sequence[Mapping[str, Any]] | None = None,
    jd_edits: Sequence[Mapping[str, Any]] | None = None,
    template_version: str = "0.1.0",
) -> dict[str, Any]:
    """Assemble a Domain Template from Agent + Step-3 domain edits."""

    template_id = slug_id(task_title, fallback="domain_tpl")
    # Keep agent coverage cells as lightweight records for the seed engine.
    # Full task_template.schema coverage shape is filled by the offline compiler.
    coverage_list: list[dict[str, Any]] = []
    for item in coverage or []:
        cell = item.get("cell") or item.get("coverage_id")
        if not cell:
            continue
        coverage_list.append(dict(item))

    jd_slots: list[dict[str, Any]] = []
    for edit in jd_edits or []:
        slot_id = edit.get("slot_id")
        if not slot_id:
            continue
        jd_slots.append({
            "slot_id": slot_id,
            "description": edit.get("name") or edit.get("description") or slot_id,
            "visibility": "sut_visible",
            "binding": _binding_from_edit(edit),
            "provenance": [{
                "source_id": "domain_template_editor",
                "locator": slot_id,
                "status": "verified",
                "notes": "Edited in Step 3 Domain Template",
            }],
        })

    return {
        "template_id": template_id,
        "template_version": template_version,
        "title": task_title or template_id,
        "scenario_summary": scenario_summary or "",
        "coverage": coverage_list,
        "jd_slots": jd_slots,
        "phases": [{
            "phase_id": "phase_default",
            "order": 1,
            "entry_conditions": [],
            "exit_conditions": [],
            "minimum_duration": {"value": None, "unit": "TBD", "status": "TBD"},
        }],
        "disturbances": [],
        "interfaces": {"executor_responsibilities": ["TBD"]},
        "provenance": [{
            "source_id": "pipeline:step3_domain_template",
            "locator": template_id,
            "status": "verified",
            "notes": "Built from Agent candidate and Domain Template edits",
        }],
    }


def normalize_domain_template(template: Mapping[str, Any]) -> dict[str, Any]:
    """Fill missing seed-engine fields on a partial Domain Template from the UI."""

    data = dict(template)
    raw_id = str(data.get("template_id") or data.get("title") or "domain_tpl")
    data["template_id"] = slug_id(raw_id, fallback="domain_tpl")
    data.setdefault("template_version", "0.1.0")
    data.setdefault("title", data["template_id"])
    data.setdefault("coverage", [])
    data.setdefault("jd_slots", [])
    data.setdefault("disturbances", [])
    if not data.get("phases"):
        data["phases"] = [{
            "phase_id": "phase_default",
            "order": 1,
            "entry_conditions": [],
            "exit_conditions": [],
            "minimum_duration": {"value": None, "unit": "TBD", "status": "TBD"},
        }]
    interfaces = dict(data.get("interfaces") or {})
    interfaces.setdefault("executor_responsibilities", ["TBD"])
    data["interfaces"] = interfaces
    if not data.get("provenance"):
        data["provenance"] = [{
            "source_id": "pipeline:domain_template",
            "locator": data["template_id"],
            "status": "verified",
            "notes": "Normalized Domain Template",
        }]
    return data
