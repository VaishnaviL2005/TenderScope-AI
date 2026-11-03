import pytest
from fastapi import HTTPException

from app import main


def _output(version):
    return {
        "requirements": {"version": version},
        "technical": {"version": version},
        "pricing": {"version": version},
        "quality": {"version": version},
        "report": {"version": version},
    }


def test_reanalysis_reuses_same_tender_and_replaces_saved_report(monkeypatch):
    tender_id = "TDR-EXISTING"
    existing = {"id": tender_id, "status": "completed", "text": "stored uploaded document"}
    seen = {"claimed": [], "text": [], "saved": [], "statuses": [], "created": 0}
    monkeypatch.setattr(main, "get_tender", lambda tid: existing if tid == tender_id else None)
    monkeypatch.setattr(main, "begin_analysis", lambda tid: seen["claimed"].append(tid) or True)
    monkeypatch.setattr(main, "get_analysis", lambda tid: {"report": {"version": "old"}})
    monkeypatch.setattr(main, "analyze", lambda text: seen["text"].append(text) or _output("new"))
    monkeypatch.setattr(main, "save_analysis", lambda tid, **output: seen["saved"].append((tid, output)))
    monkeypatch.setattr(main, "set_status", lambda tid, status: seen["statuses"].append((tid, status)))
    monkeypatch.setattr(main, "create_tender", lambda *args: seen.__setitem__("created", seen["created"] + 1))

    response = main.analyze_tender(tender_id)

    assert response.data["tender_id"] == tender_id
    assert seen["claimed"] == [tender_id]
    assert seen["text"] == ["stored uploaded document"]
    assert seen["saved"] == [(tender_id, _output("new"))]
    assert seen["statuses"] == [(tender_id, "completed")]
    assert seen["created"] == 0


def test_failed_reanalysis_keeps_the_prior_completed_report(monkeypatch):
    tender_id = "TDR-EXISTING"
    monkeypatch.setattr(main, "get_tender", lambda tid: {"id": tid, "text": "stored document"})
    monkeypatch.setattr(main, "begin_analysis", lambda tid: True)
    monkeypatch.setattr(main, "get_analysis", lambda tid: {"report": {"version": "old"}})
    monkeypatch.setattr(main, "analyze", lambda text: (_ for _ in ()).throw(RuntimeError("provider failed")))
    statuses = []
    monkeypatch.setattr(main, "set_status", lambda tid, status: statuses.append((tid, status)))
    monkeypatch.setattr(main, "save_analysis", lambda *args, **kwargs: pytest.fail("failed analysis must not overwrite the old report"))

    with pytest.raises(HTTPException) as error:
        main.analyze_tender(tender_id)

    assert error.value.status_code == 500
    assert statuses == [(tender_id, "completed")]


def test_reanalysis_rejects_another_request_while_processing(monkeypatch):
    monkeypatch.setattr(main, "get_tender", lambda tid: {"id": tid, "text": "stored document"})
    monkeypatch.setattr(main, "begin_analysis", lambda tid: False)

    with pytest.raises(HTTPException) as error:
        main.analyze_tender("TDR-RUNNING")

    assert error.value.status_code == 409


def test_report_does_not_present_the_old_result_as_a_new_completed_result(monkeypatch):
    monkeypatch.setattr(main, "get_tender", lambda tid: {"id": tid, "status": "processing", "text": "stored document"})

    with pytest.raises(HTTPException) as error:
        main.report("TDR-RUNNING")

    assert error.value.status_code == 409
