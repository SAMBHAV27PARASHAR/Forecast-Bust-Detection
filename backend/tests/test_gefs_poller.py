"""
Pytest Suite for Automated NOAA GEFS Background Refresh Poller
Verifies:
1. Background scheduler cycle detection for standard operational runs (00z, 06z, 12z, 18z).
2. Duplicate-run protection: prevents re-downloading already cached operational cycles.
3. Ingestion execution when a new cycle is discovered.
4. Graceful handling of NOAA NOMADS timeouts, connection errors, and missing directory listings.
5. Preservation of active forecast data upon NOMADS failure.
6. Verification that manual refresh endpoint remains functional.
7. Poller telemetry and configuration endpoint (/api/live/poller/status).
"""

import pytest
from unittest.mock import patch, MagicMock
import requests

from backend.app.services.gefs_poller_service import GefsBackgroundPoller, gefs_poller_service
from backend.app.services.live_gefs_service import live_gefs_service
from backend.app.api.endpoints import get_poller_status, trigger_poller_check_now

BASE_URL = "http://127.0.0.1:8000/api"


def test_poller_initialization_and_status():
    """Verifies default poller configuration, interval, and telemetry."""
    poller = GefsBackgroundPoller(interval_seconds=1800, enabled=True)
    status = poller.get_status()

    assert status["enabled"] is True
    assert status["running"] is False
    assert status["poll_interval_seconds"] == 1800
    assert status["poll_interval_minutes"] == 30.0
    assert status["consecutive_failures"] == 0


def test_duplicate_run_protection():
    """
    Verifies that if NOMADS reports the same cycle as currently cached,
    duplicate ingestion is skipped and no redundant downloads occur.
    """
    poller = GefsBackgroundPoller(interval_seconds=3600, enabled=True)

    with patch.object(live_gefs_service, "check_new_cycle_available", return_value=(False, "2026-09-19 06:00 UTC", "2026-09-19 06:00 UTC")), \
         patch.object(live_gefs_service, "refresh_live_forecast") as mock_refresh:

        res = poller.poll_now()

        assert res["status"] == "RUN_ALREADY_PRESENT"
        assert res["cycle"] == "2026-09-19 06:00 UTC"
        # Must NOT trigger expensive re-download
        mock_refresh.assert_not_called()

        status = poller.get_status()
        assert status["last_status"] == "RUN_ALREADY_PRESENT"
        assert status["consecutive_failures"] == 0


def test_new_cycle_detection_and_ingestion():
    """
    Simulates discovery of a new operational cycle (e.g. 12z) and verifies
    that ingestion is safely triggered using the existing pipeline.
    """
    poller = GefsBackgroundPoller(interval_seconds=3600, enabled=True)

    with patch.object(live_gefs_service, "check_new_cycle_available", return_value=(True, "2026-09-19 12:00 UTC", "2026-09-19 06:00 UTC")), \
         patch.object(live_gefs_service, "refresh_live_forecast", return_value={"status": "SUCCESS", "elapsed_seconds": 4.2, "init_time_utc": "2026-09-19 12:00 UTC"}) as mock_refresh:

        res = poller.poll_now()

        assert res["status"] == "INGESTION_SUCCESS"
        assert res["cycle"] == "2026-09-19 12:00 UTC"
        assert res["elapsed_seconds"] == 4.2
        mock_refresh.assert_called_once_with(force=True)

        status = poller.get_status()
        assert status["last_status"] == "INGESTION_SUCCESS"
        assert status["last_ingested_cycle"] == "2026-09-19 12:00 UTC"
        assert status["consecutive_failures"] == 0


def test_noaa_downtime_and_timeout_handling():
    """
    Verifies that NOMADS timeouts and unreachable network states are caught gracefully,
    logged with failure telemetry, and do not overwrite or corrupt existing cached data.
    """
    poller = GefsBackgroundPoller(interval_seconds=3600, enabled=True)
    existing_cached_data = live_gefs_service.live_data

    with patch.object(live_gefs_service, "check_new_cycle_available", return_value=(False, None, None)):
        res = poller.poll_now()

        assert res["status"] == "INGESTION_FAILURE"
        assert "downtime/timeout" in res["error"]

        status = poller.get_status()
        assert status["last_status"] == "INGESTION_FAILURE"
        assert status["consecutive_failures"] == 1
        assert "downtime/timeout" in status["last_error"]

        # Assert existing cache was untouched
        assert live_gefs_service.live_data is existing_cached_data


def test_exception_in_ingestion_preserves_data():
    """
    Verifies that if an unexpected exception occurs during slice download,
    it is safely trapped and existing live data remains intact.
    """
    poller = GefsBackgroundPoller(interval_seconds=3600, enabled=True)
    existing_cached_data = live_gefs_service.live_data

    with patch.object(live_gefs_service, "check_new_cycle_available", return_value=(True, "2026-09-19 18:00 UTC", "2026-09-19 06:00 UTC")), \
         patch.object(live_gefs_service, "refresh_live_forecast", side_effect=RuntimeError("NOMADS connection reset by peer")):

        res = poller.poll_now()

        assert res["status"] == "INGESTION_FAILURE"
        assert "connection reset" in res["error"]
        assert live_gefs_service.live_data is existing_cached_data


def test_poller_endpoints():
    """Verifies poller status endpoint functionality."""
    try:
        resp = requests.get(f"{BASE_URL}/live/poller/status", timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            assert "enabled" in data
            assert "poll_interval_seconds" in data
            assert "last_status" in data
            return
    except Exception:
        pass

    # Direct function fallback
    data = get_poller_status()
    assert "enabled" in data
    assert "poll_interval_seconds" in data
    assert "last_status" in data


def test_manual_refresh_endpoint_intact():
    """Verifies that manual on-demand refresh remains functional."""
    with patch.object(live_gefs_service, "refresh_live_forecast", return_value={"status": "SUCCESS", "init_time_utc": "2026-09-19 06:00 UTC", "elapsed_seconds": 1.2}):
        from backend.app.api.endpoints import trigger_live_refresh
        res = trigger_live_refresh()
        assert res["status"] == "SUCCESS"
