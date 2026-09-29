# Mobile Price Range Prediction

A complete college ML mini project that predicts a mobile phone's **price category** from 20 specifications. It includes reproducible Scikit-learn training code, a Flask API, and a responsive HTML/CSS/JavaScript interface.

The target is `price_range`: **0 = Low, 1 = Medium, 2 = High, 3 = Very High**. These are relative classes from the dataset, not prices in rupees or dollars.

## Features

- Homepage with the project overview, dataset, and algorithms.
- Prediction form covering every required specification and both model choices.
- Result view with the category, model, and submitted specifications.
- Model comparison with accuracy, macro precision, macro recall, and macro F1 calculated from the real held-out data.
- Two-phone comparison with specifications and independently predicted categories.
- Responsive layouts, field validation, and readable API error messages.

## Setup and run

Use Python **3.12** (the tested version); the pinned dependencies require Python 3.12 or newer. Clone the repository first, then run the setup commands from its directory:

```bash
git clone https://github.com/vinit-proj06/MLMiniProject.git
cd MLMiniProject
```

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m ml.train
.\.venv\Scripts\python.exe run.py
```

**macOS or Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m ml.train
python run.py
```

Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)**. Keep the terminal running; press `Ctrl+C` to stop the server. The frontend is served by Flask, so no Node.js, frontend build, or separate development server is needed.

After the first setup and training, start with `.\.venv\Scripts\python.exe run.py`, or double-click `start.bat`. You only need to train again when intentionally rebuilding the models.

Training is a separate command. It writes the models and measured evaluation results to `models/`. The API loads those files once when it starts and reuses them for every prediction. After retraining, restart the server. If the saved models are missing, the API returns a clear `503` response explaining the training command.

Generated models, metrics, split indices, cleaned CSV, environments, caches, and test screenshots are excluded from Git. Every contributor runs the training command once locally. The small original dataset and its attribution are included so setup does not need a Kaggle account.

## Dataset

