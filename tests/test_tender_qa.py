from app.workflow import answer_question


def _analysis():
    first = {"sku_id": "AG-11-240-AL-STA", "match_percentage": 100, "compliant": True, "comparisons": [], "source_references": [{"source": "OEM.pdf", "page_number": 2}]}
    second = {"sku_id": "AG-11-240-AL-SWA", "match_percentage": 87.5, "compliant": False, "comparisons": [{"parameter": "Armour construction", "result": "mismatch"}], "source_references": [{"source": "OEM.pdf", "page_number": 3}]}
    return {
        "requirements": {"products": [{"source_reference": "[Page 2]"}], "required_tests": ["Conductor DC resistance test", "Insulation resistance test"], "reference_number": "RFP-1"},
        "technical": {"recommendations": [first, second]},
        "pricing": {"pricing_complete": True, "material_cost": 582000, "testing_cost": 26000, "total_estimated_cost": 608000, "warnings": []},
    }


def test_suggested_questions_are_answered_from_saved_report_data():
    analysis = _analysis()
    expected = {
        "Why was Product B ranked second?": "AG-11-240-AL-SWA ranks second",
        "Which specifications does Product A fail?": "has no failed mandatory specifications",
        "Compare the top two products.": "AG-11-240-AL-STA ranks first",
        "Which testing procedures are required?": "Conductor DC resistance test",
        "How was the total cost calculated?": "INR 608,000",
    }
    for question, fragment in expected.items():
        response = answer_question(analysis, question)
        assert fragment in response["answer"]
        assert response["data"] is not None
