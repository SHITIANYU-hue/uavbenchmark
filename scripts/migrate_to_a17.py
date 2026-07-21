"""One-shot migration script: renumber A1..A15 (with a/b suffixes) -> A1..A17.

See docs/update_notice_ga_renumbering.md for the full mapping and rationale.

The script applies two regex-driven substitutions in a single pass per file:

  1. A ID substitution:  A(\\d+[a-z]?)  ->  A<new>
  2. JD ID substitution: jd-(\\d+[a-z]?)\\.(\\d+)  ->  jd-<new>.<n>

Because each match is independently looked up in the mapping table, the
JD "ID swaps" (e.g. old jd-5.N <-> old jd-14.N) are handled correctly
without two-phase renaming.

Usage:
    python scripts/migrate_to_a17.py [--apply]
Without --apply the script prints a diff per file and writes nothing.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


A_MAPPING: dict[str, str] = {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "14": "5",
    "5": "6",
    "6a": "7",
    "6b": "8",
    "11": "9",
    "7": "10",
    "8": "11",
    "9a": "12",
    "9b": "13",
    "10": "14",
    "13": "15",
    "12": "16",
    "15": "17",
}


JD_K_MAPPING: dict[str, str] = {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
    "5": "6",
    "6a": "7",
    "6b": "8",
    "7": "10",
    "8": "11",
    "9a": "12",
    "9b": "13",
    "10": "14",
    "11": "9",
    "12": "16",
    "13": "15",
    "14": "5",
    "15": "17",
}


A_PATTERN = re.compile(r"\bA(\d+[a-z]?)\b")
JD_PATTERN = re.compile(r"jd-(\d+[a-z]?)\.(\d+)")


def _sub_a(match: re.Match[str]) -> str:
    old = match.group(1)
    new = A_MAPPING.get(old)
    if new is None:
        return match.group(0)
    return f"A{new}"


def _sub_jd(match: re.Match[str]) -> str:
    old_k = match.group(1)
    n = match.group(2)
    new_k = JD_K_MAPPING.get(old_k)
    if new_k is None:
        return match.group(0)
    return f"jd-{new_k}.{n}"


def transform(text: str) -> str:
    text = A_PATTERN.sub(_sub_a, text)
    text = JD_PATTERN.sub(_sub_jd, text)
    return text


SOURCE_MD_FILES = [
    "AxL责任定义字典_17A_68单元_机读版.md",
    "JD业务变量字典_66槽位_机读版.md",
]

CODE_FILES = [
    "src/uav_benchmark/compiler/intake.py",
    "src/uav_benchmark/agent/service.py",
    "schemas/task_template.schema.json",
    "schemas/grader_result.schema.json",
    "scripts/build_knowledge_catalog.py",
    "knowledge/business_scenario_registry.json",
    "knowledge/task_template_backbone.json",
    "pipeline/js/jd.js",
    "pipeline/js/constants.js",
    "pipeline/js/coverage.js",
    "pipeline/js/steps.js",
    "pipeline/js/agent.js",
    "pipeline/js/shell.js",
    "tests/agent_contract_checks.py",
    "tests/compiler/test_intake.py",
    "tests/contracts/test_schemas.py",
    "tests/test_instance_generator.py",
]

EXAMPLE_FILES = [
    "examples/intake/case2_oilfield_intake.yaml",
    "examples/intake/case_intake_template.yaml",
    "examples/contracts/task_template.valid.json",
    "examples/contracts/grader_result.valid.json",
    "examples/case2_oilfield_corridor/task_template.generated.json",
]

DOC_FILES = [
    "README.md",
    "docs/codebase_guide.md",
    "docs/config_agent_quickstart.md",
    "docs/pipeline_ui_walkthrough.md",
    "docs/how_to_create_case_template.md",
    "docs/archive/模版一_城市高楼峡谷违停车辆巡检.md",
    "docs/archive/模版二_油田管廊缺陷巡检.md",
]


ALL_FILES = SOURCE_MD_FILES + CODE_FILES + EXAMPLE_FILES + DOC_FILES


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Write changes. Without this flag, only preview.")
    args = parser.parse_args()

    changed = 0
    skipped = 0
    for rel in ALL_FILES:
        path = ROOT / rel
        if not path.exists():
            print(f"SKIP (missing): {rel}")
            skipped += 1
            continue
        original = path.read_text(encoding="utf-8")
        updated = transform(original)
        if updated == original:
            print(f"NOCHANGE: {rel}")
            continue
        changed += 1
        print(f"CHANGED:  {rel}")
        if args.apply:
            path.write_text(updated, encoding="utf-8")
        else:
            import difflib
            diff = difflib.unified_diff(
                original.splitlines(keepends=True),
                updated.splitlines(keepends=True),
                fromfile=f"a/{rel}",
                tofile=f"b/{rel}",
                n=2,
            )
            sys.stdout.writelines(diff)
            print("---")

    print(f"\n{changed} file(s) changed, {skipped} skipped.")
    if not args.apply and changed > 0:
        print("Dry-run only. Re-run with --apply to write changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
