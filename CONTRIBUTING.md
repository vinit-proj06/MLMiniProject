# Contributing

## First-time setup

Follow [README.md](README.md#setup-and-run) to create your own Python environment, install dependencies, and train the models once. Do not copy another person's `.venv` or `node_modules` folder.

If you have write access, clone this repository. Otherwise, fork it on GitHub and clone your own fork. The repository owner can invite friends through **Settings → Collaborators** when direct access is wanted.

## Make a contribution

1. Start from the latest default branch and create your own branch:

   ```bash
   git pull --ff-only
   git switch -c feature/your-change
   ```

2. Make one focused change. Keep Python, frontend, and ML logic in their existing folders.
3. Test before committing:

   ```powershell
   .\.venv\Scripts\python.exe -m unittest discover -s tests -v
   ```

   On macOS/Linux, activate the virtual environment and use `python` instead. For frontend changes, also run the app and follow the browser-test instructions in the README.

4. Review and stage only the files relevant to your change:

   ```bash
   git status
   git diff
   git add path/to/changed-file
   git diff --cached
   git commit -m "Describe the change"
   git push -u origin feature/your-change
   ```

5. Open a pull request to this project's default branch. Describe what changed and how you tested it.

Use your own Git name and an email associated with your GitHub account for your commits. Do not commit on someone else's behalf.

## What belongs in Git

- Source: `frontend/`, `backend/`, `ml/`, `run.py`, `start.bat`.
- Reproducible setup: `requirements.txt`, `package.json`, `package-lock.json`, `.gitignore`.
- Tests and useful documentation, including the README.
- The original `data/Mobile.csv` and its attribution in `data/README.md`.

Do not commit local environments, dependency folders, passwords/tokens, caches, logs, test screenshots, generated Joblib models, metrics, split indices, or `data/mobile_clean.csv`. The `.gitignore` handles these without deleting your local copies. Training regenerates the ML outputs when needed.

Keep the dataset attribution and documented license with the data. Do not replace the source dataset or change feature meanings without updating the training code and documentation together.
