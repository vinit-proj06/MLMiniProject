"""Train, evaluate, and save both classifiers once: python -m ml.train."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import platform

import joblib
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.metrics import precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from ml.dataset import DEFAULT_DATASET, PROJECT_ROOT, load_dataset
from ml.features import CLASS_NAMES, FEATURE_NAMES

RANDOM_STATE = 42
TEST_SIZE = 0.20
SOURCE_URL = "https://www.kaggle.com/datasets/navjotkaushal/mobile-price-classification-dataset"


def create_models():
    """Use fixed settings; the test set is never used for tuning."""
    return {
        "random_forest": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("classifier", RandomForestClassifier(
                n_estimators=300, random_state=RANDOM_STATE, n_jobs=-1,
            )),
        ]),
        "svm": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("classifier", SVC(
                kernel="linear", C=1.0, random_state=RANDOM_STATE,
            )),
        ]),
    }


def evaluate_model(model, test_features, test_target):
    predictions = model.predict(test_features)
    precision, recall, f1, _ = precision_recall_fscore_support(
        test_target, predictions, average="macro", zero_division=0,
    )
    return {
        "accuracy": float(accuracy_score(test_target, predictions)),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "confusion_matrix": confusion_matrix(test_target, predictions, labels=[0, 1, 2, 3]).tolist(),
        "classification_report": classification_report(
            test_target, predictions, labels=[0, 1, 2, 3],
            target_names=CLASS_NAMES, output_dict=True, zero_division=0,
        ),
    }


def train(dataset_path=DEFAULT_DATASET, output_dir=PROJECT_ROOT / "models"):
    frame = load_dataset(dataset_path)
    features = frame[FEATURE_NAMES]
    target = frame["price_range"]

    # Stratification keeps equal representation of all price ranges. Both
    # models use this exact same held-out test set for a fair comparison.
    train_features, test_features, train_target, test_target = train_test_split(
        features, target, test_size=TEST_SIZE, random_state=RANDOM_STATE,
        stratify=target,
    )
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    trained_at = datetime.now(timezone.utc).isoformat()
    metrics = {
        "trained_at": trained_at,
        "feature_order": FEATURE_NAMES,
        "class_names": CLASS_NAMES,
        "metric_average": "macro",
        "dataset": {
            "name": "Mobile Price Classification Dataset",
            "source_url": SOURCE_URL,
            "filename": Path(dataset_path).name,
            "sha256": hashlib.sha256(Path(dataset_path).read_bytes()).hexdigest(),
            "rows": len(frame),
            "features": len(FEATURE_NAMES),
            "train_rows": len(train_features),
            "test_rows": len(test_features),
            "test_size": TEST_SIZE,
            "random_state": RANDOM_STATE,
            "stratified": True,
            "class_distribution": {str(label): int((target == label).sum()) for label in range(4)},
            "train_class_distribution": {str(label): int((train_target == label).sum()) for label in range(4)},
            "test_class_distribution": {str(label): int((test_target == label).sum()) for label in range(4)},
            "missing_feature_values": int(features.isna().sum().sum()),
            "duplicate_rows": int(frame.duplicated().sum()),
            "feature_ranges": {
                feature: {"min": float(features[feature].min()), "max": float(features[feature].max())}
                for feature in FEATURE_NAMES
            },
        },
        "versions": {
            "python": platform.python_version(), "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__, "joblib": joblib.__version__,
        },
        "models": {},
    }
    model_names = {"random_forest": "Random Forest", "svm": "SVM"}
    for model_id, model in create_models().items():
        # Pipeline.fit learns imputation/scaling from the training rows only.
        # Never fit again using the held-out test set.
        model.fit(train_features, train_target)
        model_metrics = evaluate_model(model, test_features, test_target)
        model_metrics["name"] = model_names[model_id]
        model_metrics["artifact"] = f"{model_id}.joblib"
        model_metrics["parameters"] = model.named_steps["classifier"].get_params()
        model_metrics["preprocessing"] = [name for name, _ in model.steps[:-1]]
        metrics["models"][model_id] = model_metrics
        joblib.dump(model, output_dir / f"{model_id}.joblib")
        print(f"{model_names[model_id]}: accuracy={model_metrics['accuracy']:.4f}, macro F1={model_metrics['f1']:.4f}")

    # Save the exact split so evaluation can be independently reproduced.
    split = {
        "train_indices": train_features.index.tolist(),
        "test_indices": test_features.index.tolist(),
        "dataset_sha256": metrics["dataset"]["sha256"],
    }
    (output_dir / "split.json").write_text(json.dumps(split, indent=2), encoding="utf-8")
    (output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    clean_path = PROJECT_ROOT / "data" / "mobile_clean.csv"
    frame.to_csv(clean_path, index=False)
    print(f"Saved fitted pipelines and measured test metrics to {output_dir}")
    return metrics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATASET, help="Path to the original Kaggle Mobile.csv")
    parser.add_argument("--output", type=Path, default=PROJECT_ROOT / "models", help="Folder for model artifacts")
    arguments = parser.parse_args()
    try:
        train(arguments.data, arguments.output)
    except (FileNotFoundError, ValueError) as error:
        raise SystemExit(f"Training failed: {error}") from error


if __name__ == "__main__":
    main()
