"""
SIH 26079: ML Inference & Explainability Service
Loads the trained Random Forest model, runs inference, and computes meteorological attribution.
"""

import os
import sys
import joblib
import numpy as np
from typing import Dict, Any, Tuple, List

# Add ml folder to path for features import
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, "../../../"))
ml_dir = os.path.join(root_dir, "ml")
if ml_dir not in sys.path:
    sys.path.insert(0, ml_dir)

from features import compute_derived_features, calculate_contributing_factors, FEATURE_NAMES

MODEL_PATH = os.path.join(root_dir, "models", "bust_classifier.pkl")

class BustDetectionMLService:
    def __init__(self):
        self.model = None
        self.feature_importances = None
        self.thresholds = None
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                bundle = joblib.load(MODEL_PATH)
                self.model = bundle["model"]
                self.feature_importances = bundle["feature_importances"]
                self.thresholds = bundle["thresholds"]
                print(f"[ML Service] Successfully loaded trained model from {MODEL_PATH}")
            except Exception as e:
                print(f"[ML Service] Error loading model from {MODEL_PATH}: {e}")
                self.init_fallback()
        else:
            print(f"[ML Service] Model not found at {MODEL_PATH}, using calibrated fallback heuristics.")
            self.init_fallback()

    def init_fallback(self):
        # Calibrated weights aligned with meteorological NWP verification
        self.feature_importances = [
            0.12, 0.02, 0.02, 0.02, 0.03, 0.03, 0.02, 0.04, 0.50, 0.04, 0.11, 0.03
        ]
        self.thresholds = {
            "high_confidence_bust_max": 0.25,
            "medium_confidence_bust_max": 0.50,
            "low_confidence_bust_min": 0.50,
            "severe_risk_bust_min": 0.75
        }

    def predict(self, raw_input: Dict[str, Any]) -> Dict[str, Any]:
        import pandas as pd
        features = compute_derived_features(raw_input)
        X = pd.DataFrame([features], columns=FEATURE_NAMES)

        if self.model is not None:
            try:
                prob = float(self.model.predict_proba(X)[0, 1])
            except Exception:
                prob = self._heuristic_prob(raw_input)
        else:
            prob = self._heuristic_prob(raw_input)

        bust_pct = round(prob * 100.0, 1)
        confidence_pct = round(max(0.0, 100.0 - bust_pct), 1)

        # Risk Classification
        if prob < 0.25:
            risk_level = "Low"
            confidence_level = "High Confidence"
        elif prob < 0.50:
            risk_level = "Moderate"
            confidence_level = "Medium Confidence"
        elif prob < 0.75:
            risk_level = "High"
            confidence_level = "Low Confidence"
        else:
            risk_level = "Severe"
            confidence_level = "Bust Imminent (Critical)"

        # Explainability
        factors = calculate_contributing_factors(
            features, self.feature_importances, prob, top_k=4
        )

        top_trigger = factors[0]["feature_name"] if factors else "Numerical Dispersion"

        summary = (
            f"Forecast bust risk is {risk_level} ({bust_pct}% probability). "
            f"Lead-time confidence is {confidence_level} ({confidence_pct}%). "
            f"Primary sensitivity trigger: {top_trigger}."
        )

        return {
            "region_id": raw_input.get("region_id"),
            "forecast_day": int(raw_input.get("lead_time_days", 3)),
            "bust_probability": bust_pct,
            "confidence_score": confidence_pct,
            "risk_level": risk_level,
            "confidence_level": confidence_level,
            "dominant_factor": top_trigger,
            "contributing_factors": factors,
            "summary": summary
        }

    def _heuristic_prob(self, raw_input: Dict[str, Any]) -> float:
        day = float(raw_input.get("lead_time_days", 3))
        ens = float(raw_input.get("ensemble_spread", 1.2))
        cape = float(raw_input.get("cape_j_kg", 800.0))
        p_tend = float(raw_input.get("pressure_tendency_24h", -1.0))
        
        # Physical proxy
        score = 0.05 + (day / 10.0) * 0.25 + (ens / 4.0) * 0.45 + (cape / 3500.0) * 0.15 + (abs(min(0.0, p_tend)) / 8.0) * 0.10
        return float(np.clip(score, 0.02, 0.98))

ml_service = BustDetectionMLService()
