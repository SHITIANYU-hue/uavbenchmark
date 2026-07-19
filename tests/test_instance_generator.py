"""Tests for the deterministic task instance generator."""

from __future__ import annotations

import unittest

from uav_benchmark.instance.generator import (
    InstanceError,
    generate_instance,
    hash_template,
    _resolve_binding,
    _slot_seed,
)
from uav_benchmark.instance.batch import (
    generate_batch,
    parse_seed_spec,
    traverse_domain,
)
from uav_benchmark.instance.generator import get_samplable_slots
import random


def _demo_template() -> dict:
    return {
        "template_id": "test_tpl",
        "template_version": "0.1.0",
        "jd_slots": [
            {"slot_id": "jd-enum", "binding": {"mode": "enum", "allowed_values": ["A", "B", "C"], "status": "verified"}},
            {"slot_id": "jd-range", "binding": {"mode": "range", "minimum": 10, "maximum": 50, "status": "verified"}},
            {"slot_id": "jd-fixed", "binding": {"mode": "fixed", "value": 42, "status": "verified"}},
            {"slot_id": "jd-tbd", "binding": {"mode": "TBD", "status": "TBD"}},
        ],
        "phases": [
            {"phase_id": "p1", "order": 1, "entry_conditions": [], "exit_conditions": [],
             "minimum_duration": {"value": 100, "unit": "s", "status": "verified"}},
        ],
        "disturbances": [],
        "interfaces": {"executor_responsibilities": ["hover"]},
        "coverage": [],
    }


def _slot_map(instance: dict) -> dict:
    return {s["slot_id"]: s for s in instance["slot_bindings"]}


class BindingResolutionTests(unittest.TestCase):
    def test_fixed_returns_value(self) -> None:
        rng = random.Random(0)
        val, status = _resolve_binding({"mode": "fixed", "value": "hello"}, rng)
        self.assertEqual(val, "hello")
        self.assertEqual(status, "verified")

    def test_enum_picks_from_allowed(self) -> None:
        rng = random.Random(0)
        allowed = ["A", "B", "C"]
        for _ in range(20):
            val, status = _resolve_binding({"mode": "enum", "allowed_values": allowed}, rng)
            self.assertIn(val, allowed)
            self.assertEqual(status, "verified")

    def test_range_int(self) -> None:
        rng = random.Random(0)
        for _ in range(20):
            val, status = _resolve_binding({"mode": "range", "minimum": 1, "maximum": 10}, rng)
            self.assertGreaterEqual(val, 1)
            self.assertLessEqual(val, 10)
            self.assertIsInstance(val, int)

    def test_range_float(self) -> None:
        rng = random.Random(0)
        for _ in range(20):
            val, status = _resolve_binding({"mode": "range", "minimum": 0.0, "maximum": 1.0}, rng)
            self.assertGreaterEqual(val, 0.0)
            self.assertLessEqual(val, 1.0)

    def test_tbd_returns_null(self) -> None:
        rng = random.Random(0)
        val, status = _resolve_binding({"mode": "TBD"}, rng)
        self.assertIsNone(val)
        self.assertEqual(status, "TBD")

    def test_empty_enum_returns_tbd(self) -> None:
        rng = random.Random(0)
        val, status = _resolve_binding({"mode": "enum", "allowed_values": []}, rng)
        self.assertIsNone(val)
        self.assertEqual(status, "TBD")


class DeterminismTests(unittest.TestCase):
    def test_same_seed_produces_identical_instance(self) -> None:
        tpl = _demo_template()
        a = generate_instance(tpl, 42)
        b = generate_instance(tpl, 42)
        self.assertEqual(a, b)

    def test_different_seeds_produce_different_instances(self) -> None:
        tpl = _demo_template()
        a = generate_instance(tpl, 0)
        b = generate_instance(tpl, 1)
        self.assertNotEqual(a, b)

    def test_per_slot_seed_is_ordering_independent(self) -> None:
        s1 = _slot_seed(99, "jd-0.2")
        s2 = _slot_seed(99, "jd-0.2")
        self.assertEqual(s1, s2)
        s3 = _slot_seed(99, "jd-6.1")
        self.assertNotEqual(s1, s3)


