"""Download the requested public dataset from Kaggle's official API."""

from io import BytesIO
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zipfile import BadZipFile, ZipFile

from ml.dataset import DEFAULT_DATASET, load_dataset

DOWNLOAD_URL = (
    "https://www.kaggle.com/api/v1/datasets/download/"
    "navjotkaushal/mobile-price-classification-dataset"
)


def main():
    request = Request(DOWNLOAD_URL, headers={"User-Agent": "MobilePriceMiniProject/1.0"})
    try:
        with urlopen(request, timeout=60) as response:
            archive_bytes = response.read()
        with ZipFile(BytesIO(archive_bytes)) as archive:
            matching_files = [name for name in archive.namelist() if Path(name).name == "Mobile.csv"]
            if len(matching_files) != 1:
                raise ValueError("Expected exactly one Mobile.csv in the Kaggle download.")
            csv_bytes = archive.read(matching_files[0])
        DEFAULT_DATASET.parent.mkdir(parents=True, exist_ok=True)
        # Write only this known filename, never arbitrary ZIP paths.
        DEFAULT_DATASET.write_bytes(csv_bytes)
        frame = load_dataset()
        print(f"Downloaded and validated {len(frame):,} rows: {DEFAULT_DATASET}")
    except (HTTPError, URLError, BadZipFile, ValueError) as error:
        raise SystemExit(
            f"Could not download the dataset: {error}\n"
            "Download it from the Kaggle page and place Mobile.csv in data/."
        ) from error


if __name__ == "__main__":
    main()
