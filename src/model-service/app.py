import sys
import pickle
import traceback
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
import uvicorn
import pandas as pd

try:
    import sklearn
    sklearn_version = sklearn.__version__
except ImportError:
    sklearn_version = "Not installed"

try:
    import xgboost
    xgboost_version = xgboost.__version__
except ImportError:
    xgboost_version = "Not installed"

app = FastAPI(title="Model 1 Inference Service")

MODEL_PATH = "model/model1_failure_risk_weather.pkl"

model_data = None
load_error = None
load_error_traceback = None

try:
    with open(MODEL_PATH, "rb") as f:
        model_data = pickle.load(f)
except Exception as e:
    load_error = str(e)
    load_error_traceback = traceback.format_exc()

class PredictionInput(BaseModel):
    Air_temperature: float
    Process_temperature: float
    Rotational_speed: float
    Torque: float
    Tool_wear: float
    Temp_diff: float
    Torque_x_Speed: float
    Power_est: float
    Type_H: float
    Type_L: float
    Type_M: float
    Ambient_temp_C: float
    Wind_speed_kmh: float
    Rainfall_mm: float
    Storm_flag: float
    Weather_stress_index: float

@app.get("/")
def read_root():
    return {"message": "Model Inference Service is running", "versions": {"python": sys.version, "sklearn": sklearn_version, "xgboost": xgboost_version}}

@app.post("/predict")
def predict(data: PredictionInput):
    if load_error:
        raise HTTPException(status_code=500, detail={
            "error": "Model failed to load due to incompatibility",
            "message": load_error,
            "traceback": load_error_traceback,
            "python_version": sys.version,
            "sklearn_version": sklearn_version,
            "xgboost_version": xgboost_version
        })
    
    # Check if loaded properly as dictionary
    if not isinstance(model_data, dict):
        raise HTTPException(status_code=500, detail="Loaded artifact is not a dictionary")
    
    expected_cols = model_data.get("feature_cols", [])
    if not expected_cols:
        expected_cols = list(data.dict().keys())
        
    low_thresh = model_data.get("low_thresh", 0.3)
    high_thresh = model_data.get("high_thresh", 0.7)
    clf = model_data.get("model")
    
    input_data = data.dict()
    try:
        # Create a df with EXACTLY the expected feature order
        df = pd.DataFrame([input_data])[expected_cols]
        prob = float(clf.predict_proba(df)[0][1])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

    if prob >= high_thresh:
        risk_level = "HIGH"
    elif prob >= low_thresh:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    return {
        "riskProbability": prob,
        "riskLevel": risk_level,
        "model": "model1_failure_risk_weather",
        "simulatedInputs": True,
        "modelVersion": "1.0",
        "thresholds": {
            "low": low_thresh,
            "high": high_thresh
        }
    }
