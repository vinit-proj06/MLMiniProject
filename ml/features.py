"""One consistent column order for training and prediction."""

FEATURE_NAMES = [
    "battery_power", "blue", "clock_speed", "dual_sim", "fc", "four_g",
    "int_memory", "m_dep", "mobile_wt", "n_cores", "pc", "px_height",
    "px_width", "ram", "sc_h", "sc_w", "talk_time", "three_g",
    "touch_screen", "wifi",
]

CLASS_NAMES = ["Low", "Medium", "High", "Very High"]

# The requested Kaggle file contains descriptive headers, including some typos.
SOURCE_COLUMNS = {
    "Battery_power_mAh": "battery_power",
    "Bluetooh": "blue",
    "Speed_of_microprocessor": "clock_speed",
    "Dual_sim": "dual_sim",
    "Front_camera": "fc",
    "4G": "four_g",
    "Internal_memeory_gb": "int_memory",
    "Mobile_depth": "m_dep",
    "Mobile_weight": "mobile_wt",
    "Cores_of_processor": "n_cores",
    "Primary_camera": "pc",
    "px_height": "px_height",
    "Pixel_width": "px_width",
    "Ram_mb": "ram",
    "Screen_height": "sc_h",
    "Screen_weight": "sc_w",
    "talk_time": "talk_time",
    "3G": "three_g",
    "touch_screen": "touch_screen",
    "wifi": "wifi",
}

BINARY_FEATURES = ["blue", "dual_sim", "four_g", "three_g", "touch_screen", "wifi"]

TARGET_LABELS = {
    "Low cost": 0,
    "Medium cost": 1,
    "High cost": 2,
    "Very High cost": 3,
}
