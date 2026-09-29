"""Convert the original Kaggle strings into numerical features."""

from pathlib import Path

import pandas as pd

from ml.features import BINARY_FEATURES, FEATURE_NAMES, SOURCE_COLUMNS, TARGET_LABELS

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = PROJECT_ROOT / "data" / "Mobile.csv"


def load_dataset(path=DEFAULT_DATASET):
    """Return a clean DataFrame without fitting any data-dependent transforms.

    Removing a known unit suffix and mapping Yes/No do not learn statistics from
    the data. Imputation and SVM scaling are instead fitted after the split,
    inside each training pipeline.
    """
    source = pd.read_csv(path)
    source.columns = source.columns.str.strip()
    missing_columns = set(SOURCE_COLUMNS) - set(source.columns)
    if missing_columns or "price_range" not in source:
        raise ValueError(
            "The dataset does not match the requested Kaggle Mobile.csv schema. "
            f"Missing feature columns: {sorted(missing_columns)}"
        )

    frame = source.rename(columns=SOURCE_COLUMNS)[FEATURE_NAMES + ["price_range"]].copy()
    for feature in FEATURE_NAMES:
        values = frame[feature].astype("string").str.strip()
        if feature in BINARY_FEATURES:
            converted = values.map({"Yes": 1, "No": 0})
        else:
            # Examples: '842 mAh' -> 842, '0.6 cm' -> 0.6, '2.2' -> 2.2.
            numeric_text = values.str.extract(r"^([+-]?\d+(?:\.\d+)?)(?:\s+[A-Za-z]+)?$", expand=False)
            converted = pd.to_numeric(numeric_text, errors="coerce")
        invalid = values.notna() & converted.isna()
        if invalid.any():
            examples = values[invalid].unique().tolist()[:3]
            raise ValueError(f"Invalid values in {feature}: {examples}")
        frame[feature] = converted.astype(float)

    labels = frame["price_range"].astype("string").str.strip()
    frame["price_range"] = labels.map(TARGET_LABELS)
    if frame["price_range"].isna().any():
        raise ValueError("Every row must have a known price_range label.")
    frame["price_range"] = frame["price_range"].astype(int)
    if frame.empty or set(frame["price_range"].unique()) != {0, 1, 2, 3}:
        raise ValueError("The dataset must include all four price ranges.")
    if frame.duplicated().any():
        raise ValueError("Duplicate rows found; inspect the data before splitting.")
    return frame
