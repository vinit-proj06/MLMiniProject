"""Integration tests against the real, saved ML models (no mocked predictions).

Run ``python -m ml.train`` first, then:
    python -m unittest discover -s tests -v
"""

import json
import hashlib
import math
from pathlib import Path
import tempfile
import unittest

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support

from backend.app import create_app
from ml.dataset import DEFAULT_DATASET, load_dataset


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_IDS = ("random_forest", "svm")


class PredictionApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        model_directory = PROJECT_ROOT / "models"
        required_files = ["random_forest.joblib", "svm.joblib", "metrics.json"]
        missing = [name for name in required_files if not (model_directory / name).exists()]
        if missing:
            raise RuntimeError("Train the real models first: python -m ml.train. Missing: " + ", ".join(missing))

        cls.app = create_app(model_directory)
        cls.app.config["TESTING"] = True
        cls.client = cls.app.test_client()
        cls.metadata = cls.client.get("/api/metadata").get_json()
        cls.features = {spec["name"]: spec["default"] for spec in cls.metadata["features"]}
        cls.feature_names = [spec["name"] for spec in cls.metadata["features"]]
        cls.models = {name: joblib.load(model_directory / f"{name}.joblib") for name in MODEL_IDS}

    def predict(self, model="random_forest", features=None):
        return self.client.post("/api/predict", json={
            "model": model,
            "features": self.features.copy() if features is None else features,
        })

    def assert_input_error(self, response):
        self.assertEqual(response.status_code, 400, response.get_data(as_text=True))
        self.assertTrue(response.is_json)
        error = response.get_json()
        self.assertIsInstance(error["error"], str)
        self.assertTrue(error["error"])
        self.assertIsInstance(error["details"], list)
        self.assertNotIn("Traceback", response.get_data(as_text=True))

    def test_health_and_metadata(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ready", "models_loaded": 2})
        self.assertEqual(len(self.feature_names), 20)
        self.assertEqual(len(set(self.feature_names)), 20)
        self.assertNotIn("price_range", self.feature_names)
        self.assertEqual({model["id"] for model in self.metadata["models"]}, set(MODEL_IDS))
        self.assertEqual([item["label"] for item in self.metadata["price_ranges"]],
                         ["Low", "Medium", "High", "Very High"])

    def test_homepage_is_served(self):
        with self.client.get("/") as response:
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/html", response.content_type)
            self.assertIn(b"<html", response.data.lower())

    def test_both_models_match_saved_pipeline_predictions(self):
        # Use several distinct RAM values, including the limits, to exercise real inference.
        for model_id in MODEL_IDS:
            for ram in (256, 1024, 2048, 4000):
                with self.subTest(model=model_id, ram=ram):
                    features = {**self.features, "ram": ram}
                    expected = int(self.models[model_id].predict(
                        pd.DataFrame([features], columns=self.feature_names)
                    )[0])
                    response = self.predict(model_id, features)
                    self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
                    result = response.get_json()
                    self.assertEqual(result["price_range"], expected)
                    self.assertEqual(result["label"], ["Low", "Medium", "High", "Very High"][expected])
                    self.assertEqual(result["model"], model_id)
                    self.assertTrue(result["model_name"])
                    self.assertEqual(result["features"], features)
                    self.assertTrue(result["description"])

    def test_request_key_order_does_not_change_prediction(self):
        reverse_order = dict(reversed(list(self.features.items())))
        for model_id in MODEL_IDS:
            with self.subTest(model=model_id):
                normal = self.predict(model_id).get_json()
                reordered = self.predict(model_id, reverse_order).get_json()
                self.assertEqual(normal["price_range"], reordered["price_range"])

    def test_every_feature_is_required(self):
        for name in self.feature_names:
            with self.subTest(missing_feature=name):
                features = self.features.copy()
                del features[name]
                self.assert_input_error(self.predict(features=features))

    def test_feature_object_is_required(self):
        for value in (None, [], "phone", 123):
            with self.subTest(features=value):
                response = self.client.post("/api/predict", json={"model": "svm", "features": value})
                self.assert_input_error(response)

    def test_unknown_feature_is_rejected(self):
        self.assert_input_error(self.predict(features={**self.features, "price_range": 3}))

    def test_invalid_feature_types_and_ranges(self):
        invalid_values = [
            ("ram", "2048"), ("ram", None), ("ram", True), ("ram", 2048.5),
            ("ram", 0), ("ram", 4001), ("ram", 10 ** 400), ("clock_speed", 0.1),
            ("blue", 2), ("blue", -1), ("blue", 0.5),
        ]
        for name, value in invalid_values:
            with self.subTest(feature=name, value=value):
                self.assert_input_error(self.predict(features={**self.features, name: value}))

    def test_non_finite_numbers_are_rejected(self):
        for value in (math.nan, math.inf, -math.inf):
            with self.subTest(value=value):
                payload = {"model": "svm", "features": {**self.features, "clock_speed": value}}
                response = self.client.post("/api/predict", data=json.dumps(payload),
                                            content_type="application/json")
                self.assert_input_error(response)

    def test_invalid_or_missing_model(self):
        for model_id in (None, "decision_tree", "SVM", [], 2):
            with self.subTest(model=model_id):
                self.assert_input_error(self.predict(model_id))
        self.assert_input_error(self.client.post("/api/predict", json={"features": self.features}))

    def test_malformed_json_wrong_content_type_and_non_object_body(self):
        responses = [
            self.client.post("/api/predict", data="{invalid", content_type="application/json"),
            self.client.post("/api/predict", data="not JSON", content_type="text/plain"),
            self.client.post("/api/predict", data="null", content_type="application/json"),
            self.client.post("/api/predict", json=[]),
        ]
        for response in responses:
            with self.subTest(body=response.get_data(as_text=True)):
                self.assert_input_error(response)

    def test_two_mobile_comparison_for_both_models(self):
        mobiles = [
            {"name": "Entry phone", "features": {**self.features, "ram": 512}},
            {"name": "Power phone", "features": {**self.features, "ram": 3800}},
        ]
        for model_id in MODEL_IDS:
            with self.subTest(model=model_id):
                response = self.client.post("/api/compare", json={"model": model_id, "mobiles": mobiles})
                self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
                result = response.get_json()
                self.assertEqual(result["model"], model_id)
                self.assertEqual(len(result["mobiles"]), 2)
                self.assertTrue(result["summary"])
                for source, prediction in zip(mobiles, result["mobiles"]):
                    expected = self.predict(model_id, source["features"]).get_json()
                    self.assertEqual(prediction["name"], source["name"])
                    self.assertEqual(prediction["features"], source["features"])
                    self.assertEqual(prediction["price_range"], expected["price_range"])

    def test_comparison_tie_and_default_names(self):
        response = self.client.post("/api/compare", json={
            "model": "svm", "mobiles": [{"features": self.features}, {"features": self.features}],
        })
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual([mobile["name"] for mobile in result["mobiles"]], ["Mobile 1", "Mobile 2"])
        self.assertEqual(result["mobiles"][0]["price_range"], result["mobiles"][1]["price_range"])
        self.assertIn("Both", result["summary"])

    def test_comparison_requires_exactly_two_valid_mobiles(self):
        phone = {"name": "Phone", "features": self.features}
        for mobiles in (None, {}, [], [phone], [phone, phone, phone], [phone, None]):
            with self.subTest(mobiles=mobiles):
                response = self.client.post("/api/compare", json={"model": "svm", "mobiles": mobiles})
                self.assert_input_error(response)

        # A valid first phone must not hide errors in the second phone.
        response = self.client.post("/api/compare", json={
            "model": "svm", "mobiles": [phone, {"name": "Incomplete", "features": {"ram": 1024}}],
        })
        self.assert_input_error(response)
        self.assertNotIn("mobiles", response.get_json())

    def test_comparison_name_validation(self):
        for name in ("", "   ", "x" * 51, 42, None):
            with self.subTest(name=name):
                response = self.client.post("/api/compare", json={
                    "model": "random_forest",
                    "mobiles": [{"name": name, "features": self.features}, {"features": self.features}],
                })
                self.assert_input_error(response)

    def test_metrics_endpoint_returns_saved_training_results(self):
        saved_metrics = json.loads((PROJECT_ROOT / "models" / "metrics.json").read_text(encoding="utf-8"))
        response = self.client.get("/api/metrics")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), saved_metrics)

    def test_unknown_api_route_returns_json_error(self):
        response = self.client.get("/api/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(response.is_json)
        self.assertIn("error", response.get_json())


class MissingModelsTests(unittest.TestCase):
    def test_missing_artifacts_have_a_clear_recovery_message(self):
        with tempfile.TemporaryDirectory() as empty_directory:
            with self.assertLogs("backend.app", level="WARNING"):
                app = create_app(empty_directory)
            client = app.test_client()
            self.assertEqual(client.get("/api/health").status_code, 503)
            self.assertEqual(client.get("/api/metadata").status_code, 200)
            for path in ("/api/metrics", "/api/predict", "/api/compare"):
                with self.subTest(path=path):
                    response = client.get(path) if path.endswith("metrics") else client.post(path, json={})
                    self.assertEqual(response.status_code, 503)
                    self.assertIn("python -m ml.train", response.get_json()["error"])


class SavedEvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frame = load_dataset()
        cls.metrics = json.loads((PROJECT_ROOT / "models" / "metrics.json").read_text(encoding="utf-8"))
        cls.split = json.loads((PROJECT_ROOT / "models" / "split.json").read_text(encoding="utf-8"))
        cls.models = {name: joblib.load(PROJECT_ROOT / "models" / f"{name}.joblib") for name in MODEL_IDS}

    def test_saved_split_is_complete_disjoint_and_stratified(self):
        train_indices = self.split["train_indices"]
        test_indices = self.split["test_indices"]
        self.assertEqual(len(train_indices), 1600)
        self.assertEqual(len(test_indices), 400)
        self.assertEqual(len(train_indices), len(set(train_indices)))
        self.assertEqual(len(test_indices), len(set(test_indices)))
        self.assertFalse(set(train_indices) & set(test_indices))
        self.assertEqual(set(train_indices) | set(test_indices), set(self.frame.index))
        self.assertEqual(self.frame.loc[test_indices, "price_range"].value_counts().to_dict(),
                         {0: 100, 1: 100, 2: 100, 3: 100})
        source_hash = hashlib.sha256(DEFAULT_DATASET.read_bytes()).hexdigest()
        self.assertEqual(self.split["dataset_sha256"], source_hash)
        self.assertEqual(self.metrics["dataset"]["sha256"], source_hash)

    def test_saved_scores_match_fresh_predictions_on_actual_holdout(self):
        test_rows = self.frame.loc[self.split["test_indices"]]
        test_features = test_rows[self.metrics["feature_order"]]
        actual_labels = test_rows["price_range"]
        for model_id, model in self.models.items():
            with self.subTest(model=model_id):
                predicted_labels = model.predict(test_features)
                precision, recall, f1, _ = precision_recall_fscore_support(
                    actual_labels, predicted_labels, average="macro", zero_division=0,
                )
                expected = {"accuracy": accuracy_score(actual_labels, predicted_labels),
                            "precision": precision, "recall": recall, "f1": f1}
                for metric_name, value in expected.items():
                    self.assertAlmostEqual(self.metrics["models"][model_id][metric_name], value, places=12)
                self.assertEqual(self.metrics["models"][model_id]["confusion_matrix"],
                                 confusion_matrix(actual_labels, predicted_labels, labels=[0, 1, 2, 3]).tolist())

    def test_preprocessing_statistics_use_only_training_rows(self):
        train_features = self.frame.loc[self.split["train_indices"], self.metrics["feature_order"]]
        expected_medians = train_features.median().to_numpy()
        for model_id, model in self.models.items():
            with self.subTest(model=model_id):
                np.testing.assert_allclose(model.named_steps["imputer"].statistics_, expected_medians)
        svm = self.models["svm"]
        imputed_training = svm.named_steps["imputer"].transform(train_features)
        np.testing.assert_allclose(svm.named_steps["scaler"].mean_, imputed_training.mean(axis=0))
        np.testing.assert_allclose(svm.named_steps["scaler"].var_, imputed_training.var(axis=0))
        self.assertEqual(svm.named_steps["scaler"].n_samples_seen_, len(train_features))


if __name__ == "__main__":
    unittest.main()
