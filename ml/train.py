"""
SIH 26079: Model Training and Calibration Pipeline
Trains an ensemble tree classifier to predict weather forecast bust risk
across medium-range lead times (Day 1 - Day 10).
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss, classification_report
from dataset_generator import generate_synthetic_nwp_dataset
from features import FEATURE_NAMES

def train_and_save_model(data_path: str = None, model_dir: str = "d:/SIH26079/models"):
    os.makedirs(model_dir, exist_ok=True)

    if data_path and os.path.exists(data_path):
        print(f"Loading existing dataset from {data_path}...")
        df = pd.read_csv(data_path)
    else:
        print("Synthesizing meteorological dataset...")
        df = generate_synthetic_nwp_dataset(num_samples=7000, random_seed=42)
        os.makedirs("d:/SIH26079/data", exist_ok=True)
        df.to_csv("d:/SIH26079/data/historical_nwp_dataset.csv", index=False)

    X = df[FEATURE_NAMES]
    y = df["bust_occurred"]

    print(f"Dataset shape: {X.shape}, Overall Bust Rate: {y.mean() * 100:.1f}%")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Train Random Forest with probability calibration
    clf = RandomForestClassifier(
        n_estimators=150,
        max_depth=10,
        min_samples_leaf=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    clf.fit(X_train, y_train)

    # Evaluate
    probs = clf.predict_proba(X_test)[:, 1]
    preds = (probs >= 0.5).astype(int)

    auc = roc_auc_score(y_test, probs)
    brier = brier_score_loss(y_test, probs)

    print(f"\n--- Model Evaluation Results ---")
    print(f"ROC-AUC Score: {auc:.4f}")
    print(f"Brier Calibration Loss: {brier:.4f}")
    print(classification_report(y_test, preds))

    # Feature Importances
    importances = clf.feature_importances_.tolist()
    importance_dict = dict(zip(FEATURE_NAMES, [round(x, 4) for x in importances]))
    print("\nFeature Importances:")
    for feat, imp in sorted(importance_dict.items(), key=lambda x: x[1], reverse=True):
        print(f"  - {feat:25s}: {imp:.4f}")

    # Lead-time specific bust rates
    lead_time_decay = {}
    for day in range(1, 11):
        day_mask = (df["lead_time_days"] == day)
        lead_time_decay[str(day)] = {
            "historical_bust_rate": round(float(df[day_mask]["bust_occurred"].mean() * 100), 1),
            "sample_count": int(day_mask.sum())
        }

    # Save artifact bundle
    model_payload = {
        "model": clf,
        "feature_names": FEATURE_NAMES,
        "feature_importances": importances,
        "metrics": {
            "roc_auc": round(float(auc), 4),
            "brier_score": round(float(brier), 4),
            "sample_count": len(df)
        },
        "thresholds": {
            "high_confidence_bust_max": 0.25,      # P(bust) < 0.25 -> High Confidence (>= 75%)
            "medium_confidence_bust_max": 0.50,    # 0.25 <= P(bust) < 0.50 -> Medium (50-74%)
            "low_confidence_bust_min": 0.50,       # P(bust) >= 0.50 -> Low Confidence (< 50%)
            "severe_risk_bust_min": 0.75           # P(bust) >= 0.75 -> Severe Bust Risk
        },
        "lead_time_decay": lead_time_decay
    }

    model_path = os.path.join(model_dir, "bust_classifier.pkl")
    joblib.dump(model_payload, model_path)
    print(f"\nTrained model successfully serialized to: {model_path}")

    # Write human-readable metadata
    meta = {
        "model_type": "RandomForestClassifier(n_estimators=150, max_depth=10)",
        "features": FEATURE_NAMES,
        "metrics": model_payload["metrics"],
        "thresholds": model_payload["thresholds"],
        "lead_time_decay": lead_time_decay
    }
    with open(os.path.join(model_dir, "model_metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)

    return model_path

if __name__ == "__main__":
    train_and_save_model()
