"""Command-line entry point for case intake compilation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Optional

from .intake import build_task_template, load_case_intake, validate_task_template


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compile a human-authored case intake YAML/JSON into a Config Agent task template."
    )
    parser.add_argument("--input", required=True, type=Path, help="Case intake YAML or JSON file")
    parser.add_argument("--output", type=Path, help="Generated task_template JSON path")
    parser.add_argument(
        "--schema",
        type=Path,
        default=Path("schemas/task_template.schema.json"),
        help="Task template JSON Schema path",
    )
    parser.add_argument("--check", action="store_true", help="Validate only; do not write output")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    intake = load_case_intake(args.input)
    template = build_task_template(intake)
    validate_task_template(template, args.schema)

    if args.check:
        print(f"VALID: {template['template_id']} ({len(template['coverage'])} coverage cells)")
        return 0

    if args.output is None:
        print(json.dumps(template, ensure_ascii=False, indent=2))
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(template, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WROTE: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
