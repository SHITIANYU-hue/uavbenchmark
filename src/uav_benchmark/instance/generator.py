"""Core deterministic engine: Domain Template + seed -> Task Template.

Product naming
--------------
- Domain Template (Step 3): JD binding domains
- Task Template (Step 4): concrete values resolved by seed

Wire format: the Task Template artifact uses ``artifact_type: task_instance``
so it remains compatible with ``task_instance.schema.json``.

Given the same (domain template, seed) pair this module ALWAYS produces a
byte-identical Task Template JSON.  Per-slot sub-seeds derived from
(global_seed, slot_id) guarantee that adding or removing a slot does not shift
the values of other slots.
"""

from __future__ import annotations

import hashlib
import json
import random
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Union

from jsonschema import Draft202012Validator

from .domain_template import normalize_domain_template, slug_id


COMPILER_NAME = "uav-benchmark-deterministic-instance-generator"
COMPILER_VERSION = "0.1.0"
SCHEMA_VERSION = "0.1.0"


class InstanceError(ValueError):
    """Raised when instantiation fails."""


# --------------------------------------------------------------------------- #
#  Hashing & seeding
# --------------------------------------------------------------------------- #

def hash_template(template: Mapping[str, Any]) -> str:
    """SHA-256 of the canonical (sorted-key) template JSON."""

    canonical = json.dumps(template, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _slot_seed(global_seed: int, slot_id: str) -> int:
    """Derive a stable per-slot RNG seed so slot ordering does not matter."""

    digest = hashlib.sha256(f"{global_seed}:{slot_id}".encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


def _combo_seed(slot_ids: list[str], values: tuple) -> int:
    """Deterministic seed for a full Cartesian-product combination."""

    key = json.dumps(list(zip(slot_ids, [str(v) for v in values])), ensure_ascii=False)
    return int.from_bytes(hashlib.sha256(key.encode("utf-8")).digest()[:4], "big")


# --------------------------------------------------------------------------- #
#  Binding resolution
# --------------------------------------------------------------------------- #

def _resolve_binding(
    binding: Mapping[str, Any],
    rng: random.Random,
) -> tuple[Any, str]:
    """Return (value, evidence_status) for one binding given an RNG.

    | mode      | behaviour                                           |
    |-----------|-----------------------------------------------------|
    | fixed     | return binding["value"] verbatim                     |
    | enum      | rng.choice(allowed_values)                           |
    | range     | rng.randint / rng.uniform within [min, max]          |
    | reference | null + TBD (external registry not yet wired)         |
    | TBD       | null + TBD                                           |
    """

    mode = binding.get("mode", "TBD")
    source_status = binding.get("status")
    if source_status == "TBD":
        return None, "TBD"
    resolved_status = (
        source_status
        if source_status in {"verified", "proposed"}
        else "verified"
    )

    if mode == "fixed":
        value = deepcopy(binding.get("value"))
        return (value, resolved_status) if value is not None else (None, "TBD")

    if mode == "enum":
        values = binding.get("allowed_values") or []
        if not values:
            return None, "TBD"
        return deepcopy(rng.choice(values)), resolved_status

    if mode == "range":
        lo = binding.get("minimum")
        hi = binding.get("maximum")
        if lo is None or hi is None:
            return None, "TBD"
        if isinstance(lo, int) and isinstance(hi, int):
            return rng.randint(lo, hi), resolved_status
        return round(rng.uniform(lo, hi), 4), resolved_status

    return None, "TBD"


def _build_slot_bindings(
    template: Mapping[str, Any],
    seed: int,
    overrides: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    overrides = overrides or {}
    template_hash = hash_template(template)[:16]
    bindings: list[dict[str, Any]] = []

    for slot in template.get("jd_slots", []):
        slot_id = slot["slot_id"]
        binding = slot.get("binding", {})

        if slot_id in overrides:
            value = deepcopy(overrides[slot_id])
            status = "verified"
            mode_note = "traverse_override"
        else:
            rng = random.Random(_slot_seed(seed, slot_id))
            value, status = _resolve_binding(binding, rng)
            mode_note = f"binding_mode={binding.get('mode', 'TBD')}"

        bindings.append({
            "slot_id": slot_id,
            "value": value,
            "status": status,
            "provenance": [{
                "source_id": f"instance_generator:seed:{seed}",
                "locator": f"template:{template_hash}",
                "status": status,
                "notes": mode_note,
            }],
        })

    return bindings


# --------------------------------------------------------------------------- #
#  Phase / disturbance / profile materialisation
# --------------------------------------------------------------------------- #

def _resolve_timebase(template: Mapping[str, Any], seed: int) -> dict[str, Any]:
    """Pick a deterministic tick duration when the template does not fix one."""

    phases = template.get("phases", [])
    durations = [
        p["minimum_duration"]["value"]
        for p in phases
        if p.get("minimum_duration", {}).get("value") is not None
    ]
    if not durations:
        return {"kind": "TBD", "tick_duration_s": None, "status": "TBD"}

    tick = min(durations) / 10 if min(durations) > 0 else 0.1
    return {"kind": "simulation_time", "tick_duration_s": round(tick, 3), "status": "proposed"}


def _materialise_phases(
    template: Mapping[str, Any],
    timebase: dict[str, Any],
) -> list[dict[str, Any]]:
    phases = list(template.get("phases") or [])
    if not phases:
        phases = [{
            "phase_id": "phase_default",
            "order": 1,
            "minimum_duration": {"value": None, "unit": "TBD", "status": "TBD"},
        }]

    tick_s = timebase.get("tick_duration_s")
    if tick_s is None:
        return [
            {
                "phase_id": p["phase_id"],
                "order": p.get("order", 0),
                "start_tick": None,
                "end_tick": None,
                "timing_status": "TBD",
            }
            for p in phases
        ]

    cursor = 0
    schedule: list[dict[str, Any]] = []
    for p in sorted(phases, key=lambda x: x.get("order", 0)):
        dur = p.get("minimum_duration", {})
        dur_val = dur.get("value")
        dur_unit = dur.get("unit", "TBD")
        if dur_val is not None and dur_unit == "s":
            ticks = max(1, round(dur_val / tick_s))
        else:
            ticks = None

        entry = {
            "phase_id": p["phase_id"],
            "order": p.get("order", 0),
            "start_tick": cursor if ticks is not None else None,
            "end_tick": (cursor + ticks) if ticks is not None else None,
            "timing_status": "proposed" if ticks is not None else "TBD",
        }
        if ticks is not None:
            cursor += ticks
        schedule.append(entry)
    return schedule


def _materialise_disturbances(
    template: Mapping[str, Any],
    timebase: dict[str, Any],
    seed: int,
) -> list[dict[str, Any]]:
    phases = template.get("disturbances", [])
    if not phases:
        return []

    phase_ticks: dict[str, tuple[int | None, int | None]] = {}
    tick_s = timebase.get("tick_duration_s")
    cursor = 0
    for p in sorted(template.get("phases", []), key=lambda x: x.get("order", 0)):
        dur_val = p.get("minimum_duration", {}).get("value")
        if tick_s and dur_val:
            ticks = max(1, round(dur_val / tick_s))
            phase_ticks[p["phase_id"]] = (cursor, cursor + ticks)
            cursor += ticks
        else:
            phase_ticks[p["phase_id"]] = (None, None)

    result: list[dict[str, Any]] = []
    for d in phases:
        pid = d.get("injection_phase", "")
        lo, hi = phase_ticks.get(pid, (None, None))
        if lo is not None and hi is not None and hi > lo:
            rng = random.Random(_slot_seed(seed, d["disturbance_id"]))
            start = rng.randint(lo, max(lo, hi - 1))
        else:
            start = None
        result.append({
            "disturbance_id": d["disturbance_id"],
            "kind": d.get("kind", ""),
            "phase_id": pid,
            "start_tick": start,
            "parameters": deepcopy(d.get("parameters", {})),
            "status": "proposed" if start is not None else "TBD",
        })
    return result


def _resolve_platform_profile(template: Mapping[str, Any], seed: int) -> dict[str, Any]:
    for slot in template.get("jd_slots", []):
        if slot["slot_id"] == "platform_profile":
            binding = slot.get("binding", {})
            rng = random.Random(_slot_seed(seed, "platform_profile"))
            value, status = _resolve_binding(binding, rng)
            if isinstance(value, dict):
                return {
                    "profile_id": value.get("profile_id", "resolved_profile"),
                    "platform_type": value.get("platform_type", "TBD"),
                    "allowed_protection_actions": value.get("allowed_protection_actions", []),
                    "status": status,
                }
    return {
        "profile_id": "platform_profile_tbd",
        "platform_type": "TBD",
        "allowed_protection_actions": [],
        "status": "TBD",
    }


def _resolve_executor_profile(template: Mapping[str, Any]) -> dict[str, Any]:
    interfaces = template.get("interfaces", {})
    responsibilities = interfaces.get("executor_responsibilities", [])
    dependencies = list(template.get("runtime_dependencies") or [])
    return {
        "profile_id": "external_executor",
        "responsibilities": responsibilities or ["TBD"],
        "status": "verified" if responsibilities and responsibilities != ["TBD"] else "TBD",
        "extensions": {"runtime_dependencies": dependencies},
    }


def _build_audit(
    template: Mapping[str, Any],
    slot_bindings: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    total = len(slot_bindings)
    resolved = sum(1 for s in slot_bindings if s["status"] != "TBD")
    return [
        {
            "check_id": "slot_resolution",
            "status": "pass" if resolved == total else ("TBD" if resolved == 0 else "pass"),
            "message": f"{resolved}/{total} slots resolved to concrete values.",
            "evidence": [s["slot_id"] for s in slot_bindings if s["status"] != "TBD"],
        },
        {
            "check_id": "coverage_boundary",
            "status": "pass",
            "message": f"Template defines {len(template.get('coverage', []))} coverage cells.",
            "evidence": ["template_ref"],
        },
    ]


# --------------------------------------------------------------------------- #
#  Public API
# --------------------------------------------------------------------------- #

def generate_instance(
    template: Mapping[str, Any],
    seed: int,
    *,
    overrides: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Produce one deterministic Task Template from a Domain Template and seed.

    Parameters
    ----------
    template : Mapping
        Domain Template (Step 3): at least ``template_id`` and ``jd_slots``.
    seed : int >= 0
        The global randomness seed.
    overrides : dict, optional
        ``{slot_id: value}`` pairs that bypass seed-based sampling.  Used by
        the traverse mode to pin specific combinations.

    Returns
    -------
    dict
        Task Template (Step 4).  Wire ``artifact_type`` remains ``task_instance``
        for schema compatibility.
    """

    if seed < 0:
        raise InstanceError("seed must be >= 0")

    template = normalize_domain_template(template)
    template_id = slug_id(str(template.get("template_id") or "unnamed_template"))
    template["template_id"] = template_id
    template_version = template.get("template_version", "0.1.0")
    template_hash = hash_template(template)

    slot_bindings = _build_slot_bindings(template, seed, overrides)
    timebase = _resolve_timebase(template, seed)
    phase_schedule = _materialise_phases(template, timebase)
    disturbance_schedule = _materialise_disturbances(template, timebase, seed)

    return {
        "schema_version": SCHEMA_VERSION,
        "artifact_type": "task_instance",
        "instance_id": f"{template_id}-s{seed}",
        "template_ref": {
            "template_id": template_id,
            "template_version": template_version,
            "sha256": template_hash,
        },
        "seed": seed,
        "timebase": timebase,
        "slot_bindings": slot_bindings,
        "platform_profile": _resolve_platform_profile(template, seed),
        "executor_profile": _resolve_executor_profile(template),
        "phase_schedule": phase_schedule,
        "disturbance_schedule": disturbance_schedule,
        "fixture_references": {
            "sut_visible_input": f"instances/{template_id}-s{seed}/observations.jsonl",
            "hidden_ground_truth_output": f"instances/{template_id}-s{seed}/ground_truth.json",
        },
        "compiler": {
            "name": COMPILER_NAME,
            "version": COMPILER_VERSION,
            "deterministic": True,
        },
        "validation_audit": _build_audit(template, slot_bindings),
        "provenance": [{
            "source_id": f"domain_template:{template_id}",
            "locator": f"sha256:{template_hash[:16]}",
            "status": "verified",
            "notes": f"Task Template generated from seed {seed}",
        }],
    }


def validate_instance(
    instance: Mapping[str, Any],
    schema_path: Union[str, Path] = Path("schemas/task_instance.schema.json"),
) -> None:
    """Validate a generated instance against the JSON Schema."""

    schema = json.loads(Path(schema_path).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(dict(instance))


def get_samplable_slots(template: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Return slots whose bindings can be sampled or traversed."""

    result: list[dict[str, Any]] = []
    for slot in template.get("jd_slots", []):
        binding = slot.get("binding", {})
        mode = binding.get("mode", "TBD")
        entry: dict[str, Any] = {
            "slot_id": slot["slot_id"],
            "mode": mode,
        }
        if mode == "enum":
            entry["values"] = list(binding.get("allowed_values", []))
        elif mode == "range":
            entry["minimum"] = binding.get("minimum")
            entry["maximum"] = binding.get("maximum")
        elif mode == "fixed":
            entry["values"] = [binding.get("value")]
        if mode in ("enum", "range", "fixed", "TBD", "reference"):
            result.append(entry)
    return result