class InstanceStructureTests(unittest.TestCase):
    def test_instance_has_required_fields(self) -> None:
        inst = generate_instance(_demo_template(), 0)
        self.assertEqual(inst["artifact_type"], "task_instance")
        self.assertEqual(inst["seed"], 0)
        self.assertIn("template_ref", inst)
        self.assertIn("sha256", inst["template_ref"])
        self.assertEqual(inst["template_ref"]["template_id"], "test_tpl")
        self.assertTrue(inst["compiler"]["deterministic"])
        self.assertGreater(len(inst["slot_bindings"]), 0)
        self.assertGreater(len(inst["phase_schedule"]), 0)

    def test_tbd_slots_remain_null(self) -> None:
        inst = generate_instance(_demo_template(), 0)
        sm = _slot_map(inst)
        self.assertIsNone(sm["jd-tbd"]["value"])
        self.assertEqual(sm["jd-tbd"]["status"], "TBD")

    def test_fixed_slots_keep_value(self) -> None:
        inst = generate_instance(_demo_template(), 0)
        sm = _slot_map(inst)
        self.assertEqual(sm["jd-fixed"]["value"], 42)
        self.assertEqual(sm["jd-fixed"]["status"], "verified")

    def test_enum_slots_pick_from_allowed(self) -> None:
        inst = generate_instance(_demo_template(), 0)
        sm = _slot_map(inst)
        self.assertIn(sm["jd-enum"]["value"], ["A", "B", "C"])

    def test_range_slots_stay_in_bounds(self) -> None:
        for seed in range(20):
            inst = generate_instance(_demo_template(), seed)
            sm = _slot_map(inst)
            val = sm["jd-range"]["value"]
            self.assertGreaterEqual(val, 10)
            self.assertLessEqual(val, 50)

    def test_template_hash_changes_on_modification(self) -> None:
        tpl = _demo_template()
        h1 = hash_template(tpl)
        tpl["jd_slots"][0]["binding"]["allowed_values"].append("D")
        h2 = hash_template(tpl)
        self.assertNotEqual(h1, h2)

    def test_instance_id_includes_seed(self) -> None:
        inst = generate_instance(_demo_template(), 7)
        self.assertIn("7", inst["instance_id"])

    def test_phase_schedule_has_ticks_when_duration_exists(self) -> None:
        inst = generate_instance(_demo_template(), 0)
        ps = inst["phase_schedule"][0]
        self.assertIsNotNone(ps["start_tick"])
        self.assertIsNotNone(ps["end_tick"])
        self.assertGreaterEqual(ps["end_tick"], ps["start_tick"])

    def test_negative_seed_raises(self) -> None:
        with self.assertRaises(InstanceError):
            generate_instance(_demo_template(), -1)


class OverridesTests(unittest.TestCase):
    def test_overrides_pin_specific_values(self) -> None:
        tpl = _demo_template()
        inst = generate_instance(tpl, 0, overrides={"jd-enum": "FORCE_B"})
        sm = _slot_map(inst)
        self.assertEqual(sm["jd-enum"]["value"], "FORCE_B")
        self.assertEqual(sm["jd-enum"]["status"], "verified")


class BatchTests(unittest.TestCase):
    def test_batch_generates_one_per_seed(self) -> None:
        tpl = _demo_template()
        batch = generate_batch(tpl, [0, 1, 2, 3])
        self.assertEqual(len(batch), 4)
        seeds = [i["seed"] for i in batch]
        self.assertEqual(seeds, [0, 1, 2, 3])

    def test_batch_instances_are_distinct(self) -> None:
        tpl = _demo_template()
        batch = generate_batch(tpl, [0, 1, 2])
        ids = {i["instance_id"] for i in batch}
        self.assertEqual(len(ids), 3)


class TraverseTests(unittest.TestCase):
    def test_traverse_covers_all_enum_range_combinations(self) -> None:
        tpl = _demo_template()
        instances = traverse_domain(tpl, steps_per_range=3)
        combos = set()
        for inst in instances:
            sm = _slot_map(inst)
            combos.add((sm["jd-enum"]["value"], sm["jd-range"]["value"]))
        self.assertEqual(len(combos), 9)

    def test_traverse_overrides_pin_values(self) -> None:
        tpl = _demo_template()
        instances = traverse_domain(tpl, steps_per_range=3)
        for inst in instances:
            sm = _slot_map(inst)
            self.assertEqual(sm["jd-fixed"]["value"], 42)

    def test_traverse_is_deterministic(self) -> None:
        tpl = _demo_template()
        a = traverse_domain(tpl, steps_per_range=2)
        b = traverse_domain(tpl, steps_per_range=2)
        self.assertEqual(a, b)


class ParseSeedSpecTests(unittest.TestCase):
    def test_single(self) -> None:
        self.assertEqual(parse_seed_spec("5"), [5])

    def test_range(self) -> None:
        self.assertEqual(parse_seed_spec("0-4"), [0, 1, 2, 3, 4])

    def test_csv(self) -> None:
        self.assertEqual(parse_seed_spec("0,3,7"), [0, 3, 7])

    def test_mixed(self) -> None:
        self.assertEqual(parse_seed_spec("0-2,5"), [0, 1, 2, 5])


class SamplableSlotsTests(unittest.TestCase):
    def test_includes_all_modes(self) -> None:
        slots = get_samplable_slots(_demo_template())
        modes = {s["mode"] for s in slots}
        self.assertIn("enum", modes)
        self.assertIn("range", modes)
        self.assertIn("fixed", modes)
        self.assertIn("TBD", modes)


if __name__ == "__main__":
    unittest.main()
