"""Deterministic Domain Template → Task Template (seed) engine."""

from .generator import (
    COMPILER_NAME,
    COMPILER_VERSION,
    InstanceError,
    generate_instance,
    hash_template,
    validate_instance,
)
from .domain_template import build_domain_template, normalize_domain_template, slug_id
from .batch import generate_batch, traverse_domain, parse_seed_spec

__all__ = [
    "COMPILER_NAME",
    "COMPILER_VERSION",
    "InstanceError",
    "generate_instance",
    "hash_template",
    "validate_instance",
    "build_domain_template",
    "normalize_domain_template",
    "slug_id",
    "generate_batch",
    "traverse_domain",
    "parse_seed_spec",
]
