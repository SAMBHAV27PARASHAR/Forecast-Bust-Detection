"""
SIH 26079: Automated NOAA GEFS Background Refresh Poller Service
Safely schedules periodic background checks for new operational GEFS cycles (00z, 06z, 12z, 18z),
detects whether cycles are already cached, ingests new runs when available, and handles NOMADS
downtime or network timeouts gracefully without blocking API requests or corrupting active data.
"""

import threading
import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from .live_gefs_service import live_gefs_service
from ..core.config import GEFS_POLL_INTERVAL_SECONDS, GEFS_AUTO_POLL_ENABLED

logger = logging.getLogger("gefs_poller")


class GefsBackgroundPoller:
    def __init__(self, interval_seconds: int = GEFS_POLL_INTERVAL_SECONDS, enabled: bool = GEFS_AUTO_POLL_ENABLED):
        self.interval_seconds = interval_seconds
        self.enabled = enabled
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        # Operational telemetry state (all timestamps in UTC)
        self.is_running = False
        self.last_check_time_utc: Optional[str] = None
        self.last_status = "INITIALIZED"
        self.last_run_detected: Optional[str] = None
        self.last_ingested_cycle: Optional[str] = None
        self.consecutive_failures = 0
        self.last_error: Optional[str] = None

    def get_status(self) -> Dict[str, Any]:
        """Returns the current operational telemetry of the background poller."""
        with self._lock:
            return {
                "enabled": self.enabled,
                "running": self.is_running,
                "poll_interval_seconds": self.interval_seconds,
                "poll_interval_minutes": round(self.interval_seconds / 60, 1),
                "last_check_time_utc": self.last_check_time_utc,
                "last_status": self.last_status,
                "last_run_detected": self.last_run_detected,
                "last_ingested_cycle": self.last_ingested_cycle,
                "consecutive_failures": self.consecutive_failures,
                "last_error": self.last_error
            }

    def start(self):
        """Starts the background poller daemon thread."""
        if not self.enabled:
            print("[GEFS Poller] Background polling is disabled by configuration (GEFS_AUTO_POLL_ENABLED=false).")
            return

        with self._lock:
            if self.is_running:
                return
            self._stop_event.clear()
            self.is_running = True

        self._thread = threading.Thread(target=self._run_loop, name="GEFS-Background-Poller", daemon=True)
        self._thread.start()
        print(f"[GEFS Poller] Background scheduler started (interval: {self.interval_seconds}s / {round(self.interval_seconds/60, 1)}m).")

    def stop(self):
        """Signals the background poller thread to stop cleanly."""
        with self._lock:
            if not self.is_running:
                return
            self.is_running = False
            self._stop_event.set()

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        print("[GEFS Poller] Background scheduler stopped.")

    def _run_loop(self):
        """Main worker loop running in daemon thread."""
        # Initial brief wait to allow application startup and initial cache loading
        if self._stop_event.wait(timeout=10):
            return

        while not self._stop_event.is_set():
            try:
                self.poll_now()
            except Exception as e:
                with self._lock:
                    self.consecutive_failures += 1
                    self.last_error = str(e)
                    self.last_status = "INGESTION_FAILURE"
                print(f"[GEFS Poller] Ingestion failure: unexpected exception in poller loop: {e}")

            # Sleep until next interval or until stopped
            if self._stop_event.wait(timeout=self.interval_seconds):
                break

    def poll_now(self) -> Dict[str, Any]:
        """
        Executes a single check cycle against NOAA NOMADS.
        Can be called by the background loop or triggered manually on-demand.
        """
        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

        with self._lock:
            self.last_check_time_utc = now_utc
            self.last_status = "CHECK_STARTED"

        print(f"[GEFS Poller] Check started: checking NOAA NOMADS for new operational cycles (UTC: {now_utc})")

        try:
            # 1. Discover latest cycle available on NOMADS without triggering full download
            is_new, latest_cycle, cached_cycle = live_gefs_service.check_new_cycle_available()

            if latest_cycle is None:
                err_msg = "could not reach NOAA NOMADS GEFS operational directory (downtime/timeout). Existing forecast data preserved."
                with self._lock:
                    self.consecutive_failures += 1
                    self.last_error = err_msg
                    self.last_status = "INGESTION_FAILURE"
                print(f"[GEFS Poller] Ingestion failure: {err_msg}")
                return {
                    "status": "INGESTION_FAILURE",
                    "error": err_msg,
                    "check_time_utc": now_utc
                }

            with self._lock:
                self.last_run_detected = latest_cycle

            # 2. Duplicate check: is run already present?
            if not is_new:
                with self._lock:
                    self.last_status = "RUN_ALREADY_PRESENT"
                    self.consecutive_failures = 0
                    self.last_error = None
                print(f"[GEFS Poller] Run already present: cycle {latest_cycle} is already cached and active. Ingestion skipped.")
                return {
                    "status": "RUN_ALREADY_PRESENT",
                    "cycle": latest_cycle,
                    "cached_cycle": cached_cycle,
                    "check_time_utc": now_utc
                }

            # 3. New cycle detected -> ingest
            print(f"[GEFS Poller] Run detected: new cycle available on NOMADS: {latest_cycle}. Starting ingestion...")
            with self._lock:
                self.last_status = "RUN_DETECTED"

            # Execute ingestion using the existing pipeline
            res = live_gefs_service.refresh_live_forecast(force=True)

            if res.get("status") == "SUCCESS":
                elapsed = res.get("elapsed_seconds", 0)
                with self._lock:
                    self.last_ingested_cycle = latest_cycle
                    self.last_status = "INGESTION_SUCCESS"
                    self.consecutive_failures = 0
                    self.last_error = None
                print(f"[GEFS Poller] Ingestion success: cycle {latest_cycle} ingested and cached successfully in {elapsed}s.")
                return {
                    "status": "INGESTION_SUCCESS",
                    "cycle": latest_cycle,
                    "elapsed_seconds": elapsed,
                    "check_time_utc": now_utc
                }
            elif res.get("status") == "UP_TO_DATE":
                with self._lock:
                    self.last_status = "RUN_ALREADY_PRESENT"
                    self.consecutive_failures = 0
                print(f"[GEFS Poller] Run already present: cycle {latest_cycle} is already cached. Ingestion skipped.")
                return {
                    "status": "RUN_ALREADY_PRESENT",
                    "cycle": latest_cycle,
                    "check_time_utc": now_utc
                }
            else:
                err_msg = res.get("message", "Unknown ingestion error")
                with self._lock:
                    self.consecutive_failures += 1
                    self.last_error = err_msg
                    self.last_status = "INGESTION_FAILURE"
                print(f"[GEFS Poller] Ingestion failure: {err_msg}. Existing forecast data preserved.")
                return {
                    "status": "INGESTION_FAILURE",
                    "error": err_msg,
                    "check_time_utc": now_utc
                }

        except Exception as e:
            err_msg = f"Exception during NOMADS poll check: {e}"
            with self._lock:
                self.consecutive_failures += 1
                self.last_error = err_msg
                self.last_status = "INGESTION_FAILURE"
            print(f"[GEFS Poller] Ingestion failure: {err_msg}. Existing forecast data preserved.")
            return {
                "status": "INGESTION_FAILURE",
                "error": err_msg,
                "check_time_utc": now_utc
            }


# Global singleton poller instance
gefs_poller_service = GefsBackgroundPoller()
