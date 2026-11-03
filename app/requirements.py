"""Normalization and reconciliation of extracted tender requirements.

The LLM is responsible for locating tender content.  This module makes the
structured representation internally consistent with the mandatory conditions
it returned, without filling values that are not stated in the document.
"""
from __future__ import annotations

import re
from typing import Any

from app.schemas import TenderRequirements


MANDATORY_FIELD_PATTERNS = {
    "voltage_kv": ("rated voltage", "voltage"),
    "conductor_material": ("conductor material",),
    "cores": ("number of cores", "cores"),
    "cross_section_mm2": ("cross-sectional area", "cross sectional area", "conductor cross"),
    "insulation": ("insulation material", "insulation"),
    "armour": ("armour construction", "armour"),
    "outer_sheath": ("outer sheath material", "outer sheath"),
    "standards": ("applicable product standard", "applicable standard", "standard"),
}


def _as_text(value: Any) -> str:
    if isinstance(value, list):
        return "\n".join(str(item) for item in value)
    return str(value or "")


def _value_for(field: str, text: str) -> Any:
    """Extract only an explicit technical value from a mandatory-condition line."""
    if field == "voltage_kv":
        match = re.search(r"\b(\d+(?:\.\d+)?)\s*k\s*v\b", text, re.I)
        return float(match.group(1)) if match else None
    if field == "cross_section_mm2":
        match = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:mm\s*(?:2|²)|sq\.?\s*mm)\b", text, re.I)
        return float(match.group(1)) if match else None
    if field == "cores":
        match = re.search(r"\b(\d+)\s*[- ]?(?:core|cores)\b", text, re.I)
        return int(match.group(1)) if match else None
    if field == "conductor_material":
        match = re.search(r"\b(aluminium|aluminum|copper)\b", text, re.I)
        return "Aluminium" if match and match.group(1).lower().startswith("alum") else ("Copper" if match else None)
    if field == "insulation":
        match = re.search(r"\b(XLPE|PVC|EPR)\b", text, re.I)
        return match.group(1).upper() if match else None
    if field == "armour":
        # Keep the stated construction, rather than collapsing strip and wire.
        match = re.search(r"\b(?:galvanized\s+)?steel\s+(?:strip|tape|wire)(?:\s+armou?r(?:ed)?)?\b", text, re.I)
        return match.group(0).strip() if match else None
    if field == "outer_sheath":
        match = re.search(r"\b(PVC|PE|LSZH)(?:\s*,?\s*(ST\s*\d+))?\b", text, re.I)
        return " ".join(part for part in match.groups() if part).upper() if match else None
    if field == "standards":
        match = re.search(r"\b((?:IEC|IS|IEEE|BS|ASTM)\s*\d+(?:[-/]\d+)*)\b", text, re.I)
        return [re.sub(r"\s+", " ", match.group(1).upper())] if match else None
    return None


def _field_lines(field: str, mandatory_text: str) -> list[str]:
    aliases = MANDATORY_FIELD_PATTERNS[field]
    return [line for line in mandatory_text.splitlines() if any(alias in line.lower() for alias in aliases)]


def _equivalent(field: str, left: Any, right: Any) -> bool:
    """Compare tender values semantically, not by presentation punctuation."""
    if field in {"voltage_kv", "cross_section_mm2", "cores"}:
        try:
            return float(left) == float(right)
        except (TypeError, ValueError):
            return False
    if field == "standards":
        left_values = left if isinstance(left, list) else [left]
        right_values = right if isinstance(right, list) else [right]
        compact = lambda value: re.sub(r"[^a-z0-9]", "", str(value).lower())
        return {compact(value) for value in left_values} == {compact(value) for value in right_values}
    canonical = lambda value: re.sub(r"\bgrade\b|[^a-z0-9]+", "", str(value).lower()).replace("armoured", "armour")
    return canonical(left) == canonical(right)


def normalize_requirements(extracted: dict[str, Any]) -> dict[str, Any]:
    """Fill missing product fields from explicit mandatory conditions.

    Values already returned by extraction win when equivalent.  A conflict is
    retained as an extraction warning instead of silently selecting a value.
    """
    data = TenderRequirements.model_validate(extracted).model_dump()
    mandatory_text = _as_text(data.get("mandatory_conditions"))
    products = data.get("products") or [{}]
    product = dict(products[0])
    mandatory_fields: list[str] = []
    warnings: list[str] = []

    for field in MANDATORY_FIELD_PATTERNS:
        lines = _field_lines(field, mandatory_text)
        if not lines:
            continue
        mandatory_fields.append(field)
        stated = _value_for(field, " ".join(lines))
        current = product.get(field)
        if current in (None, "", []):
            if stated not in (None, "", []):
                product[field] = stated
        elif stated not in (None, "", []) and _equivalent(field, current, stated):
            # Use one canonical presentation in both the structured product
            # requirement and mandatory-condition reconciliation.
            product[field] = stated
        elif stated not in (None, "", []):
            warnings.append(f"Extracted {field} conflicts with the mandatory condition; manual review is required")

    # A value stated in structured extraction is still a requirement when the
    # LLM did not expose a separate mandatory-condition list.
    for field in MANDATORY_FIELD_PATTERNS:
        if product.get(field) not in (None, "", []) and field not in mandatory_fields:
            mandatory_fields.append(field)

    data["products"] = [product] + products[1:]
    data["mandatory_fields"] = mandatory_fields
    data["extraction_warnings"] = warnings
    return data
