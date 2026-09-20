"""
Pytest Suite for SIH 26079: Forecast Stability Monitor
Verifies:
1. Run-to-run consistency tracking across consecutive operational NWP initializations.
2. Exact valid forecast time matching between consecutive cycles.
3. Actual previous vs current bust probabilities and percentage point deltas.
4. Exact meteorological feature shifts for all 8 parameters.
5. Stability status classification: STABLE, MODERATE_VARIATION, UNSTABLE_FLIP_FLOP.
6. Clear INSUFFICIENT_DATA state when consecutive runs do not cover the valid forecast date.
7. Sub-daily Exact Forecast Time (+24h to +240h) handling.
"""

import os
import sys
import pytest
import requests

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.intelligence_service import intelligence_service

BASE_URL = "http://127.0.0.1:8000"


def test_stability_direct_service_real_gefs_day5():
    """Unit test for get_forecast_stability on IND-WB-ODI Day 5."""
    res = intelligence_service.get_forecast_stability(
        region_id="IND-WB-ODI",
        day=5,
        scenario_id="real_gefs_july2019",
        valid_hour=0
    )

    assert res["has_previous_run"] is True
    assert res["scenario_id"] == "real_gefs_july2019"
    assert res["region_id"] == "IND-WB-ODI"
    assert res["forecast_day"] == 5
    assert res["valid_hour"] == 0
    assert res["lead_hours"] == 120

    prev = res["previous_run"]
    curr = res["current_run"]

    # In real July 2019 GEFS:
    # Current run init: 2019-07-05 00:00 UTC, Day 5 (+120h) -> Valid 2019-07-10 00:00 UTC
    # Previous run init: 2019-07-01 00:00 UTC, Day 9 (+216h) -> Valid 2019-07-10 00:00 UTC
    assert "2019-07-05" in curr["init_time_utc"]
    assert "2019-07-01" in prev["init_time_utc"]
    assert curr["lead_hours"] == 120
    assert prev["lead_hours"] == 216
    assert "2019-07-10" in curr["valid_time_utc"]
    assert "2019-07-10" in prev["valid_time_utc"]

    # Mathematical consistency
    expected_delta_bust = round(curr["bust_probability"] - prev["bust_probability"], 1)
    assert res["delta_bust_probability_pp"] == expected_delta_bust

    expected_delta_conf = round(curr["confidence_score"] - prev["confidence_score"], 1)
    assert res["delta_confidence_score_pp"] == expected_delta_conf

    # Status check
    assert res["stability_status"] == "STABLE"
    assert "consistent across consecutive forecast cycles" in res["stability_description"]

    # Meteorological feature shifts
    shifts = res["main_variables_responsible"]
    assert len(shifts) == 8
    param_keys = [s["key"] for s in shifts]
    assert "precip_forecast" in param_keys
    assert "temp_forecast" in param_keys
    assert "mslp" in param_keys
    assert "pressure_tendency_24h" in param_keys
    assert "rh_850" in param_keys
    assert "wind_shear_850_200" in param_keys
    assert "cape_j_kg" in param_keys
    assert "ensemble_spread" in param_keys


def test_stability_unstable_flip_flop_case():
    """Unit test verifying detection of high run-to-run volatility (FLIP-FLOP)."""
    # In real July 2019 GEFS, East UP & Bihar (IND-UP-BIH) Day 4:
    # 2019-07-01 forecast high bust risk (88.4%), while 2019-07-05 dropped to 64.2% (Δ = -24.2 pp)
    res = intelligence_service.get_forecast_stability(
        region_id="IND-UP-BIH",
        day=4,
        scenario_id="real_gefs_july2019",
        valid_hour=0
    )

    assert res["has_previous_run"] is True
    assert res["delta_bust_probability_pp"] < -15.0
    assert res["stability_status"] == "UNSTABLE_FLIP_FLOP"
    assert "Forecast flip-flop alert" in res["stability_description"]


