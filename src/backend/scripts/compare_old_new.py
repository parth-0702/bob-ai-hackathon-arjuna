"""
Compare model output: static demo vectors (old) vs live weather bridge (new).
Shows exactly what changed and why.
"""
import sys
sys.path.insert(0, ".")
from app.failure_model import FailureRiskModel, DEMO_HEALTHY, DEMO_STRESSED, weather_to_features
from app.weather import WeatherService

model = FailureRiskModel(positive_class_confirmed=False)

# --- 1. Fetch current live weather ---
print("Fetching live weather for Kandla...")
svc = WeatherService()
weather = svc.get()
c = weather.get("current", {})
print(f"  Condition : {c.get('condition')}")
print(f"  Wind      : {c.get('windKmh')} km/h")
print(f"  Rain      : {c.get('rainfall')} mm/h")
print(f"  Temp      : {c.get('temperature')} degC")
print(f"  WMO code  : {c.get('weatherCode')}")
print(f"  Weather   : {weather.get('status')}")
print()

# --- 2. Assets in the seeded port ---
from app.simulation import seed_port
records, clock = seed_port()
assets = records["Assets"] + records["Cranes"]

print(f"{'Asset':8} {'Health':>7}  {'OLD src':30} {'OLD prob':>9}  {'NEW src':30} {'NEW prob':>9}  {'Delta':>8}  {'Change'}")
print("-" * 120)

for asset in assets:
    aid = asset["id"]
    health = asset["health"]

    # OLD: static demo vector based on health threshold
    old_features = DEMO_STRESSED if health < 75 else DEMO_HEALTHY
    old_src = "DEMO_STRESSED" if health < 75 else "DEMO_HEALTHY"
    old_result = model.predict(old_features)
    old_prob = old_result["class_1_probability"]
    old_band = old_result["threshold_band"]

    # NEW: live weather bridge
    new_features = weather_to_features(weather, asset)
    if new_features is not None:
        new_result = model.predict(new_features)
        new_prob = new_result["class_1_probability"]
        new_band = new_result["threshold_band"]
        new_src = "live_weather+health"
        delta = new_prob - old_prob
        direction = "HIGHER" if delta > 0.005 else ("LOWER" if delta < -0.005 else "~same")
    else:
        new_prob = None
        new_band = "N/A"
        new_src = "unavailable"
        delta = 0
        direction = "no change"

    print(f"{aid:8} {health:7.1f}  {old_src:30} {old_prob:9.4f}  {new_src:30} {new_prob if new_prob else 'N/A':>9}  {delta:+8.4f}  {direction}")

print()
print("Weather features injected into model (NEW only):")
if new_features:
    for k in ("Ambient_temp_C", "Wind_speed_kmh", "Rainfall_mm", "Storm_flag", "Weather_stress_index"):
        print(f"  {k:25s} = {new_features[k]}")

print()
print("Key difference:")
print("  OLD: weather features were FIXED at demo anchor values (wind=14/45, rain=0/8, storm=0/1)")
print("  NEW: weather features come from LIVE Open-Meteo reading for Kandla right now")
print(f"  The model now sees the actual current conditions at {clock}")
