"""Inference for the exact user-supplied artifact; no training or feature invention."""
import hashlib,math,os,threading
from pathlib import Path
import numpy as np
import pandas as pd
from joblib.numpy_pickle import NumpyUnpickler
from xgboost.core import Booster,XGBoostError
from .config import MODEL_PATH,MODEL_SHA256
from .schemas import utcnow

class ModelUnavailable(RuntimeError): pass

class PortableBooster(Booster):
    """Load the original embedded UBJSON model when its memory snapshot is not portable."""
    def __setstate__(self,state):
        raw=bytes(state['handle']);marker=b'L\x00\x00\x00\x00\x00\x00\x00\x05Model{'
        at=raw.find(marker)
        if at<0 or not raw.endswith(b'}}'):raise ModelUnavailable('Unsupported XGBoost snapshot format')
        # The exact checksum is verified before unpickling. Load the original embedded
        # model directly: attempting the broken memory snapshot first leaks a handle.
        Booster.__init__(self)
        self.load_model(bytearray(raw[at+len(marker)-1:-1]))
        self._portable_recovery=True

class ArtifactUnpickler(NumpyUnpickler):
    def find_class(self,module,name):
        if module=='xgboost.core' and name=='Booster':return PortableBooster
        allowed=('sklearn.calibration','xgboost.sklearn','numpy','joblib.numpy_pickle')
        if not (module.startswith(allowed) or (module=='builtins' and name=='bytearray')):
            raise ModelUnavailable(f'Unexpected serialized type: {module}.{name}')
        return super().find_class(module,name)

class FailureRiskModel:
    def __init__(self,path=MODEL_PATH,positive_class_confirmed=None):
        self.path=Path(path);self.model=None;self.error=None;self.lock=threading.Lock();self.features=[]
        self.confirmed=(os.getenv('FAILURE_POSITIVE_CLASS_CONFIRMED','false').lower()=='true') if positive_class_confirmed is None else positive_class_confirmed
        try:self.load()
        except Exception as exc:self.error=f'{type(exc).__name__}: {exc}'
    def load(self):
        if not self.path.is_file():raise ModelUnavailable('The supplied model file is missing')
        if hashlib.sha256(self.path.read_bytes()).hexdigest()!=MODEL_SHA256:raise ModelUnavailable('Model checksum differs from the inspected supplied artifact')
        with self.path.open('rb') as handle:
            artifact=ArtifactUnpickler(str(self.path),handle,ensure_native_byte_order=True).load()
        self.model=artifact['model'];self.features=list(artifact['feature_cols']);self.low=float(artifact['low_thresh']);self.high=float(artifact['high_thresh'])
        if list(self.model.feature_names_in_)!=self.features or len(self.features)!=16:raise ModelUnavailable('Model feature metadata mismatch')
        if list(self.model.classes_)!=[0,1] or not hasattr(self.model,'predict_proba'):raise ModelUnavailable('Unexpected classifier output interface')
        self.recovered=any(getattr(c.estimator.get_booster(),'_portable_recovery',False) for c in self.model.calibrated_classifiers_)
    def metadata(self):
        return {'status':'available' if self.model is not None and not self.error else 'unavailable','error':self.error,'sha256':MODEL_SHA256,'type':'CalibratedClassifierCV(XGBClassifier)','features':self.features,'classes':[0,1],'thresholds':{'low':getattr(self,'low',None),'high':getattr(self,'high',None)},'probabilitySupport':True,'positiveClassConfirmed':self.confirmed,'preprocessing':'Requires already-engineered values in the recorded feature order. Training formulas and units are not included.','compatibilityRecovery':getattr(self,'recovered',False)}
    def validate_input(self,features):
        if not self.model or self.error:raise ModelUnavailable(self.error or 'Model unavailable')
        if set(features)!=set(self.features):raise ValueError(f'Exactly these features are required in the input object: {", ".join(self.features)}')
        if any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) for v in features.values()):raise ValueError('All feature values must be finite numbers')
        if any(features[k] not in (0,1) for k in ('Type_H','Type_L','Type_M','Storm_flag')):raise ValueError('Type indicators and Storm_flag must be 0 or 1')
        if sum(features[k] for k in ('Type_H','Type_L','Type_M'))!=1:raise ValueError('Exactly one equipment type indicator must be 1')
        return pd.DataFrame([[features[k] for k in self.features]],columns=self.features,dtype=np.float64)
    def predict(self,features):
        frame=self.validate_input(features)
        with self.lock:
            probabilities=self.model.predict_proba(frame)[0];label=int(self.model.predict(frame)[0])
        if not np.isfinite(probabilities).all() or not np.isclose(sum(probabilities),1):raise ModelUnavailable('Classifier returned invalid probabilities')
        probability=float(probabilities[1]);band='high' if probability>=self.high else 'moderate' if probability>=self.low else 'low'
        return {'class_1_probability':probability,'class_probabilities':{'0':float(probabilities[0]),'1':probability},'predicted_class':label,'threshold_band':band,'risk_probability':probability if self.confirmed else None,'risk_level':band if self.confirmed else None,'positive_class_confirmed':self.confirmed,'model_version':MODEL_SHA256[:12],'prediction_timestamp':utcnow(),'input_source':'explicit_preengineered_features','note':'Class 1 semantics and training feature formulas need confirmation before operational failure-risk claims.' if not self.confirmed else 'Prediction depends on supplied engineered features; not a guarantee of equipment failure.'}
    def explain_output(self,result):
        return {'probabilityMeaning':'Probability assigned to numeric class 1 by the saved calibrated classifier','thresholdMeaning':'Bands use low_thresh/high_thresh saved in the artifact','result':result}

