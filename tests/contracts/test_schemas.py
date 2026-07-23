import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError


ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = ROOT / "schemas"
EXAMPLES = ROOT / "examples" / "contracts"

SCHEMA_FILES = {
    "jd_tree_selection": "jd_tree_selection.schema.json",
    "task_template": "task_template.schema.json",
    "task_instance": "task_instance.schema.json",
    "ground_truth": "ground_truth.schema.json",
    "sut_trace": "sut_trace.schema.json",
    "grader_result": "grader_result.schema.json",
    "task_template_output": "task_template_output.schema.json",
    "world_config": "world_config.schema.json",
    "user_config": "user_config.schema.json",
    "delivery_batch": "delivery_batch.schema.json",
}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validator(name: str) -> Draft202012Validator:
    schema = load_json(SCHEMAS / SCHEMA_FILES[name])
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


@pytest.mark.parametrize("schema_file", SCHEMA_FILES.values())
def test_schema_is_valid_draft_2020_12(schema_file: str) -> None:
    Draft202012Validator.check_schema(load_json(SCHEMAS / schema_file))


@pytest.mark.parametrize(
    ("schema_name", "example_file"),
    [
        ("task_template", "task_template.valid.json"),
        ("jd_tree_selection", "jd_tree_selection.valid.json"),
        ("task_instance", "task_instance.valid.json"),
        ("ground_truth", "ground_truth.valid.json"),
        ("grader_result", "grader_result.valid.json"),
    ],
)
def test_valid_document_examples(schema_name: str, example_file: str) -> None:
    validator(schema_name).validate(load_json(EXAMPLES / example_file))


def test_valid_trace_jsonl_records() -> None:
    trace_validator = validator("sut_trace")
    lines = (EXAMPLES / "sut_trace.valid.jsonl").read_text(encoding="utf-8").splitlines()
    assert lines
    records = [json.loads(line) for line in lines]
    assert records[0]["record_type"] == "header"
    for record in records:
        trace_validator.validate(record)


def test_tbd_template_threshold_cannot_have_numeric_value() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "task_template.valid.json"))
    document["metrics"][0]["threshold"]["value"] = 0.6
    with pytest.raises(ValidationError):
        validator("task_template").validate(document)


def test_instance_compiler_must_be_deterministic_in_mvp_contract() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "task_instance.valid.json"))
    document["compiler"]["deterministic"] = False
    with pytest.raises(ValidationError):
        validator("task_instance").validate(document)


def test_ground_truth_cannot_be_marked_sut_visible() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "ground_truth.valid.json"))
    document["visibility"] = "sut_visible"
    with pytest.raises(ValidationError):
        validator("ground_truth").validate(document)


def test_trace_header_rejects_private_reasoning() -> None:
    first_line = (EXAMPLES / "sut_trace.valid.jsonl").read_text(encoding="utf-8").splitlines()[0]
    document = json.loads(first_line)
    document["content_policy"]["private_reasoning_included"] = True
    with pytest.raises(ValidationError):
        validator("sut_trace").validate(document)


def test_trace_actor_keeps_executor_separate_from_sut() -> None:
    second_line = (EXAMPLES / "sut_trace.valid.jsonl").read_text(encoding="utf-8").splitlines()[1]
    document = json.loads(second_line)
    document["actor"] = "sut_and_executor"
    with pytest.raises(ValidationError):
        validator("sut_trace").validate(document)


def test_tbd_grader_threshold_cannot_have_numeric_value() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "grader_result.valid.json"))
    threshold = document["coverage_results"][0]["metrics"][0]["threshold"]
    threshold["value"] = 0.8
    with pytest.raises(ValidationError):
        validator("grader_result").validate(document)


def test_unknown_coverage_role_is_rejected() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "task_template.valid.json"))
    document["coverage"][0]["role"] = "integrated_primary"
    with pytest.raises(ValidationError):
        validator("task_template").validate(document)


def test_runtime_dependencies_are_explicitly_out_of_score() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "task_template.valid.json"))
    document["runtime_dependencies"] = [
        {
            "dependency_id": "external_localization",
            "group": "G2",
            "ability": "A7",
            "provider": "external_system",
            "responsibilities": ["provide base pose"],
            "scored": False,
            "status": "proposed",
        }
    ]
    document["attribution_rules"] = [
        {
            "rule_id": "decision_execution_split",
            "description": "Decision and execution are scored independently.",
            "applies_to": ["a7_l3", "a10_l1"],
            "shared_outcome_handling": "no_double_count",
            "status": "proposed",
        }
    ]
    document["task_level_gates"] = [
        {
            "gate_id": "safe_terminal",
            "description": "Shared safety outcome is recorded once.",
            "evidence_required": ["ground_truth", "trace"],
            "status": "proposed",
        }
    ]
    validator("task_template").validate(document)


def test_runtime_dependency_cannot_be_marked_scored() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "task_template.valid.json"))
    document["runtime_dependencies"] = [
        {
            "dependency_id": "external_flight_control",
            "group": "G3",
            "ability": "A11",
            "provider": "executor",
            "responsibilities": ["provide low-level flight control"],
            "scored": True,
            "status": "proposed",
        }
    ]
    with pytest.raises(ValidationError):
        validator("task_template").validate(document)


def test_grader_can_report_shared_task_gate_separately() -> None:
    document = copy.deepcopy(load_json(EXAMPLES / "grader_result.valid.json"))
    document["task_level_results"] = [
        {
            "gate_id": "safe_terminal",
            "status": "indeterminate",
            "message": "Threshold and business rule are not calibrated.",
            "evidence": ["ground_truth#/safety_truth", "trace#event"],
            "violations": [],
        }
    ]
    validator("grader_result").validate(document)
