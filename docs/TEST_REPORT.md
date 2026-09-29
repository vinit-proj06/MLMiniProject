# Verification report

Verified on September 29, 2026 using Python 3.12.14 and Google Chrome through Playwright 1.62.1.

## Real dataset and evaluation

The requested Kaggle CSV has 2,000 rows, 20 input features, and 500 examples per class. A seeded, stratified split assigns 1,600 rows to training and 400 to testing. Both algorithms use the same split.

The saved pipelines produced these measured test results:

| Model | Accuracy | Macro precision | Macro recall | Macro F1 |
| --- | ---: | ---: | ---: | ---: |
| Random Forest | 88.00% | 88.05% | 88.00% | 88.02% |
| SVM | 96.25% | 96.27% | 96.25% | 96.25% |

These numbers summarize this verification run. The application reads its values from the generated `models/metrics.json`; the UI does not contain hardcoded evaluation scores.

## Python tests: 21 passed

Command: `python -m unittest discover -s tests -v`

- Real API predictions match direct saved-pipeline predictions for both algorithms.
- Every one of the 20 fields is required; missing, invalid, nonfinite, extremely large, and out-of-range values return readable errors.
- Invalid model identifiers, malformed JSON, and invalid comparison names are rejected.
- Both models compare two phones correctly, including ties.
- Missing model artifacts produce a clear recovery message.
- The original dataset checksum matches the saved evaluation metadata.
- Train/test indices are disjoint, complete, and stratified.
- Independently recalculated accuracy, precision, recall, F1, and confusion matrices match the saved metrics.
- Saved imputer medians and SVM scaler statistics match the training rows only.

## Browser checks: 14 passed

Command: `npm run test:ui`, with the Python server running.

- Empty result sessions show a useful next step.
- Both models complete Input → API → Saved model → Result, with correct submitted values and results surviving a refresh.
- All eight metric values displayed by the UI match the API.
- Both comparison models return the entered phones and their categories; editing a phone clears the previous comparison.
- A delayed response from an abandoned form cannot overwrite a newer prediction.
- All five pages fit 1440, 768, 390, and 320 pixel viewports without horizontal overflow.
- Mobile navigation opens, navigates, and closes correctly.
- Browser validation blocks out-of-range entries.
- No unexpected browser console or runtime errors occur during normal flows.
- A deliberately simulated HTTP 503 displays the API error and allows a successful retry.

The four viewport checks count separately in the automated report. Screenshots and the machine-readable browser report are saved in `test-results/` when the suite runs. Desktop home, model comparison, and result screens, tablet/phone prediction forms, and phone comparison results were visually inspected. The final layout has no observed clipped or overlapping controls.

## Reproducing the checks

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe run.py
```

Then, in another terminal:

```powershell
npm install
npm run test:ui
```

Model artifacts are excluded from Git. After cloning, run `python -m ml.train` once before these checks. Running the app or browser tests does not retrain them. To intentionally regenerate artifacts, run the training command again and restart the server before testing.

This is an educational evaluation of relative dataset price classes. It does not measure accuracy on current retail phone prices or on a separate external dataset.
