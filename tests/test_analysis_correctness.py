import csv
from pathlib import Path

from app import database
from app.requirements import normalize_requirements
from app.services import calculate_pricing, find_testing_price, match_products, review_quality


ROOT = Path(__file__).parents[1]


def _rows(name):
    with (ROOT / "data" / "structured_data" / name).open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _extraction():
    return {
        "products": [{"conductor_material": "Aluminium", "cores": 3, "insulation": "XLPE", "armour": "Galvanized steel strip armour", "outer_sheath": "PVC ST2", "standards": ["IEC 60502-2"], "quantity": 1200, "unit": "metres"}],
        "mandatory_conditions": [
            "Rated voltage: 11 kV", "Conductor material: Aluminium", "Number of cores: 3",
            "Conductor cross-sectional area: 240 mm²", "Insulation material: XLPE",
            "Armour construction: Galvanized steel strip armour", "Outer sheath material / grade: PVC, ST2 grade",
            "Applicable product standard: IEC 60502-2",
        ],
        "required_tests": ["Conductor DC resistance test", "Insulation resistance test", "High-voltage withstand test", "Partial discharge test"],
    }


def test_mandatory_conditions_fill_missing_structured_values():
    result = normalize_requirements(_extraction())
    product = result["products"][0]
    assert product["voltage_kv"] == 11
    assert product["cross_section_mm2"] == 240
    assert len(result["mandatory_fields"]) == 8
    assert result["extraction_warnings"] == []


def test_equivalent_tender_sheath_wording_is_not_a_conflict():
    raw = _extraction()
    raw["products"][0]["outer_sheath"] = "PVC, ST2 grade"
    result = normalize_requirements(raw)
    assert result["products"][0]["outer_sheath"] == "PVC ST2"
    assert result["extraction_warnings"] == []


def test_incomplete_prices_never_produce_a_total(monkeypatch):
    requirements = normalize_requirements(_extraction())
    monkeypatch.setattr(database, "products", lambda: _rows("product_catalog.csv"))
    monkeypatch.setattr(database, "product_prices", lambda: _rows("product_prices.csv"))
    monkeypatch.setattr(database, "testing_prices", lambda: _rows("testing_prices.csv"))

    technical = match_products(requirements["products"][0], requirements["mandatory_fields"])
    pricing = calculate_pricing(requirements["products"][0], technical, requirements["required_tests"])

    assert technical["recommendations"][0]["sku_id"] == "AG-11-240-AL-STA"
    assert technical["recommendations"][0]["match_percentage"] == 100
    assert technical["fully_compliant_product_available"]
    assert pricing["material_cost"] == 582000
    assert [item["test_id"] for item in pricing["testing_items"]] == ["TEST-001", "TEST-002", "TEST-003", "TEST-004"]
    assert pricing["known_testing_cost"] == 26000
    assert pricing["testing_cost"] == 26000
    assert pricing["total_estimated_cost"] == 608000
    assert pricing["missing_price_items"] == []


def test_quality_review_reports_unresolved_matching_and_prices():
    requirements = normalize_requirements(_extraction())
    technical = {"fully_compliant_product_available": False, "recommendations": []}
    pricing = {"pricing_complete": False, "missing_price_items": [{"test_name": "Partial discharge test"}], "warnings": ["No fully compliant product is available"]}
    quality = review_quality(requirements, technical, pricing)
    assert quality["complete"] is False
    assert quality["missing_information_count"] == 1
    assert quality["unresolved_requirement_count"] == 2


def test_exact_test_title_wins_over_a_legacy_alias():
    records = [
        {"test_id": "legacy", "test_name": "Conductor Resistance Test"},
        {"test_id": "current", "test_name": "Conductor DC resistance test"},
    ]
    assert find_testing_price("Conductor DC resistance test", records)["test_id"] == "current"
