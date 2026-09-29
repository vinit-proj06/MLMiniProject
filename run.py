"""Start the app after running python -m ml.train once."""

import argparse

from backend.app import create_app


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Mobile price range prediction web app")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    app = create_app()
    app.run(host="127.0.0.1", port=args.port, debug=False)
