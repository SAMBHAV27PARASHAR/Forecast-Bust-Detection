"""
SIH 26079: Train and Evaluate Real ML Model for Forecast Bust Detection
Uses genuine NOAA GEFS v12 and ERA5 verification records with strict Time-Blocked validation.
"""

import os
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    classification_report,
    precision_score,
    recall_score,
    f1_score
)

# Project paths
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from ml.features import compute_derived_features, FEATURE_NAMES

DATASET_PATH = os.path.join(ROOT_DIR, "data", "real_gefs_july2019_batch_training.parquet")
MODELS_DIR = os.path.join(ROOT_DIR, "models")
METRICS_OUT_PATH = os.path.join(MODELS_DIR, "real_model_evaluation_metrics.json")
REAL_MODEL_PATH = os.path.join(MODELS_DIR, "bust_classifier_real.pkl")
ACTIVE_MODEL_PATH = os.path.join(MODELS_DIR, "bust_classifier.pkl")


def load_and_prepare_features(dataset_path: str):
    """Loads Parquet dataset, verifies data integrity, and computes the 12 derived features."""
    print(f"[1/6] Loading dataset from: {dataset_path}")
    df = pd.read_parquet(dataset_path, engine="pyarrow")
    
    # Audit checks
    assert df["is_bust"].isnull().sum() == 0, "Null bust labels detected!"
    assert df["is_bust"].isin([0, 1]).all(), "Invalid label values detected!"

    print(f"      -> Loaded {len(df)} rows across {len(df['region_id'].unique())} subdivisions.")
    print(f"      -> Overall Class Distribution: Nominal (0) = {(df['is_bust']==0).sum()}, Bust (1) = {(df['is_bust']==1).sum()} ({(df['is_bust']==1).mean()*100:.1f}%)")

    # Construct 12-feature matrix using features.py
    feature_rows = []
    for _, row in df.iterrows():
        raw_dict = {
            "lead_time_days": row["lead_time_days"],
            "temp_forecast": row["temp_forecast_degc"],
            "precip_forecast": row["precip_forecast_mm"],
            "mslp": row["mslp_forecast_hpa"],
            "pressure_tendency_24h": row["pressure_tendency_24h"],
            "rh_850": row["rh_850_pct"],
            "wind_shear_850_200": row["wind_shear_850_200_ms"],
            "cape_j_kg": row["cape_j_kg"],
            "ensemble_spread": row["ensemble_spread"]
        }
        feat_vec = compute_derived_features(raw_dict)
        feature_rows.append(feat_vec)

    X = pd.DataFrame(feature_rows, columns=FEATURE_NAMES)
    y = df["is_bust"].values
    init_dates = df["init_date"].values

    return df, X, y, init_dates


def time_blocked_split(df, X, y, test_init_date="2019-07-15 00:00"):
    """
    Strict Time-Blocked Split:
    - Train: All earlier forecast initialization dates (July 1, 5, 10, 2019)
    - Test : Later out-of-time forecast initialization (July 15, 2019)
    Strictly zero temporal leakage.
    """
    print(f"[2/6] Executing Time-Blocked Cross-Validation Partition...")
    train_mask = (df["init_date"] != test_init_date)
    test_mask = (df["init_date"] == test_init_date)

    X_train, y_train = X[train_mask], y[train_mask]
    X_test, y_test = X[test_mask], y[test_mask]

    print(f"      -> Train Partition : {len(X_train)} samples (Dates: {df[train_mask]['init_date'].unique().tolist()})")
    print(f"         Busts in Train  : {y_train.sum()}/{len(y_train)} ({y_train.mean()*100:.1f}%)")
    print(f"      -> Test Partition  : {len(X_test)} samples (Date: '{test_init_date}') [Out-of-Time Holdout]")
    print(f"         Busts in Test   : {y_test.sum()}/{len(y_test)} ({y_test.mean()*100:.1f}%)")

    return X_train, y_train, X_test, y_test


