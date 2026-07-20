import copy
from pathlib import Path

import pytest

from uav_benchmark.compiler.intake import (
    IntakeError,
    build_task_template,
    load_case_intake,
    validate_task_template,
)


ROOT = Path(__file__).resolve().parents[2]
INTAKE = ROOT / "examples" / "intake" / "case2_oilfield_intake.yaml"
SCHEMA = ROOT / "schemas" / "task_template.schema.json"


def case2_intake():
    return load_case_intake(INTAKE)


def test_case2_intake_builds_valid_task_template() -> None:
    template = build_task_template(case2_intake())
    validate_task_template(template, SCHEMA)
    assert [item["ability"] for item in template["coverage"]] == ["A6", "A8", "A10", "A9"]
    assert all(item["scored"] is False for item in template["runtime_dependencies"])


def test_build_is_deterministic() -> None:
    intake = case2_intake()
    assert build_task_template(intake) == build_task_template(intake)


def test_tbd_thresholds_are_null() -> None:
    template = build_task_template(case2_intake())
    assert template["metrics"]
    assert all(metric["threshold"] == {
        "value": None,
        "status": "TBD",
        "rationale": metric["threshold"]["rationale"],
    } for metric in template["metrics"])


def test_l0_belongs_in_runtime_dependencies_not_coverage() -> None:
    intake = copy.deepcopy(case2_intake())
    intake["coverage"][0]["level"] = "L0"
    with pytest.raises(IntakeError, match="runtime_dependencies"):
        build_task_template(intake)


def test_unknown_ability_is_rejected() -> None:
    intake = copy.deepcopy(case2_intake())
    intake["coverage"][0]["ability"] = "A99"
    with pytest.raises(IntakeError, match="Unknown ability"):
        build_task_template(intake)


def test_tbd_numeric_threshold_is_rejected() -> None:
    intake = copy.deepcopy(case2_intake())
    intake["metrics"][0]["threshold"]["value"] = 0.5
    with pytest.raises(IntakeError, match="null value"):
        build_task_template(intake)
