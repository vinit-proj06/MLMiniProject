"""Flask API: validate input, load saved pipelines, and return predictions."""

import json
import math
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from backend.features import FEATURES, FEATURE_NAMES, MODEL_INFO, PRICE_RANGES

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class InputError(ValueError):
    def __init__(self, message, details=None):
        super().__init__(message)
        self.details = details or []


def validate_features(values):
    """Require all 20 measurements; never silently replace missing API input."""
    if not isinstance(values, dict):
        raise InputError("Provide a features object containing all 20 mobile specifications.")

    errors = []
    unexpected = set(values) - set(FEATURE_NAMES)
    if unexpected:
        errors.append("Unknown features: " + ", ".join(sorted(unexpected)))

    clean_values = {}
    for spec in FEATURES:
        name = spec["name"]
        value = values.get(name)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            errors.append(f"{spec['label']} must be a number.")
            continue
        if isinstance(value, float) and not math.isfinite(value):
            errors.append(f"{spec['label']} must be a finite number.")
            continue
        if spec["type"] in ("integer", "binary") and int(value) != value:
            errors.append(f"{spec['label']} must be a whole number.")
            continue
        if not spec["min"] <= value <= spec["max"]:
            errors.append(f"{spec['label']} must be between {spec['min']} and {spec['max']}.")
            continue
        clean_values[name] = int(value) if spec["type"] != "number" else float(value)

    if errors:
        raise InputError("Please check the mobile specifications.", errors)
    return clean_values


def create_app(model_directory=None):
    app = Flask(__name__, static_folder=str(PROJECT_ROOT / "frontend"), static_url_path="")
    app.config["MAX_CONTENT_LENGTH"] = 32 * 1024
    model_directory = Path(model_directory or PROJECT_ROOT / "models")
    saved_models = {}
    metrics = None
    startup_error = None

    # Load artifacts once at startup. No fitting or train/test splitting in API requests.
    try:
        metrics = json.loads((model_directory / "metrics.json").read_text(encoding="utf-8"))
        for model in MODEL_INFO:
            pipeline = joblib.load(model_directory / f"{model['id']}.joblib")
            if list(pipeline.feature_names_in_) != FEATURE_NAMES:
                raise ValueError("Saved model feature order does not match the API schema.")
            saved_models[model["id"]] = pipeline
    except Exception as error:
        # Missing, corrupt, or incompatible artifacts get a clear setup message.
        saved_models.clear()
        startup_error = "Models are unavailable. Run python -m ml.train, then restart the server."
        app.logger.warning("Could not load model artifacts: %s", error)

    def require_models():
        if startup_error:
            return jsonify(error=startup_error, details=[]), 503
        return None

    def read_payload():
        if not request.is_json:
            raise InputError("Send a JSON request with Content-Type: application/json.")
        payload = request.get_json()
        if not isinstance(payload, dict):
            raise InputError("The request body must be a JSON object.")
        model_id = payload.get("model")
        if model_id not in [model["id"] for model in MODEL_INFO]:
            raise InputError("Choose either random_forest or svm.")
        return payload, model_id

    def predict(model_id, features):
        # Explicit column order prevents mismatches between the form and trained model.
        row = pd.DataFrame([features], columns=FEATURE_NAMES)
        price_range = int(saved_models[model_id].predict(row)[0])
        category = PRICE_RANGES[price_range]
        model_name = next(model["name"] for model in MODEL_INFO if model["id"] == model_id)
        return {
            "model": model_id, "model_name": model_name,
            "price_range": price_range, "label": category["label"],
            "description": category["description"], "features": features,
        }

    @app.get("/")
    def home():
        return app.send_static_file("index.html")

    @app.get("/api/health")
    def health():
        return jsonify(status="ready" if not startup_error else "unavailable", models_loaded=len(saved_models)), 200 if not startup_error else 503

    @app.get("/api/metadata")
    def metadata():
        return jsonify(features=FEATURES, models=MODEL_INFO, price_ranges=PRICE_RANGES,
                       dataset=metrics["dataset"] if metrics else None)

    @app.get("/api/metrics")
    def model_metrics():
        unavailable = require_models()
        if unavailable:
            return unavailable
        return jsonify(metrics)

    @app.post("/api/predict")
    def predict_mobile():
        unavailable = require_models()
        if unavailable:
            return unavailable
        payload, model_id = read_payload()
        features = validate_features(payload.get("features"))
        return jsonify(predict(model_id, features))

    @app.post("/api/compare")
    def compare_mobiles():
        unavailable = require_models()
        if unavailable:
            return unavailable
        payload, model_id = read_payload()
        mobiles = payload.get("mobiles")
        if not isinstance(mobiles, list) or len(mobiles) != 2:
            raise InputError("Provide exactly two mobiles to compare.")

        # Validate both phones before making either prediction.
        validated_mobiles = []
        for index, mobile in enumerate(mobiles):
            if not isinstance(mobile, dict):
                raise InputError(f"Mobile {index + 1} must be an object.")
            name = mobile.get("name", f"Mobile {index + 1}")
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 50:
                raise InputError(f"Mobile {index + 1} needs a name of 1 to 50 characters.")
            try:
                features = validate_features(mobile.get("features"))
            except InputError as error:
                raise InputError(f"Please check {name.strip()}.", error.details) from error
            validated_mobiles.append((name.strip(), features))

        results = [{"name": name, **predict(model_id, features)} for name, features in validated_mobiles]
        left, right = results
        if left["price_range"] == right["price_range"]:
            summary = f"Both mobiles are predicted in the {left['label']} price range."
        else:
            higher = max(results, key=lambda mobile: mobile["price_range"])
            summary = f"{higher['name']} is predicted in a higher price range. A higher range does not necessarily mean a better phone."
        return jsonify(model=model_id, model_name=left["model_name"], mobiles=results, summary=summary)

    @app.errorhandler(InputError)
    def input_error(error):
        return jsonify(error=str(error), details=error.details), 400

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error=error.description, details=[]), error.code

    @app.errorhandler(Exception)
    def unexpected_error(error):
        app.logger.exception("Unexpected request failure")
        return jsonify(error="The server could not complete this request. Please try again.", details=[]), 500

    return app