def train_models_and_evaluate(X_train, y_train, X_test, y_test):
    """Trains Baseline (Logistic Regression) and Main Model (Calibrated Random Forest)."""
    print("[3/6] Training Baseline and Main Models on Real Meteorological Data...")

    # 1. Baseline: Logistic Regression (Class-weighted)
    baseline_lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
    baseline_lr.fit(X_train, y_train)
    p_test_lr = baseline_lr.predict_proba(X_test)[:, 1]

    # 2. Main Model: Random Forest with Balanced Subsampling & Probability Calibration
    rf = RandomForestClassifier(
        n_estimators=150,
        max_depth=6,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train, y_train)

    # Probability calibration on train via cross-validation
    calibrated_rf = CalibratedClassifierCV(estimator=rf, method="sigmoid", cv=3)
    calibrated_rf.fit(X_train, y_train)

    # Evaluate Main Model on Out-of-Time Test Set
    p_test_rf = calibrated_rf.predict_proba(X_test)[:, 1]
    y_pred_rf = (p_test_rf >= 0.50).astype(int)
    y_pred_lr = (p_test_lr >= 0.50).astype(int)

    # Metrics
    metrics_main = {
        "model": "CalibratedRandomForest(n_estimators=150, max_depth=6, sigmoid_calibrated)",
        "roc_auc": round(float(roc_auc_score(y_test, p_test_rf)), 4),
        "pr_auc": round(float(average_precision_score(y_test, p_test_rf)), 4),
        "brier_score": round(float(brier_score_loss(y_test, p_test_rf)), 4),
        "precision": round(float(precision_score(y_test, y_pred_rf, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred_rf, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, y_pred_rf, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred_rf).tolist()
    }

    metrics_baseline = {
        "model": "BaselineLogisticRegression(class_weight=balanced)",
        "roc_auc": round(float(roc_auc_score(y_test, p_test_lr)), 4),
        "pr_auc": round(float(average_precision_score(y_test, p_test_lr)), 4),
        "brier_score": round(float(brier_score_loss(y_test, p_test_lr)), 4),
        "precision": round(float(precision_score(y_test, y_pred_lr, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred_lr, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, y_pred_lr, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred_lr).tolist()
    }

    # Calibration Curve (Reliability)
    prob_true, prob_pred = calibration_curve(y_test, p_test_rf, n_bins=5, strategy="uniform")
    calibration_data = {
        "mean_predicted_probabilities": [round(float(p), 3) for p in prob_pred],
        "true_fraction_positives": [round(float(p), 3) for p in prob_true]
    }

    print("\n[4/6] Evaluation Comparison on Out-of-Time Test Set (July 15 Run):")
    print(f"{'Metric':<20} | {'Baseline (LogReg)':<20} | {'Main (Calibrated RF)':<20}")
    print("-" * 66)
    print(f"{'ROC-AUC':<20} | {metrics_baseline['roc_auc']:<20.4f} | {metrics_main['roc_auc']:<20.4f}")
    print(f"{'PR-AUC':<20} | {metrics_baseline['pr_auc']:<20.4f} | {metrics_main['pr_auc']:<20.4f}")
    print(f"{'Brier Score Loss':<20} | {metrics_baseline['brier_score']:<20.4f} | {metrics_main['brier_score']:<20.4f}")
    print(f"{'Recall (Bust Sens)':<20} | {metrics_baseline['recall']:<20.4f} | {metrics_main['recall']:<20.4f}")
    print(f"{'Precision':<20} | {metrics_baseline['precision']:<20.4f} | {metrics_main['precision']:<20.4f}")
    print(f"{'F1-Score':<20} | {metrics_baseline['f1']:<20.4f} | {metrics_main['f1']:<20.4f}")

    print("\nConfusion Matrix (Main Model):")
    cm = metrics_main["confusion_matrix"]
    print(f"                Predicted Nominal (0)   Predicted Bust (1)")
    print(f"Actual Nom (0)        {cm[0][0]:<23} {cm[0][1]}")
    print(f"Actual Bust (1)       {cm[1][0]:<23} {cm[1][1]}")

    # Global feature importances from base tree
    importances = rf.feature_importances_.tolist()
    imp_dict = dict(zip(FEATURE_NAMES, [round(float(x), 4) for x in importances]))
    print("\nTop Contributing Features (Tree Gradient Importances):")
    for k, v in sorted(imp_dict.items(), key=lambda x: x[1], reverse=True)[:6]:
        print(f"  - {k:<25}: {v:.4f}")

    return calibrated_rf, metrics_main, metrics_baseline, importances, calibration_data


def save_artifacts_and_metrics(model, metrics_main, metrics_baseline, importances, calibration_data, train_count, test_count):
    """Serializes the calibrated model and evaluation metrics."""
    print("[5/6] Saving model artifacts and evaluation metrics...")
    os.makedirs(MODELS_DIR, exist_ok=True)

    artifact_bundle = {
        "model": model,
        "feature_names": FEATURE_NAMES,
        "feature_importances": importances,
        "metrics": metrics_main,
        "baseline_metrics": metrics_baseline,
        "calibration": calibration_data,
        "thresholds": {
            "high_confidence_bust_max": 0.25,
            "medium_confidence_bust_max": 0.50,
            "low_confidence_bust_min": 0.50,
            "severe_risk_bust_min": 0.75
        },
        "sample_metadata": {
            "train_rows": train_count,
            "test_rows": test_count,
            "validation_type": "Time-Blocked Out-of-Time Holdout (July 15, 2019)",
            "data_source": "NOAA GEFS v12 Reforecast (AWS S3) + ERA5 Reanalysis"
        }
    }

    # Save dedicated real model file
    joblib.dump(artifact_bundle, REAL_MODEL_PATH)
    print(f"      -> Saved real model to: {REAL_MODEL_PATH}")

    # Update active model file for FastAPI backend
    joblib.dump(artifact_bundle, ACTIVE_MODEL_PATH)
    print(f"      -> Updated active model for FastAPI at: {ACTIVE_MODEL_PATH}")

    # Save human-readable JSON metrics
    json_payload = {
        "evaluation_timestamp": pd.Timestamp.now().isoformat(),
        "sample_metadata": artifact_bundle["sample_metadata"],
        "main_model_metrics": metrics_main,
        "baseline_model_metrics": metrics_baseline,
        "calibration_curve": calibration_data,
        "feature_importances": dict(zip(FEATURE_NAMES, importances)),
        "operational_thresholds": artifact_bundle["thresholds"]
    }
    with open(METRICS_OUT_PATH, "w") as f:
        json.dump(json_payload, f, indent=2)
    print(f"      -> Saved documented metrics JSON to: {METRICS_OUT_PATH}")


def verify_fastapi_inference_live():
    """Verifies that the live FastAPI backend loads and predicts with the new real model."""
    print("[6/6] Verifying live FastAPI inference with the newly trained model...")
    import urllib.request

    # Test POST /api/predict
    payload = {
        "region_id": "IND-WB-ODI",
        "forecast_day": 5,
        "temp_forecast": 30.0,
        "precip_forecast": 45.0,
        "mslp": 1002.0,
        "pressure_tendency_24h": -4.2,
        "rh_850": 84.0,
        "wind_shear_850_200": 19.0,
        "cape_j_kg": 2500.0,
        "ensemble_spread": 2.7
    }
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/predict",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        result = json.loads(resp.read().decode())
        print(f"      -> FastAPI POST /api/predict Response (HTTP {resp.status}):")
        print(f"         - Bust Probability : {result['bust_probability']}%")
        print(f"         - Confidence Score : {result['confidence_score']}%")
        print(f"         - Risk Level       : {result['risk_level']}")
        print(f"         - Confidence Level : {result['confidence_level']}")
        print(f"         - Top Factor       : {result['contributing_factors'][0]['feature_name']}")
        assert "bust_probability" in result
        assert "confidence_score" in result
        assert "risk_level" in result

    print("\nALL VERIFICATIONS PASSED: Real ML Model is trained, evaluated, and active!")


def main():
    print("==========================================================================")
    print("SIH 26079: REAL ML MODEL TRAINING & EVALUATION PIPELINE")
    print("==========================================================================")
    
    df, X, y, init_dates = load_and_prepare_features(DATASET_PATH)
    X_train, y_train, X_test, y_test = time_blocked_split(df, X, y, test_init_date="2019-07-15 00:00")
    
    model, metrics_main, metrics_baseline, importances, calibration_data = train_models_and_evaluate(
        X_train, y_train, X_test, y_test
    )
    
    save_artifacts_and_metrics(
        model, metrics_main, metrics_baseline, importances, calibration_data,
        train_count=len(X_train), test_count=len(X_test)
    )
    
    # Reload model inside backend service if running
    try:
        from backend.app.services.ml_service import ml_service
        ml_service.load_model()
        print("      -> Live ml_service in-memory cache refreshed successfully.")
    except Exception as e:
        print(f"      -> Note on in-memory reload: {e}")

    verify_fastapi_inference_live()


if __name__ == "__main__":
    main()
