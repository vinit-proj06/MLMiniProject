# Dataset and provenance

`Mobile.csv` is the original, unmodified file downloaded from [Navjot Kaushal's Mobile Price Classification Dataset on Kaggle](https://www.kaggle.com/datasets/navjotkaushal/mobile-price-classification-dataset).

- Downloaded: September 29, 2026, using Kaggle's official public dataset download API.
- Kaggle dataset version: 1; last updated August 29, 2025.
- Kaggle metadata lists the license as **CC BY-NC-SA 4.0**. Preserve attribution and the license terms when redistributing the data or adaptations.
- SHA-256 of the original CSV: `0228150f4403ba0e7d20b1d9024ef830bd32942a9b3c39964f64655cbdf2a4f7`.
- 2,000 labeled rows, 20 input features, and 500 rows in each of four price classes.
- This downloaded file contains no missing feature values and no duplicate rows.

To download again from the project root:

```powershell
python -m ml.download_data
```

Training writes `mobile_clean.csv`, a numerical copy created by `ml/dataset.py`. This generated copy is excluded from Git and is available locally for inspection; training always reads the original `Mobile.csv`. It is **not** an additional dataset or an independent evaluation set.

## Cleaning and column mapping

The source has descriptive column names, Yes/No strings, numeric strings with unit suffixes, and text target labels. Cleaning uses a fixed mapping, not statistics learned from the complete dataset. Numerical units are stripped, not converted or rescaled.

| Source column | Canonical feature | Meaning / interface unit |
| --- | --- | --- |
| Battery_power_mAh | battery_power | Battery capacity, mAh |
| Bluetooh | blue | Bluetooth, 0/1 |
| Speed_of_microprocessor | clock_speed | Processor speed, GHz |
| Dual_sim | dual_sim | Dual SIM, 0/1 |
| Front_camera | fc | Front camera resolution, MP convention |
| 4G | four_g | 4G support, 0/1 |
| Internal_memeory_gb | int_memory | Internal storage, GB |
| Mobile_depth | m_dep | Device thickness, cm |
| Mobile_weight | mobile_wt | Device weight, g |
| Cores_of_processor | n_cores | Processor cores |
| Primary_camera | pc | Main camera resolution, MP convention |
| px_height | px_height | Display pixel height, px convention |
| Pixel_width | px_width | Display pixel width, px convention |
| Ram_mb | ram | RAM, MB |
| Screen_height | sc_h | Physical screen height, cm |
| Screen_weight | sc_w | Physical screen width, cm convention |
| talk_time | talk_time | Talk time, hours |
| 3G | three_g | 3G support, 0/1 |
| touch_screen | touch_screen | Touchscreen, 0/1 |
| wifi | wifi | Wi-Fi, 0/1 |

`Low cost`, `Medium cost`, `High cost`, and `Very High cost` map to target values 0, 1, 2, and 3 respectively. `Yes` maps to 1 and `No` to 0.

**Source label limitations:** the raw file suffixes camera values with `pixels`, display resolution with `ppcm`, and names screen width `Screen_weight`. The interface interprets these fields using the conventional meanings of the mobile-price dataset: camera megapixels, display pixel dimensions, and physical screen width. These are documented schema interpretations; the project does not claim to verify the original measurements. No numerical unit conversion is performed. Zero display heights or screen widths present in the source are retained instead of inventing replacement measurements.

These classes are relative labels in an educational dataset. The file provides no rupee/dollar prices or class price boundaries, and it does not establish accuracy for current commercial phones.