def test_stability_insufficient_comparison_data_horizon_exceeded():
    """Unit test: Day 7 to Day 10 have no preceding forecast (2019-07-01 only went to 2019-07-11)."""
    for day in [7, 8, 9, 10]:
        res = intelligence_service.get_forecast_stability(
            region_id="IND-WB-ODI",
            day=day,
            scenario_id="real_gefs_july2019",
            valid_hour=0
        )
        assert res["has_previous_run"] is False
        assert res["stability_status"] == "INSUFFICIENT_DATA"
        assert res["previous_run"] is None
        assert "Insufficient comparison data" in res["message"]


def test_stability_insufficient_comparison_data_synthetic():
    """Unit test: Single-cycle synthetic scenarios must return INSUFFICIENT_DATA."""
    res = intelligence_service.get_forecast_stability(
        region_id="IND-WB-ODI",
        day=5,
        scenario_id="monsoon_depression_bust"
    )
    assert res["has_previous_run"] is False
    assert res["stability_status"] == "INSUFFICIENT_DATA"
    assert "requires multi-cycle NWP archive data" in res["message"]


def test_stability_exact_forecast_time_and_diurnal():
    """Unit test verifying sub-daily valid hours (e.g. 12 UTC) and lead_hours matching."""
    res_0 = intelligence_service.get_forecast_stability(
        region_id="IND-WB-ODI",
        day=5,
        valid_hour=0
    )
    res_12 = intelligence_service.get_forecast_stability(
        region_id="IND-WB-ODI",
        day=5,
        valid_hour=12
    )
    res_lh = intelligence_service.get_forecast_stability(
        region_id="IND-WB-ODI",
        day=5,
        lead_hours=132
    )

    # Valid times for 12 UTC
    assert "2019-07-10 12:00 UTC" == res_12["current_run"]["valid_time_utc"]
    assert "2019-07-10 12:00 UTC" == res_12["previous_run"]["valid_time_utc"]

    # lead_hours=132 matches day=5, valid_hour=12
    assert res_12["current_run"]["bust_probability"] == res_lh["current_run"]["bust_probability"]
    assert res_12["previous_run"]["bust_probability"] == res_lh["previous_run"]["bust_probability"]
    assert res_12["delta_bust_probability_pp"] == res_lh["delta_bust_probability_pp"]


def test_all_14_subdivisions_day5():
    """Unit test verifying calculation across all 14 official Indian meteorological subdivisions."""
    regions = [
        'IND-NW-HIM', 'IND-NW-PLN', 'IND-RAJ', 'IND-GUJ', 'IND-UP-BIH',
        'IND-NE', 'IND-WB-ODI', 'IND-CEN-MP', 'IND-MAH-DESH', 'IND-KON-GOA',
        'IND-TEL-AP', 'IND-KAR', 'IND-KER', 'IND-TN'
    ]
    for r in regions:
        res = intelligence_service.get_forecast_stability(region_id=r, day=5, valid_hour=0)
        assert res["has_previous_run"] is True
        assert res["stability_status"] in ["STABLE", "MODERATE_VARIATION", "UNSTABLE_FLIP_FLOP"]
        assert 0.0 <= res["current_run"]["bust_probability"] <= 100.0
        assert 0.0 <= res["previous_run"]["bust_probability"] <= 100.0
        assert len(res["main_variables_responsible"]) == 8


def test_api_endpoint_stability():
    """Integration test against live FastAPI endpoint /api/intelligence/stability."""
    resp = requests.get(f"{BASE_URL}/api/intelligence/stability", params={
        "region_id": "IND-WB-ODI",
        "day": 5,
        "scenario": "real_gefs_july2019",
        "valid_hour": 0
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_previous_run"] is True
    assert data["stability_status"] == "STABLE"
    assert data["delta_bust_probability_pp"] == -0.1
    assert len(data["main_variables_responsible"]) == 8


def test_api_endpoint_lead_hours():
    """Integration test against live FastAPI endpoint with lead_hours query parameter."""
    resp = requests.get(f"{BASE_URL}/api/intelligence/stability", params={
        "region_id": "IND-KON-GOA",
        "day": 6,
        "scenario": "real_gefs_july2019",
        "lead_hours": 144
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_previous_run"] is True
    assert data["lead_hours"] == 144
    assert data["stability_status"] == "STABLE"
    assert data["delta_bust_probability_pp"] == 3.0
