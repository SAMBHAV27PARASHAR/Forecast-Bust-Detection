"""
SIH 26079: Application Configuration & Operational Thresholds
"""

from typing import Dict

PROJECT_NAME = "AI-Based Forecast Bust Detection (SIH 26079)"
VERSION = "1.0.0"
API_PREFIX = "/api"

# Operational Thresholds for Forecast Confidence & Bust Risk
# Calibrated using medium-range NWP error distribution (IMD/ECMWF standard)
CONFIDENCE_THRESHOLDS: Dict[str, float] = {
    "HIGH_CONFIDENCE_MIN": 75.0,    # Confidence >= 75% -> Bust Risk < 25%
    "MEDIUM_CONFIDENCE_MIN": 50.0,  # Confidence 50-74% -> Bust Risk 25-49%
    "LOW_CONFIDENCE_MIN": 25.0,     # Confidence 25-49% -> Bust Risk 50-74%
    "SEVERE_BUST_THRESHOLD": 75.0   # Bust Risk >= 75% -> Critical Bust Warning
}

# Ground truth bust validation criteria
VALIDATION_CRITERIA = {
    "rain_bust_threshold_mm": 35.0,
    "temp_bust_threshold_deg": 4.5,
    "wind_bust_threshold_ms": 12.0
}

import os
# NOAA GEFS Background Poller Settings (Default 3600 seconds = 1 hour)
GEFS_POLL_INTERVAL_SECONDS = int(os.getenv("GEFS_POLL_INTERVAL_SECONDS", "3600"))
GEFS_AUTO_POLL_ENABLED = os.getenv("GEFS_AUTO_POLL_ENABLED", "true").lower() in ("true", "1", "yes")

