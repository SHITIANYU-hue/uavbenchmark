"""Command-line entry point for task instance generation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Optional

from .batch import generate_batch, parse_seed_spec, traverse_domain
from .generator import generate_instance, validate_instance


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate deterministic task instances from a task template."
    )
    parser.add_argument(
        "--template", required=True, type=Path,
        help="Task template JSON file (schema: task_template.schema.json)",
    )
    parser.add_argument(
        "--seeds",
        type=str,
        default=None,
        help="Seed specification: '5', '0-9', '0,3,7,12'.  Mutually exclusive with --traverse.",
    )
    parser.add_argument(
        "--traverse",
        action="store_true",
        help="Full Cartesian-product traversal of all enum/range bindings.",
    )
    parser.add_argument(
        "--traverse-steps",
        type=int,
        default=3,
        help="Number of sample points per range binding in traverse mode (default: 3).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Write one JSON file per instance into this directory.",
    )
    parser.add_argument(
        "--schema",
        type=Path,
        default=Path("schemas/task_instance.schema.json"),
        help="Task instance JSON Schema path for validation.",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip JSON Schema validation.",
    )
    return parser


def _print_summary(instances: list[dict]) -> None:
    for inst in instances:
        resolved = sum(1 for s in inst["slot_bindings"] if s["status"] != "TBD")
        total = len(inst["slot_bindings"])
        print(
            f"  {inst['instance_id']:40s}  "
            f"seed={inst['seed']:<6d}  "
            f"slots={resolved}/{total}  "
            f"phases={len(inst['phase_schedule'])}"
        )


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)

    template = json.loads(args.template.read_text(encoding="utf-8"))

    if args.traverse and args.seeds is not None:
        print("ERROR: --traverse and --seeds are mutually exclusive.")
        return 1

    if args.traverse:
        instances = traverse_domain(template, steps_per_range=args.traverse_steps)
        mode_desc = f"traverse (steps_per_range={args.traverse_steps})"
    else:
        seeds = parse_seed_spec(args.seeds) if args.seeds else [0]
        instances = generate_batch(template, seeds)
        mode_desc = f"seeds={seeds}"

    print(f"Generated {len(instances)} instance(s) [{mode_desc}]")

    if not args.no_validate:
        for inst in instances:
            validate_instance(inst, args.schema)

    if args.output_dir is not None:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for inst in instances:
            path = args.output_dir / f"{inst['instance_id']}.json"
            path.write_text(
                json.dumps(inst, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
        print(f"Wrote {len(instances)} file(s) to {args.output_dir}/")
    elif len(instances) == 1:
        print(json.dumps(instances[0], ensure_ascii=False, indent=2))
    else:
        _print_summary(instances)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
