"""Server-only live weather. Never relabel a fixture as an external observation."""
from datetime import datetime, timezone
import threading,time,math
import httpx
from .config import WEATHER_URL,PORT_LATITUDE,PORT_LONGITUDE
from .schemas import utcnow

CONDITIONS={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',61:'Light rain',63:'Moderate rain',65:'Heavy rain',80:'Rain showers',81:'Rain showers',82:'Heavy showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Severe thunderstorm'}

# Adapted from the teammate's weather-service review; codes follow Open-Meteo.
CONDITIONS.update({56:'Light freezing drizzle',57:'Dense freezing drizzle',66:'Light freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Moderate snow',75:'Heavy snow',77:'Snow grains',85:'Light snow showers',86:'Heavy snow showers',96:'Thunderstorm with slight hail',99:'Thunderstorm with heavy hail'})

def wind_label(degrees):
    directions=('N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW')
    return directions[math.floor((degrees % 360)/22.5 + .5) % 16]

class WeatherService:
    def __init__(self,store=None,client=None):
        self.store=store;self.client=client;self.cached=None;self.cached_at=0.;self.lock=threading.Lock();self.last_error=None;self.failure=None;self.failed_at=0.
    def get(self,refresh=False):
        with self.lock:
            if self.failure and not refresh and time.monotonic()-self.failed_at<60:return self.failure
            if self.cached and not refresh and time.monotonic()-self.cached_at<600:return self.cached
            params={'latitude':PORT_LATITUDE,'longitude':PORT_LONGITUDE,'current':'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,visibility','hourly':'temperature_2m,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,visibility','wind_speed_unit':'kmh','timezone':'UTC','forecast_days':3}
            try:
                if self.client:response=self.client.get(WEATHER_URL,params=params)
                else:
                    with httpx.Client(timeout=8,follow_redirects=False) as client:response=client.get(WEATHER_URL,params=params)
                response.raise_for_status();data=response.json();normalized=self.normalize(data)
                self.cached=normalized;self.cached_at=time.monotonic();self.last_error=None;self.failure=None
                if self.store:self.store.weather_save(normalized)
                return normalized
            except (httpx.HTTPError,ValueError,KeyError,TypeError,IndexError) as exc:
                self.last_error=type(exc).__name__
                self.failed_at=time.monotonic()
                if self.cached:
                    self.failure={**self.cached,'status':'stale','error':'Live refresh failed; showing the last successful provider snapshot.','stale':True}
                else:self.failure={'status':'unavailable','source':'Open-Meteo','current':None,'forecast':[],'fetchedAt':None,'error':'Weather provider unavailable. No live values substituted.','summary':'Current weather is unavailable. Check port weather procedures before decisions.','affectedAssets':[],'severe':[],'stale':False}
                return self.failure
    @staticmethod
    def normalize(raw):
        current=raw['current'];hourly=raw['hourly'];now=datetime.now(timezone.utc)
        def point(row,timestamp):
            fields=['temperature_2m','relative_humidity_2m','precipitation','weather_code','wind_speed_10m','wind_direction_10m','visibility']
            if any(row.get(f) is None for f in fields):raise ValueError('Missing weather fields')
            if any(not math.isfinite(float(row[f])) for f in fields):raise ValueError('Non-finite weather fields')
            if not 0<=float(row['relative_humidity_2m'])<=100 or any(float(row[f])<0 for f in ('precipitation','wind_speed_10m','visibility')):raise ValueError('Invalid weather range')
            return {'windDirectionLabel':wind_label(float(row['wind_direction_10m'])),'time':timestamp+'Z' if not timestamp.endswith('Z') else timestamp,'temperature':float(row['temperature_2m']),'humidity':float(row['relative_humidity_2m']),'rainfall':float(row['precipitation']),'windKmh':float(row['wind_speed_10m']),'windKnots':round(float(row['wind_speed_10m'])/1.852,1),'windDirection':float(row['wind_direction_10m']),'visibilityKm':round(float(row['visibility'])/1000,1),'condition':CONDITIONS.get(int(row['weather_code']),f"Unknown weather code {int(row['weather_code'])}"),'weatherCode':int(row['weather_code']),'rainProbability':row.get('precipitation_probability')}
        forecast=[]
        for i,t in enumerate(hourly['time']):
            if datetime.fromisoformat(t).replace(tzinfo=timezone.utc)<now.replace(minute=0,second=0,microsecond=0):continue
            row={k:v[i] for k,v in hourly.items() if k!='time'};forecast.append(point(row,t))
        forecast=forecast[:49];present=point(current,current['time'])
        if not forecast:raise ValueError('No future weather forecast')
        peak=max(p['windKnots'] for p in forecast[:25]);rain=max(p['rainfall'] for p in forecast[:25]);severe=[]
        if peak>=25:severe.append('Strong wind exposure: inspect crane operating limits')
        if rain>=5:severe.append('Heavy rainfall exposure: inspect power and drainage resilience')
        if any(p['weatherCode'] in (95,96,99) for p in [present]+forecast[:25]):severe.append('Thunderstorm conditions forecast')
        visibility=min(p['visibilityKm'] for p in [present]+forecast[:25])
        if visibility<1:severe.append('Visibility below 1 km: review vessel approach, pilotage and tug procedures (prototype advisory threshold)')
        summary=f"Current conditions: {present['condition'].lower()}, {present['temperature']:g}°C, wind {present['windKnots']:g} kn. The next 24 hours reach {peak:g} kn wind and {rain:g} mm hourly precipitation. "
        summary+= 'Review exposed lifting and power equipment before the weather window.' if severe else 'No configured severe-weather threshold is crossed; normal port checks still apply.'
        return {'status':'available','source':'Open-Meteo','sourceType':'external_weather_model','current':present,'forecast':forecast,'fetchedAt':utcnow(),'summary':summary,'severe':severe,'affectedAssets':(['C07','P03','R01'] if severe else []),'stale':False,'units':{'temperature':'C','wind':'km/h and knots','rainfall':'mm/hour','visibility':'km'},'location':{'latitude':PORT_LATITUDE,'longitude':PORT_LONGITUDE,'resolvedLatitude':raw.get('latitude'),'resolvedLongitude':raw.get('longitude'),'elevationM':raw.get('elevation'),'timezone':raw.get('timezone','UTC')}}
