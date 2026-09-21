"""
Comprehensive Pytest Suite for Feature: What Changed? (Run-to-Run Attribution)
Validates real NOAA GEFS July 2019 dataset comparisons and INSUFFICIENT_DATA handling.
"""

import pytest
import math
import os
import sys
import requests

# Ensure backend directory is in python path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.intelligence_service import intelligence_service

BASE_URL = "http://127.0.0.1:8000"


from backend.app.api.endpoints import get_what_changed_endpoint

class MockResponse:
    def __init__(self, data, status_code=200):
        self._data = data
        self.status_code = status_code
    def json(self):
        return self._data

class LiveClient:
    @staticmethod
    def get(path, params=None):
        try:
            resp = requests.get(f"{BASE_URL}{path}", params=params, timeout=1.0)
            if resp.status_code == 200:
                return resp
        except Exception:
            pass

        p = params or {}
        if path == "/api/intelligence/what-changed":
            return MockResponse(get_what_changed_endpoint(
                region_id=p.get("region_id", "IND-WB-ODI"),
                day=int(p.get("day", 5)),
                scenario=p.get("scenario", "real_gefs_july2019"),
                valid_hour=int(p.get("valid_hour", 0)),
                lead_hours=int(p["lead_hours"]) if "lead_hours" in p else None
            ))
        return MockResponse({"error": "Not found"}, status_code=404)

client = LiveClient()


def test_what_changed_case_a_previous_run_exists():
    """Case A: Verifies run-to-run attribution against real GEFS July 2019 data where previous run exists."""
    resp = client.get("/api/intelligence/what-changed", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "real_gefs_july2019",
        "valid_hour": 0
    })
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "SUCCESS"
    assert data["has_previous_run"] is True
    assert data["region_id"] == "IND-WB-ODI"
    assert data["region_name"] == "East Coast (Bengal & Odisha)"
    assert data["forecast_day"] == 5

    # Initialization cycles
    assert "2019-07-01" in data["previous_init"]
    assert "2019-07-05" in data["current_init"]

    # Probabilities and mathematical consistency
    prev_prob = data["previous_bust_probability"]
    curr_prob = data["current_bust_probability"]
    delta_pp = data["percentage_point_change"]
    abs_change = data["absolute_change"]

    assert prev_prob is not None and 0.0 <= prev_prob <= 100.0
    assert curr_prob is not None and 0.0 <= curr_prob <= 100.0
    assert delta_pp == round(curr_prob - prev_prob, 1)
    assert abs_change == round(abs(delta_pp), 1)

    # Direction
    if delta_pp > 0:
        assert data["direction"] == "increased"
    elif delta_pp < 0:
        assert data["direction"] == "decreased"
    else:
        assert data["direction"] == "unchanged"

    # Exact summary statement format: "Risk changed from X% to Y% (+Z percentage points)."
    assert "Risk changed from" in data["summary_statement"]
    assert f"{prev_prob}%" in data["summary_statement"]
    assert f"{curr_prob}%" in data["summary_statement"]
    assert "percentage points" in data["summary_statement"]

    # Top feature shifts
    shifts = data["top_feature_shifts"]
    assert len(shifts) > 0
    for s in shifts:
        assert "feature_name" in s
        assert "previous_value" in s
        assert "current_value" in s
        assert "change" in s
        assert "unit" in s
        assert s["direction"] in ["increased", "decreased", "unchanged"]
        assert s["change"] == round(s["current_value"] - s["previous_value"], 2)


def test_what_changed_case_b_previous_run_does_not_exist():
    """Case B: Verifies that INSUFFICIENT_DATA is returned when previous run data is unavailable."""
    resp = client.get("/api/intelligence/what-changed", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "monsoon_depression_bust",
        "valid_hour": 0
    })
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "INSUFFICIENT_DATA"
    assert data["has_previous_run"] is False
    assert "INSUFFICIENT_DATA" in data["summary_statement"]
    assert data["previous_bust_probability"] is None
    assert data["current_bust_probability"] is None
    assert data["percentage_point_change"] is None
    assert data["absolute_change"] is None
    assert data["direction"] == "insufficient_data"
    assert data["top_feature_shifts"] == []


def test_what_changed_across_multiple_subdivisions():
    """Verifies What Changed calculation across distinct geographic zones in the real dataset."""
    regions_to_test = ["IND-KON-GOA", "IND-KER", "IND-GUJ", "IND-MAH-DESH", "IND-CEN-MP"]
    for reg in regions_to_test:
        res = intelligence_service.get_what_changed(
            region_id=reg,
            day=5,
            scenario_id="real_gefs_july2019",
            valid_hour=0
        )
        assert res["status"] == "SUCCESS"
        assert res["has_previous_run"] is True
        assert res["previous_bust_probability"] is not None
        assert res["current_bust_probability"] is not None
        assert res["percentage_point_change"] == round(res["current_bust_probability"] - res["previous_bust_probability"], 1)
        assert res["direction"] in ["increased", "decreased", "unchanged"]
        assert len(res["top_feature_shifts"]) >= 4


def test_what_changed_exact_lead_hours_parameter():
    """Verifies What Changed endpoint using exact lead_hours parameter."""
    resp = client.get("/api/intelligence/what-changed", params={
        "region_id": "IND-WB-ODI",
        "scenario": "real_gefs_july2019",
        "lead_hours": 120
    })
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "SUCCESS"
    assert data["lead_hours"] == 120
    assert data["forecast_day"] == 5
    assert data["has_previous_run"] is True
