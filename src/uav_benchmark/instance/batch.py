"""Batch instance generation: seed-range sampling and full-domain traversal."""

from __future__ import annotations

from itertools import product
from typing import Any, Mapping

from .generator import (
    _combo_seed,
    _resolve_binding,
    _slot_seed,
    generate_instance,
    get_samplable_slots,
)
import random


def parse_seed_spec(spec: str) -> list[int]:
    """Parse a seed specification string into a list of integers.

    Examples
    --------
    >>> parse_seed_spec("5")
    [5]
    >>> parse_seed_spec("0-4")
    [0, 1, 2, 3, 4]
    >>> parse_seed_spec("0,3,7")
    [0, 3, 7]
    >>> parse_seed_spec("0-2,5")
    [0, 1, 2, 5]
    """

    seeds: list[int] = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            lo_s, hi_s = part.split("-", 1)
            lo, hi = int(lo_s), int(hi_s)
            seeds.extend(range(lo, hi + 1))
        else:
            seeds.append(int(part))
    return seeds


def generate_batch(
    template: Mapping[str, Any],
    seeds: list[int],
) -> list[dict[str, Any]]:
    """Generate one instance per seed.  Deterministic and independent."""

    return [generate_instance(template, s) for s in seeds]


def traverse_domain(
    template: Mapping[str, Any],
    *,
    steps_per_range: int = 3,
) -> list[dict[str, Any]]:
    """Enumerate the full Cartesian product of all enum / range bindings.

    Each unique combination receives a deterministic seed derived from its
    slot-value tuple, so re-running produces identical instances.

    For ``range`` bindings the continuous interval is discretised into
    ``steps_per_range`` evenly spaced sample points.
    """

    samplable = get_samplable_slots(template)
    slot_ids: list[str] = []
    value_lists: list[list[Any]] = []

    for entry in samplable:
        mode = entry["mode"]
        if mode == "enum" and entry.get("values"):
            slot_ids.append(entry["slot_id"])
            value_lists.append(entry["values"])
        elif mode == "range":
            lo = entry.get("minimum")
            hi = entry.get("maximum")
            if lo is None or hi is None:
                continue
            slot_ids.append(entry["slot_id"])
            if isinstance(lo, int) and isinstance(hi, int):
                if hi - lo + 1 <= steps_per_range:
                    vals: list[Any] = list(range(lo, hi + 1))
                else:
                    step = max(1, (hi - lo) // (steps_per_range - 1))
                    vals = list(range(lo, hi + 1, step))[:steps_per_range]
            else:
                if steps_per_range <= 1:
                    vals = [round((lo + hi) / 2, 4)]
                else:
                    stride = (hi - lo) / (steps_per_range - 1)
                    vals = [round(lo + i * stride, 4) for i in range(steps_per_range)]
            value_lists.append(vals)

    if not slot_ids:
        return [generate_instance(template, 0)]

    instances: list[dict[str, Any]] = []
    for combo in product(*value_lists):
        seed = _combo_seed(slot_ids, combo)
        overrides = dict(zip(slot_ids, combo))
        instances.append(generate_instance(template, seed, overrides=overrides))

    return instances
