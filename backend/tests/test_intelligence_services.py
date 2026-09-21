"""
Automated Pytest Suite for Core Intelligence Layer:
1. Forecast Stability Monitor
2. What Changed?
3. Forecast Bust Fingerprint
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


from backend.app.api.endpoints import (
    get_forecast_stability_endpoint,
    get_what_changed_endpoint,
    get_forecast_bust_fingerprint_endpoint,
    get_intelligence_overview_endpoint
)

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
        if path == "/api/intelligence/stability":
            return MockResponse(get_forecast_stability_endpoint(
                region_id=p.get("region_id", "IND-WB-ODI"),
                day=int(p.get("day", 5)),
                scenario=p.get("scenario", "real_gefs_july2019"),
                valid_hour=int(p.get("valid_hour", 0)),
                lead_hours=int(p["lead_hours"]) if "lead_hours" in p else None
            ))
        elif path == "/api/intelligence/what-changed":
            return MockResponse(get_what_changed_endpoint(
                region_id=p.get("region_id", "IND-WB-ODI"),
                day=int(p.get("day", 5)),
                scenario=p.get("scenario", "real_gefs_july2019"),
                valid_hour=int(p.get("valid_hour", 0)),
                lead_hours=int(p["lead_hours"]) if "lead_hours" in p else None
            ))
        elif path == "/api/intelligence/fingerprint":
            return MockResponse(get_forecast_bust_fingerprint_endpoint(
                region_id=p.get("region_id", "IND-WB-ODI"),
                day=int(p.get("day", 5)),
                scenario=p.get("scenario", "real_gefs_july2019"),
                valid_hour=int(p.get("valid_hour", 0)),
                top_k=int(p.get("top_k", 5))
            ))
        elif path == "/api/intelligence/overview":
            return MockResponse(get_intelligence_overview_endpoint(
                region_id=p.get("region_id", "IND-WB-ODI"),
                day=int(p.get("day", 5)),
                scenario=p.get("scenario", "real_gefs_july2019"),
                valid_hour=int(p.get("valid_hour", 0))
            ))
        return MockResponse({"error": "Not found"}, status_code=404)

client = LiveClient()


def test_forecast_stability_monitor_endpoint():
    """Verifies run-to-run consistency tracking across consecutive operational initialization cycles."""
    resp = client.get("/api/intelligence/stability", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "real_gefs_july2019",
        "valid_hour": 0
    })
    assert resp.status_code == 200
    data = resp.json()

    assert data["has_previous_run"] is True
    assert data["region_id"] == "IND-WB-ODI"
    assert data["forecast_day"] == 5

    prev = data["previous_run"]
    curr = data["current_run"]

    assert "2019-07-01" in prev["init_time_utc"]
    assert "2019-07-05" in curr["init_time_utc"]
    assert prev["bust_probability"] is not None
    assert curr["bust_probability"] is not None

    # Mathematical consistency checks
    expected_delta_bust = round(curr["bust_probability"] - prev["bust_probability"], 1)
    assert data["delta_bust_probability_pp"] == expected_delta_bust

    expected_delta_conf = round(curr["confidence_score"] - prev["confidence_score"], 1)
    assert data["delta_confidence_score_pp"] == expected_delta_conf

    # Stability classification threshold check
    abs_delta = abs(expected_delta_bust)
    if abs_delta <= 5.0:
        assert data["stability_status"] == "STABLE"
    elif abs_delta <= 15.0:
        assert data["stability_status"] == "MODERATE_VARIATION"
    else:
        assert data["stability_status"] == "UNSTABLE_FLIP_FLOP"

    # Feature shifts check
    shifts = data["main_variables_responsible"]
    assert len(shifts) > 0
    for s in shifts:
        assert "feature_name" in s
        assert "change" in s
        assert "unit" in s
        assert s["direction"] in ["increased", "decreased", "unchanged"]


def test_what_changed_attribution_endpoint():
    """Verifies meteorological feature attribution and plain-language headline statements."""
    resp = client.get("/api/intelligence/what-changed", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "real_gefs_july2019",
        "valid_hour": 0
    })
    assert resp.status_code == 200
    data = resp.json()

    assert "Risk changed from" in data["summary_statement"]
    assert "percentage points" in data["summary_statement"]
    assert data["previous_bust_probability"] is not None
    assert data["current_bust_probability"] is not None
    assert data["absolute_change"] == abs(data["percentage_point_change"])
    assert len(data["top_feature_shifts"]) > 0


def test_forecast_bust_fingerprint_endpoint():
    """Verifies standardized unit-invariant Euclidean distance similarity matching against real labeled dataset."""
    resp = client.get("/api/intelligence/fingerprint", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "real_gefs_july2019",
        "top_k": 5
    })
    assert resp.status_code == 200
    data = resp.json()

    assert data["feature_space_dimensions"] == 12
    assert "Standardized Euclidean Distance" in data["distance_metric"]
    assert "100.0 / (1.0 + distance / 5.0)" in data["similarity_formula"]

    matches = data["closest_matches"]
    assert len(matches) == 5

    prev_dist = -1.0
    for m in matches:
        assert "init_date" in m
        assert "region_id" in m
        assert "is_bust" in m
        assert "euclidean_distance" in m
        assert "similarity_score_pct" in m
        # Check monotonic distance ordering
        assert m["euclidean_distance"] >= prev_dist
        prev_dist = m["euclidean_distance"]

        # Check documented similarity formula calculation
        expected_sim = round(100.0 / (1.0 + m["euclidean_distance"] / 5.0), 1)
        assert abs(m["similarity_score_pct"] - expected_sim) < 0.2

    # Confirmed bust subset check
    confirmed = data["closest_confirmed_busts"]
    assert len(confirmed) >= 1
    for c in confirmed:
        assert c["is_bust"] is True
        assert len(c["bust_trigger"]) > 0
        assert c["bust_category"] in ["CONFIRMED_BUST", "Precipitation Overprediction Bust", "Precipitation Underprediction Bust", "Temperature Extremes Bust"]


def test_intelligence_overview_bundle():
    """Verifies bundled overview containing all three intelligence components."""
    resp = client.get("/api/intelligence/overview", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "real_gefs_july2019"
    })
    assert resp.status_code == 200
    data = resp.json()

    assert "stability_monitor" in data
    assert "what_changed" in data
    assert "bust_fingerprint" in data
    assert data["forecast_day"] == 5


def test_service_level_consecutive_runs():
    """Direct unit test of intelligence_service class across all 10 forecast horizons."""
    for day in range(1, 11):
        res = intelligence_service.get_forecast_stability("IND-WB-ODI", day=day, valid_hour=0)
        if day <= 6:
            assert res["has_previous_run"] is True
            assert res["stability_status"] in ["STABLE", "MODERATE_VARIATION", "UNSTABLE_FLIP_FLOP"]
        else:
            assert res["has_previous_run"] is False
            assert res["stability_status"] == "INSUFFICIENT_DATA"

        fingerprint = intelligence_service.get_bust_fingerprint("IND-WB-ODI", day=day, top_k=3)
        assert len(fingerprint["closest_matches"]) == 3
        assert len(fingerprint["closest_confirmed_busts"]) > 0
