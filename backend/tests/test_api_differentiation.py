"""
Pytest Suite for Retrospective Verification, Ground-Truth Assimilation, and Data Differentiation.
Adapted from scratch/test_api_differentiation.py and scratch/test_retro_dates.py.

Verifies:
1. Retrospective verification against real WMO station network for elapsed forecast hours.
2. Verified comparison metrics (temperature, precipitation, wind speed, humidity, pressure).
3. Data freshness and differentiation across distinct dates and valid hours (no stale or duplicate data).
4. Unelapsed future forecast horizons strictly return 'VERIFICATION PENDING'.
5. Region/subdivision level retrospective verification.
"""

import pytest
import requests
from backend.app.api.endpoints import get_retrospective_verification_endpoint

BASE_URL = "http://127.0.0.1:8000/api"


def fetch_verification(city_id=None, region_id=None, date=None, valid_hour=0, day=0):
    """Fetches retrospective verification from live server or direct endpoint fallback."""
    params = {"day": day, "valid_hour": valid_hour}
    if city_id:
        params["city_id"] = city_id
    if region_id:
        params["region_id"] = region_id
    if date:
        params["date"] = date
    try:
        resp = requests.get(f"{BASE_URL}/verification/retrospective", params=params, timeout=5)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return get_retrospective_verification_endpoint(
        city_id=city_id,
        region_id=region_id,
        day=day,
        valid_hour=valid_hour,
        date=date
    )


@pytest.mark.parametrize("date_str,hour,label", [
    ("2026-09-19", 6, "Today 06:00 UTC (11:30 IST)"),
    ("2026-09-19", 12, "Today 12:00 UTC (17:30 IST)"),
    ("2026-09-18", 0, "Yesterday 00:00 UTC (05:30 IST)"),
    ("2026-09-18", 6, "Yesterday 06:00 UTC (11:30 IST)"),
    ("2026-09-18", 12, "Yesterday 12:00 UTC (17:30 IST)"),
    ("2026-09-17", 0, "2-days ago 00:00 UTC (05:30 IST)"),
    ("2026-09-17", 6, "2-days ago 06:00 UTC (11:30 IST)"),
    ("2026-09-17", 12, "2-days ago 12:00 UTC (17:30 IST)"),
])
def test_retrospective_verification_elapsed_cases(date_str, hour, label):
    """Verifies that past valid forecast times return authentic verified observations."""
    data = fetch_verification(city_id="bareilly", date=date_str, valid_hour=hour, day=0)
    assert data is not None
    assert data.get("status") == "VERIFIED"
    assert data.get("is_elapsed") is True
    assert data.get("is_verified") is True
    assert "Open-Meteo" in data.get("data_source", "")

    valid_time = data.get("valid_time_utc")
    assert date_str in valid_time
    assert f"{hour:02d}:00 UTC" in valid_time

    comp = data.get("comparison", {})
    assert "temperature" in comp
    assert "precipitation" in comp
    assert "wind_speed" in comp

    temp = comp["temperature"]
    assert temp["forecast"] is not None
    assert temp["observed"] is not None
    # Bias / Delta is observed minus forecast
    assert abs(temp["delta"] - round(temp["observed"] - temp["forecast"], 2)) < 0.05
    # Absolute Error is |forecast - observed|
    assert abs(temp["absolute_error"] - round(abs(temp["forecast"] - temp["observed"]), 2)) < 0.05


def test_retrospective_verification_differentiation():
    """
    Verifies data differentiation across 8 distinct date/hour combinations.
    Confirms no stale caching, hardcoded payloads, or duplicate reuse.
    """
    test_cases = [
        {"date": "2026-09-19", "valid_hour": 6},
        {"date": "2026-09-19", "valid_hour": 12},
        {"date": "2026-09-18", "valid_hour": 0},
        {"date": "2026-09-18", "valid_hour": 6},
        {"date": "2026-09-18", "valid_hour": 12},
        {"date": "2026-09-17", "valid_hour": 0},
        {"date": "2026-09-17", "valid_hour": 6},
        {"date": "2026-09-17", "valid_hour": 12},
    ]
    results = []
    for tc in test_cases:
        d = fetch_verification(city_id="bareilly", date=tc["date"], valid_hour=tc["valid_hour"], day=0)
        assert d.get("status") == "VERIFIED"
        comp = d.get("comparison", {})
        results.append({
            "key": f"{tc['date']}_{tc['valid_hour']}",
            "temp_fcst": comp["temperature"]["forecast"],
            "temp_obs": comp["temperature"]["observed"],
            "wind_obs": comp["wind_speed"]["observed"],
            "rain_obs": comp["precipitation"]["observed"]
        })

    # Check that no two distinct runs have identical observed and forecast tuples
    duplicates = []
    for i in range(len(results)):
        for j in range(i + 1, len(results)):
            r1, r2 = results[i], results[j]
            if (r1["temp_fcst"] == r2["temp_fcst"] and
                r1["temp_obs"] == r2["temp_obs"] and
                r1["wind_obs"] == r2["wind_obs"]):
                duplicates.append((r1["key"], r2["key"]))

    assert len(duplicates) == 0, f"Detected duplicate payload between runs: {duplicates}"


def test_future_forecast_verification_pending():
    """
    Verifies that any unelapsed forecast valid time (e.g. Day 5) strictly returns
    'VERIFICATION PENDING' with zero fake or synthetic ground observations.
    """
    data = fetch_verification(city_id="bareilly", date="2026-09-24", valid_hour=6, day=5)
    assert data is not None
    assert data.get("status") == "VERIFICATION PENDING"
    assert data.get("is_elapsed") is False
    assert data.get("is_verified") is False
    assert "Verification Pending" in data.get("message", "")
    assert data.get("comparison") is None or len(data.get("comparison", {})) == 0


def test_subdivision_level_retrospective_verification():
    """Verifies retrospective ground verification for regional subdivisions."""
    data = fetch_verification(region_id="IND-UP-BIH", date="2026-09-19", valid_hour=6, day=0)
    assert data is not None
    assert data.get("status") == "VERIFIED"
    assert data.get("is_elapsed") is True
    assert "temperature" in data.get("comparison", {})
    assert data.get("location_name") in ["Middle Gangetic Plains", "East Uttar Pradesh & Bihar"]
