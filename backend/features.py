"""Feature descriptions shared with the form through /api/metadata.

The model expects these normalized column names, in this order.
Ranges cover the dataset's measurements; they are not current phone prices.
"""


def feature(name, label, group, unit, kind, minimum, maximum, step, default, description):
    return {
        "name": name, "label": label, "group": group, "unit": unit,
        "type": kind, "min": minimum, "max": maximum, "step": step,
        "default": default, "description": description,
    }


FEATURES = [
    feature("battery_power", "Battery capacity", "Battery & design", "mAh", "integer", 500, 2000, 1, 1500, "Total energy the battery can store."),
    feature("blue", "Bluetooth", "Connectivity", "", "binary", 0, 1, 1, 1, "Does the phone support Bluetooth?"),
    feature("clock_speed", "Processor speed", "Performance", "GHz", "number", 0.5, 3.0, 0.1, 2.0, "Processor clock speed in gigahertz."),
    feature("dual_sim", "Dual SIM", "Connectivity", "", "binary", 0, 1, 1, 1, "Can the phone use two SIM cards?"),
    feature("fc", "Front camera", "Camera", "MP", "integer", 0, 20, 1, 5, "Front camera resolution; 0 means no camera."),
    feature("four_g", "4G", "Connectivity", "", "binary", 0, 1, 1, 1, "Does the phone support 4G?"),
    feature("int_memory", "Internal storage", "Performance", "GB", "integer", 2, 64, 1, 32, "Built-in storage capacity in gigabytes."),
    feature("m_dep", "Phone thickness", "Battery & design", "cm", "number", 0.1, 1.0, 0.1, 0.5, "Phone depth in centimeters."),
    feature("mobile_wt", "Phone weight", "Battery & design", "g", "integer", 80, 200, 1, 140, "Phone weight in grams."),
    feature("n_cores", "Processor cores", "Performance", "", "integer", 1, 8, 1, 4, "Number of processor cores."),
    feature("pc", "Rear camera", "Camera", "MP", "integer", 0, 20, 1, 12, "Primary camera resolution in megapixels."),
    feature("px_height", "Pixel height", "Display", "px", "integer", 0, 2000, 1, 960, "Vertical resolution. The source dataset includes 0."),
    feature("px_width", "Pixel width", "Display", "px", "integer", 500, 2000, 1, 1280, "Horizontal resolution in pixels."),
    feature("ram", "RAM", "Performance", "MB", "integer", 256, 4000, 1, 2048, "Memory in megabytes, not gigabytes."),
    feature("sc_h", "Screen height", "Display", "cm", "integer", 5, 19, 1, 12, "Physical screen height in centimeters."),
    feature("sc_w", "Screen width", "Display", "cm", "integer", 0, 18, 1, 6, "Physical screen width. The source dataset includes 0."),
    feature("talk_time", "Talk time", "Battery & design", "hours", "integer", 2, 20, 1, 12, "Estimated time a full battery lasts during calls."),
    feature("three_g", "3G", "Connectivity", "", "binary", 0, 1, 1, 1, "Does the phone support 3G?"),
    feature("touch_screen", "Touchscreen", "Connectivity", "", "binary", 0, 1, 1, 1, "Does the phone have a touchscreen?"),
    feature("wifi", "Wi-Fi", "Connectivity", "", "binary", 0, 1, 1, 1, "Does the phone support Wi-Fi?"),
]

FEATURE_NAMES = [item["name"] for item in FEATURES]
MODEL_INFO = [
    {"id": "random_forest", "name": "Random Forest", "description": "Combines decision trees to learn patterns in mobile specifications."},
    {"id": "svm", "name": "SVM", "description": "Uses scaled specifications to learn boundaries between price classes."},
]
PRICE_RANGES = [
    {"value": 0, "label": "Low", "description": "Entry-level price range in this dataset."},
    {"value": 1, "label": "Medium", "description": "Mid-range price category in this dataset."},
    {"value": 2, "label": "High", "description": "Higher price category in this dataset."},
    {"value": 3, "label": "Very High", "description": "Top price category in this dataset."},
]
