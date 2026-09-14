from pathlib import Path
import os
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
load_dotenv(ROOT.parent / '.env')
MODEL_SHA256 = '8926d985a056f01f57d3f981e3b67bfed7d16d172c0859f43d6d123b90acb28c'
MODEL_PATH = Path(os.getenv('FAILURE_MODEL_PATH', str(ROOT / 'models/model1_failure_risk_weather.pkl')))
DB_PATH = Path(os.getenv('PORT_DATABASE_PATH', str(ROOT / 'data/portsentinel.sqlite3')))
WEATHER_URL = 'https://api.open-meteo.com/v1/forecast'
PORT_LATITUDE = 23.03
PORT_LONGITUDE = 70.22
OPERATOR_TOKEN = os.getenv('OPERATOR_TOKEN', '')