Source: [Mobile Price Classification Dataset by Navjot Kaushal on Kaggle](https://www.kaggle.com/datasets/navjotkaushal/mobile-price-classification-dataset).

The source CSV is stored at `data/Mobile.csv`. It contains 2,000 labeled phones with 20 input features and 500 examples in each of the four target classes. Training converts the source's descriptive headers, units, and Yes/No values to the numeric feature names below. No synthetic examples or hardcoded scores are used.

The input ranges follow this older dataset. A current phone with specifications outside these ranges is outside the intended scope of the demo. Some dataset rows include zero pixel height or screen width. These values are preserved rather than silently changing the source data.

## Input features

All 20 inputs are required. Binary inputs use `0 = No` and `1 = Yes`; the UI displays readable choices. RAM is measured in **MB**, storage in **GB**, and thickness in **cm**.

The source has inconsistent camera/display unit labels and a screen-width header typo. The interface uses conventional MP, px, and screen-width meanings without numerically converting the measurements; see [the documented schema interpretations](data/README.md#cleaning-and-column-mapping).

| API field | Meaning | Accepted range / unit |
| --- | --- | --- |
| `battery_power` | Battery capacity | 500–2,000 mAh |
| `blue` | Bluetooth support | 0 or 1 |
| `clock_speed` | Processor clock speed | 0.5–3.0 GHz |
| `dual_sim` | Dual SIM support | 0 or 1 |
| `fc` | Front camera resolution | 0–20 MP |
| `four_g` | 4G support | 0 or 1 |
| `int_memory` | Internal storage | 2–64 GB |
| `m_dep` | Phone thickness | 0.1–1.0 cm |
| `mobile_wt` | Phone weight | 80–200 g |
| `n_cores` | Processor cores | 1–8 |
| `pc` | Rear camera resolution | 0–20 MP |
| `px_height` | Vertical pixel resolution | 0–2,000 px |
| `px_width` | Horizontal pixel resolution | 500–2,000 px |
| `ram` | RAM capacity | 256–4,000 MB |
| `sc_h` | Physical screen height | 5–19 cm |
| `sc_w` | Physical screen width | 0–18 cm |
| `talk_time` | Battery talk time | 2–20 hours |
| `three_g` | 3G support | 0 or 1 |
| `touch_screen` | Touchscreen support | 0 or 1 |
| `wifi` | Wi-Fi support | 0 or 1 |

Except for clock speed and thickness, features must be whole numbers. JSON strings such as `"2048"`, booleans, missing values, unknown features, NaN, and Infinity are rejected by the API.

## ML approach

The training code first normalizes the CSV schema and separates `price_range` from the 20 predictors. Both algorithms use the same **80% training / 20% test** split with `random_state=42`: 1,600 training rows and 400 test rows. Stratification gives the test set 100 examples from each class. The test set is held out from fitting and parameter selection.

- **Random Forest Classifier:** combines the votes of 300 decision trees. Scaling is unnecessary for tree splits.
- **SVM:** uses a Scikit-learn `Pipeline` containing `StandardScaler` and a linear `SVC` with `C=1.0`. The scaler learns its mean and standard deviation only from the training data. The saved pipeline applies exactly the same transformation at prediction time.

Both pipelines begin with median imputation, fitted only on training rows. The supplied dataset has no missing feature values, but keeping imputation inside the pipeline provides a clear training-only policy. API requests still require all features. Model settings are fixed; the test set is not used for hyperparameter tuning.

The Model Comparison page fetches `models/metrics.json` through the API. Accuracy is the fraction of correct test predictions. Precision, recall, and F1 use **macro averaging**, which calculates each class's score and then gives the four classes equal weight. The metrics belong to this particular held-out split; they are not a guarantee of performance on new market data.

Joblib stores the complete fitted estimators/pipelines. Only load model files generated by this project or another trusted source: Joblib files are executable serialized Python objects.

## Project structure and request flow

```text
frontend/          HTML, CSS, and browser JavaScript
backend/           Flask routes, validation, and feature metadata
ml/                Dataset preparation and offline model training
data/Mobile.csv    Original labeled dataset
data/mobile_clean.csv  Numeric dataset exported during training
models/            Generated locally: saved models, metrics, and split indices
tests/test_api.py  Tests using the real saved models
docs/VIVA.md       Short explanations for a project viva
run.py             Application entry point
requirements.txt   Python dependencies
CONTRIBUTING.md    Branch, pull request, and contribution instructions
```

```text
Form → POST /api/predict → Validate all 20 features
     → Build a DataFrame in training column order
     → Saved Random Forest or SVM pipeline.predict()
     → JSON category and prediction details → Result view
```

Training and request handling are separate. A request never fits a model. The target column is never sent as an input feature. The comparison endpoint validates both phones before returning their results.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Readiness and loaded-model count |
| GET | `/api/metadata` | Feature definitions/defaults, models, labels, and dataset information |
| GET | `/api/metrics` | Actual saved evaluation results |
| POST | `/api/predict` | Predict one phone using `model` and a `features` object |
| POST | `/api/compare` | Compare exactly two items in `mobiles`, each with `features` and an optional `name` |

The model identifier is `random_forest` or `svm`. Use `Content-Type: application/json` for POST requests. Optional comparison names must have 1–50 characters after trimming spaces. Errors return JSON containing `error` and `details`; invalid input returns `400` and unavailable model files return `503`.

This example uses only the Python standard library and gets all 20 defaults from the API:

```python
import json
from urllib.request import Request, urlopen

base_url = "http://127.0.0.1:8000"
with urlopen(base_url + "/api/metadata") as response:
    metadata = json.load(response)

features = {feature["name"]: feature["default"] for feature in metadata["features"]}
features["ram"] = 3072
payload = {"model": "svm", "features": features}
request = Request(
    base_url + "/api/predict",
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urlopen(request) as response:
    result = json.load(response)
    print(result["label"], result["model_name"])
```

For comparison, use the same request pattern with `/api/compare` and:

```python
payload = {
    "model": "random_forest",
    "mobiles": [
        {"name": "Phone A", "features": features},
        {"name": "Phone B", "features": {**features, "ram": 1024}},
    ],
}
```

## Testing

Train once, then run:

```bash
python -m unittest discover -s tests -v
```

On Windows without activating the environment, replace `python` with `.\.venv\Scripts\python.exe`.

The integration suite loads the real model artifacts and checks API predictions against direct pipeline predictions for both algorithms. It also checks all required fields, invalid data, reordered JSON fields, two-phone comparisons, error responses, metadata, and missing-model recovery. It recomputes the four metrics and confusion matrices on the saved test indices, verifies the dataset hash and disjoint split, and checks that the saved imputer/scaler statistics came only from the training rows.

For a browser check, open the app at desktop, tablet, and phone sizes. Submit a phone using each algorithm and confirm the Result view shows the selected model and entered values. Open Model Comparison, then compare two phones and test equal predictions as well. Check browser developer tools for console errors and failed network requests. The form and backend both validate input; the backend remains the final authority for API clients.

An optional automated browser suite is included. With Node.js and Google Chrome installed, keep the Python server running and use a second terminal:

```bash
npm install
npm run test:ui
```

This checks both full prediction flows, both comparison models, actual displayed metrics, error recovery, and all five pages at 1440, 768, 390, and 320 pixels. Screenshots and a JSON report are saved in `test-results/`. Node.js is needed only for these browser tests, not to run the app.

## Limitations

- The output is a price **range**, not an exact amount, recommendation, or live valuation.
- Brand, release year, market, condition, currency, discounts, and current prices are absent from the data.
- Dataset-era hardware limits make this an educational classification demo rather than a modern buying assistant.
- A higher predicted price class does not necessarily mean a phone is better for a particular user.
- One held-out split is useful for a mini project; production evaluation would require more recent representative data and broader validation.

See [docs/VIVA.md](docs/VIVA.md) for short explanations of the core ML decisions.

See [docs/TEST_REPORT.md](docs/TEST_REPORT.md) for the completed API, ML, browser, and responsive-layout verification.

## Contributing

Friends can follow [CONTRIBUTING.md](CONTRIBUTING.md) to set up the project, work on their own branch, run checks, and open a pull request. Keep each commit focused on one change and keep generated files out of Git.
