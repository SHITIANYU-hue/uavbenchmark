"""Read-only tools exposed to the Config Agent."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "knowledge" / "agent_reference_catalog.json"
TEMPLATE_BACKBONE_PATH = ROOT / "knowledge" / "task_template_backbone.json"


@lru_cache(maxsize=1)
def load_reference_catalog() -> dict[str, Any]:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_template_backbone() -> dict[str, Any]:
    return json.loads(TEMPLATE_BACKBONE_PATH.read_text(encoding="utf-8"))


def lookup_gal_catalog() -> dict[str, Any]:
    """Return allowed GAL cells. Call before proposing any A×L coverage."""

    catalog = load_reference_catalog()
    return {
        "catalog_version": catalog["catalog_version"],
        "scope": catalog["scope"],
        "warning": catalog["warning"],
        "gal_cells": catalog["gal_cells"],
        "global_rules": catalog["global_rules"],
    }


def lookup_jd_catalog() -> dict[str, Any]:
    """Return allowed JD fields. Call before proposing any JD bindings."""

    catalog = load_reference_catalog()
    return {
        "catalog_version": catalog["catalog_version"],
        "scope": catalog["scope"],
        "warning": catalog["warning"],
        "jd_fields": catalog["jd_fields"],
        "global_rules": catalog["global_rules"],
    }
