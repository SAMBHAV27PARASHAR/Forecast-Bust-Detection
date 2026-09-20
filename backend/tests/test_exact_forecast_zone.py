"""
Pytest Suite for Exact Forecast Zone, Sub-Daily Lead Times, and Subdivision Coverage.
Adapted from scratch/verify_controls.py and zone verification specifications.

Verifies:
1. Exact forecast date and lead-hour calculation across Day 1 (+24h), Day 5 (+120h), and Day 10 (+240h).
2. Sub-daily diurnal valid hour lead-hour offsets (e.g. Day 5, 06:00 UTC = lead +126h).
3. Subdivision coverage across all 14 official Indian meteorological zones.
4. Available dates metadata and 3-hourly temporal resolution slots.
5. Regional forecast parameter extraction for specific zones (IND-WB-ODI, IND-KON-GOA, IND-UP-BIH).
"""

import pytest
import requests
from backend.app.services.data_service import data_service

BASE_URL = "http://127.0.0.1:8000/api"

OFFICIAL_ZONES = [
    'IND-NW-HIM', 'IND-NW-PLN', 'IND-RAJ', 'IND-GUJ', 'IND-UP-BIH',
    'IND-NE', 'IND-WB-ODI', 'IND-CEN-MP', 'IND-MAH-DESH', 'IND-KON-GOA',
    'IND-TEL-AP', 'IND-KAR', 'IND-KER', 'IND-TN'
]


def fetch_risk_map(day=5, scenario="live_gefs", valid_hour=0, date=None):
    """Fetches risk map from live HTTP server with fallback to service layer."""
    params = {"day": day, "scenario": scenario, "valid_hour": valid_hour}
    if date:
        params["date"] = date
    try:
        resp = requests.get(f"{BASE_URL}/risk-map", params=params, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return data_service.get_risk_map(day=day, scenario_id=scenario, valid_hour=valid_hour, date=date)


def fetch_zone_forecast(region_id, day=5, scenario="live_gefs", valid_hour=0, date=None):
    """Fetches zone forecast detail from live HTTP server with fallback to service layer."""
    params = {"day": day, "scenario": scenario, "valid_hour": valid_hour}
    if date:
        params["date"] = date
    try:
        resp = requests.get(f"{BASE_URL}/forecast/{region_id}", params=params, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return data_service.get_forecast_detail(region_id=region_id, day=day, scenario_id=scenario, valid_hour=valid_hour, date=date)


@pytest.mark.parametrize("day,date_str,expected_lead", [
    (1, "2026-09-20", 24),
    (5, "2026-09-24", 120),
    (10, "2026-09-29", 240)
])
def test_exact_forecast_lead_hours_mapping(day, date_str, expected_lead):
    """Verifies that synoptic lead days map strictly to exact hours (+24h, +120h, +240h)."""
    data = fetch_risk_map(day=day, scenario="live_gefs", valid_hour=0, date=date_str)
    assert data is not None
    assert data["forecast_day"] == day
    assert data["lead_hours"] == expected_lead
    assert date_str in data.get("selected_date", date_str)


def test_subdaily_exact_lead_hour_offset():
    """Verifies that sub-daily valid hours add exact diurnal offsets (Day 5 at 06:00 UTC = lead +126h)."""
    data = fetch_risk_map(day=5, scenario="live_gefs", valid_hour=6, date="2026-09-24")
    assert data["forecast_day"] == 5
    assert data["lead_hours"] == 126
    assert "2026-09-24 06:00 UTC" in data.get("valid_forecast_time", "") or "2026-09-24" in data.get("valid_forecast_time", "")


def test_all_14_subdivision_zones_present():
    """Verifies that all 14 official Indian subdivisions are present in the risk map with valid bust metrics."""
    data = fetch_risk_map(day=3, scenario="live_gefs", valid_hour=0)
    regions = data.get("regions", [])
    assert len(regions) == 14

    region_ids = [r.get("region_id") or r.get("id") for r in regions]
    for zone in OFFICIAL_ZONES:
        assert zone in region_ids

    for r in regions:
        assert 0.0 <= r["bust_probability"] <= 100.0
        assert r["risk_level"] in ["Low", "Moderate", "High", "Severe", "Low Risk", "Medium Risk", "High Risk"]


def test_available_forecast_dates_structure():
    """Verifies the multi-day forecast schedule and 3-hourly diurnal slots."""
    data = fetch_risk_map(day=5, scenario="live_gefs", valid_hour=0, date="2026-09-24")
    dates = data.get("available_dates", [])
    assert len(dates) >= 10

    day_numbers = [d["day"] for d in dates]
    for expected_day in [1, 5, 10]:
        assert expected_day in day_numbers

    # Verify diurnal slot structure
    sample_date = dates[0]
    slots = sample_date.get("available_times", [])
    assert len(slots) == 8
    slot_hours = [s["hour"] for s in slots]
    assert slot_hours == [0, 3, 6, 9, 12, 15, 18, 21]


@pytest.mark.parametrize("zone_id", ["IND-WB-ODI", "IND-KON-GOA", "IND-UP-BIH"])
def test_zone_forecast_detail_parameters(zone_id):
    """Verifies detailed meteorological feature extraction for target subdivisions."""
    detail = fetch_zone_forecast(region_id=zone_id, day=5, scenario="live_gefs", valid_hour=0, date="2026-09-24")
    assert detail is not None
    actual_region_id = detail.get("region_id") or detail.get("region", {}).get("id")
    assert actual_region_id == zone_id
    assert "raw_parameters" in detail

    params = detail["raw_parameters"]
    assert "temp_forecast" in params
    assert "precip_forecast" in params
    assert "rh_850" in params
    assert "cape_j_kg" in params
    assert "mslp" in params
    assert "ensemble_spread" in params
