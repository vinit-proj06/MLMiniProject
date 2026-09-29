# Viva notes: Mobile Price Range Prediction

## What does the project do?

It predicts one of four mobile price categories from 20 specifications: Low (0), Medium (1), High (2), and Very High (3). This is supervised **multiclass classification** because the training data contains a known category for each phone. It does not predict an exact price.

## How does the full application work?

The browser collects the specifications and selected algorithm. Flask validates the JSON, puts the features in the same column order used during training, and calls the saved model's `predict` method. Flask returns the predicted class, readable label, model name, and input details. JavaScript displays them in the Result view. The comparison tool runs the same process for two phones.

The code is separated into `frontend/`, `backend/`, and `ml/` so the UI, request handling, and offline training are easy to understand independently.

## Why Random Forest and SVM?

**Random Forest** fits many decision trees on randomized samples and feature subsets, then combines their class votes. This project uses 300 trees. Combining trees reduces the instability of a single tree and can capture nonlinear relationships. Trees do not require feature scaling because their decisions compare individual feature thresholds.

**SVM** learns decision boundaries that separate classes with a large margin. This project uses a linear kernel and `C=1.0`; `SVC` handles the four classes internally. The model is sensitive to feature scales: RAM measured in thousands should not dominate a feature measured between 0 and 1 just because its units are larger. `StandardScaler` makes feature scales comparable before SVM fitting.

The comparison page shows which model performs better on this project's held-out data. One algorithm is not universally better for every dataset.

## What is preprocessing here?

The source CSV uses descriptive headers and some values include units or Yes/No text. The data preparation code converts these into consistent numeric feature columns, checks the expected schema, and separates the target. This schema conversion does not learn statistics from examples.

Scaling is different: its mean and standard deviation are learned from data. The SVM pipeline fits those values using the training partition only.

Both pipelines also contain a median imputer fitted on training rows. There are no missing feature values in the supplied dataset, but the imputer establishes a training-only policy for missing values. The API requires complete inputs rather than silently filling an incomplete form.

## Why split the data before fitting?

Training examples teach the models; held-out test examples estimate how well they generalize to unseen phones. Evaluating on training examples would give an overly optimistic result. Both models use the same split, which makes the comparison fairer.

A fixed random seed of 42 makes the split reproducible. The project uses 80% for training (1,600 rows) and 20% for testing (400 rows). A **stratified** split keeps the same share of each class here: the test set has 100 examples per category. The exact row indices are saved in `models/split.json` for independent checks.

## What is data leakage, and how is it prevented?

Leakage occurs when information unavailable at prediction time influences training or evaluation. Examples include using `price_range` as a predictor, scaling with statistics from the test set, or repeatedly choosing settings based on test scores.

The project excludes the target from the inputs, fits preprocessing inside the training pipeline, and evaluates on a separate test partition. The API never trains a model. A saved scaler is reused during inference rather than fitting a new scaler to a submitted phone.

## What do the metrics mean?

| Metric | Meaning |
| --- | --- |
| Accuracy | Correct predictions divided by all test predictions |
| Precision for a class | Of the phones predicted in that class, how many truly belong there? |
| Recall for a class | Of the phones truly in that class, how many did the model find? |
| F1 for a class | Harmonic mean of that class's precision and recall |
| Macro average | Calculate a score for each class, then average the four scores equally |

Macro F1 is the average of the four class-specific F1 values; it is not necessarily the harmonic mean of macro precision and macro recall. The metrics come from model predictions on the actual test labels and are saved in `models/metrics.json`, then fetched by the frontend.

## Why save models with Joblib?

Training on every request would waste time and make responses inconsistent. The training script fits once and saves the estimators, including the SVM preprocessing pipeline. Flask loads the artifacts at startup and reuses them. Retrain explicitly when changing the dataset or model settings, then restart Flask.

## Why validate all 20 fields in the backend?

A user can call the API without using the form. Missing fields, strings, non-finite numbers, incorrect binary values, and out-of-range measurements must therefore be rejected on the server too. Explicit column ordering prevents JSON key order from changing a feature's meaning.

## Why allow zero screen width or pixel height?

The source dataset contains these unusual values. This demo preserves them transparently rather than inventing replacements. A production project would investigate their meaning, document a cleaning policy, and evaluate its effect using training data without consulting the held-out test results.

## What can this project not claim?

It cannot estimate today's retail prices or currency amounts. The data does not include current market conditions, brand, launch date, condition, or discounts. Its hardware ranges reflect an older dataset. The comparison tool compares specifications and predicted categories; it does not prove that the more expensive category is the better purchase.

## What would you improve next?

Collect a larger, current, representative dataset; investigate questionable measurements; use cross-validation on the training partition for model selection; keep a final untouched test set; and report performance on new data over time. These are extensions, not claims about the current mini project.