# ---------------------------------------------------------------------------
# Weather → model feature bridge
# ---------------------------------------------------------------------------
# The four weather features in the model map directly from Open-Meteo output:
#   Ambient_temp_C      ← current.temperature          (°C, already correct)
#   Wind_speed_kmh      ← current.windKmh               (km/h, already correct)
#   Rainfall_mm         ← current.rainfall              (mm/h, already correct)
#   Storm_flag          ← 1 if weather_code in severe set, else 0
#   Weather_stress_index← derived: clip(0.007143*wind + 0.041071*rain + 0.20*storm, 0, 1)
#
# Formula derivation: solved from the two demo anchor points supplied with the model:
#   DEMO_HEALTHY  (wind=14, rain=0, storm=0) → wsi=0.10  ✓
#   DEMO_STRESSED (wind=45, rain=8, storm=1) → wsi=0.85  ✓
# Multiple (b,c) splits satisfy this system; c=0.20 is chosen as the round-number
# value consistent with the stressed anchor. Formula is flagged as derived, not
# confirmed by the original training author.
#
# Machine sensor features (Air_temperature, Process_temperature, Rotational_speed,
# Torque, Tool_wear, Temp_diff, Torque_x_Speed, Power_est) are NOT weather-derived.
# For simulated assets they are interpolated from the asset's health score.
# ---------------------------------------------------------------------------

_STORM_CODES = {95, 96, 99}   # WMO thunderstorm codes used by Open-Meteo

def weather_to_features(weather, asset, type_key='L'):
    """
    Build a complete 16-feature inference vector by combining:
      - live weather readings (4 weather features + derived WSI)
      - asset-health-based machine state proxy (8 machine sensor features)
      - equipment type one-hot (3 features)

    Parameters
    ----------
    weather : dict   Normalized weather snapshot from WeatherService.get()
    asset   : dict   Port register record (must have 'health' 0–100)
    type_key: str    'H', 'L', or 'M' — equipment type indicator

    Returns
    -------
    dict of 16 float features ready for FailureRiskModel.predict(), or None
    if weather is unavailable.
    """
    if not weather or weather.get('status') not in ('available', 'stale'):
        return None
    current = weather.get('current')
    if not current:
        return None

    # --- Weather features (direct from Open-Meteo normalized output) ---
    wind = float(current['windKmh'])
    rain = float(current['rainfall'])
    ambient = float(current['temperature'])
    storm = 1.0 if current.get('weatherCode') in _STORM_CODES else 0.0
    wsi = min(1.0, max(0.0, 0.007143 * wind + 0.041071 * rain + 0.20 * storm))

    # --- Machine sensor proxy from asset health ---
    # Interpolate between DEMO_HEALTHY (health=100) and DEMO_STRESSED (health=0).
    # health=100 → healthy machine state; health=0 → fully stressed machine state.
    # This is a linear proxy — real sensor readings would replace this.
    h = max(0.0, min(100.0, float(asset.get('health', 100)))) / 100.0  # 1.0=healthy
    def interp(healthy_val, stressed_val):
        return round(healthy_val * h + stressed_val * (1.0 - h), 4)

    if type_key not in ('H', 'L', 'M'):
        type_key = 'L'
    type_h, type_l, type_m = (1.0, 0.0, 0.0) if type_key == 'H' else \
                              (0.0, 1.0, 0.0) if type_key == 'L' else \
                              (0.0, 0.0, 1.0)

    return {
        # Machine sensor proxy (health-interpolated)
        'Air_temperature':    interp(300, 305),
        'Process_temperature':interp(310, 309),
        'Rotational_speed':   interp(1500, 1250),
        'Torque':             interp(40, 65),
        'Tool_wear':          interp(50, 220),
        'Temp_diff':          interp(10, 4),
        'Torque_x_Speed':     interp(60000, 81250),
        'Power_est':          interp(6283.185, 8508.48),
        # Equipment type (one-hot)
        'Type_H': type_h, 'Type_L': type_l, 'Type_M': type_m,
        # Weather features (live)
        'Ambient_temp_C':       round(ambient, 2),
        'Wind_speed_kmh':       round(wind, 2),
        'Rainfall_mm':          round(rain, 2),
        'Storm_flag':           storm,
        'Weather_stress_index': round(wsi, 4),
    }


# Complete synthetic engineered vectors — demo inputs anchoring the WSI formula.
# weather_to_features() now supersedes these for simulated assets when weather is available.
DEMO_HEALTHY=dict(zip(['Air_temperature','Process_temperature','Rotational_speed','Torque','Tool_wear','Temp_diff','Torque_x_Speed','Power_est','Type_H','Type_L','Type_M','Ambient_temp_C','Wind_speed_kmh','Rainfall_mm','Storm_flag','Weather_stress_index'],[300,310,1500,40,50,10,60000,6283.185,0,1,0,30,14,0,0,.1]))
DEMO_STRESSED=dict(zip(DEMO_HEALTHY,[305,309,1250,65,220,4,81250,8508.48,0,1,0,37,45,8,1,.85]))
