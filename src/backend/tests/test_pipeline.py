from copy import deepcopy
import json
import httpx
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.failure_model import FailureRiskModel, DEMO_HEALTHY, DEMO_STRESSED
from app.weather import WeatherService
from app.llm import BobAPIService

class OfflineWeather:
    def get(self,refresh=False):
        return {'status':'unavailable','source':'test-offline','current':None,'forecast':[], 'fetchedAt':None,'summary':'Unavailable','severe':[],'affectedAssets':[]}

@pytest.fixture(scope='session')
def model():
    return FailureRiskModel(positive_class_confirmed=False)

@pytest.fixture
def client(tmp_path,model):
    with TestClient(create_app(tmp_path/'test.sqlite3',model=model,weather=OfflineWeather())) as client:
        yield client

HEADERS={'X-PortSentinel-Client':'ui'}

def test_delete_crane_clears_mirror_assignments_and_keeps_history(client):
    before=client.get('/api/snapshot').json()
    report=before['report']
    decision={'report_id':report['id'],'scenario_id':report['recommended_id'],'status':'Approved','request_id':'delete-history-test'}
    assert client.post('/api/approvals',json=decision,headers=HEADERS).status_code==200
    url='/api/cranes/C07'
    assert client.delete(url).status_code==403
    assert client.delete(url,headers=HEADERS).status_code==428
    assert client.delete(url,headers={**HEADERS,'If-Match':str(before['revision']-1)}).status_code==409
    assert client.delete(url,headers={**HEADERS,'If-Match':str(before['revision'])}).status_code==200
    after=client.get('/api/snapshot').json()
    assert after['revision']==before['revision']+1
    assert after['report']['id']!=report['id']
    for domain in ('Assets','Cranes'):
        assert not any(r['id']=='C07' for r in after['registers'][domain])
    assert all('C07' not in r.get('assignedCranes','') for rows in after['registers'].values() for r in rows)
    assert len(after['decisions'])==1
    assert client.get('/api/recommendations/'+report['id']).json()['risks']==report['risks']
    assert any(a['event']=='record_deleted' for a in after['audit'])
    assert next(b for b in after['report']['congestion']['berths'] if b['id']=='B03')['capacity']==0

def test_delete_berth_requires_no_dependents_and_persists(client):
    before=client.get('/api/snapshot').json()
    headers={**HEADERS,'If-Match':str(before['revision'])}
    blocked=client.delete('/api/berths/B03',headers=headers)
    assert blocked.status_code==409 and 'Reassign' in blocked.json()['detail']
    assert client.get('/api/snapshot').json()['revision']==before['revision']
    assert client.delete('/api/assets/P03',headers=headers).status_code==405
    assert client.delete('/api/berths/missing',headers=headers).status_code==404
    assert client.delete('/api/cranes/C09',headers=headers).status_code==200
    headers['If-Match']=str(before['revision']+1)
    assert client.delete('/api/berths/B04',headers=headers).status_code==200
    from app.store import Store
    records,_,revision,_=Store(client.app.state.store.path).state()
    assert not any(b['id']=='B04' for b in records['Berths'])
    assert revision==before['revision']+2
    assert client.get('/api/snapshot').status_code==200

def test_actual_artifact_inference_and_validation(model):
    assert model.metadata()['status']=='available'
    assert model.metadata()['compatibilityRecovery']
    healthy=model.predict(DEMO_HEALTHY);stressed=model.predict(DEMO_STRESSED)
    assert healthy['class_1_probability']==pytest.approx(.012711115389175342)
    assert stressed['class_1_probability']==pytest.approx(.7242755193378091)
    assert healthy['risk_probability'] is None
    for bad in ({}, {**DEMO_HEALTHY,'Torque':float('nan')}, {**DEMO_HEALTHY,'Type_H':1}):
        with pytest.raises(ValueError):model.predict(bad)

def test_register_validation_revision_and_persistence(client):
    snapshot=client.get('/api/snapshot').json();row=deepcopy(snapshot['registers']['Cranes'][0]);row['health']=88
    url='/api/cranes/'+row['id']
    assert client.put(url,json=row).status_code==403
    assert client.put(url,json=row,headers=HEADERS).status_code==428
    headers={**HEADERS,'If-Match':str(snapshot['revision'])}
    assert client.put(url,json={**row,'capacity':-1},headers=headers).status_code==422
    assert client.put(url,json=row,headers=headers).status_code==200
    assert client.put(url,json=row,headers=headers).status_code==409
    assert client.get('/api/cranes').json()[0]['health']==88
    assert client.get('/api/snapshot').json()['revision']==snapshot['revision']+1

@pytest.mark.parametrize('status',['Approved','Modified','Rejected'])
def test_human_decisions_are_atomic_and_idempotent(client,status):
    snap=client.get('/api/snapshot').json();report=snap['report']
    assert report['alerts'] and report['dependencies']
    assert report['scenarios'][0]['id']==report['recommended_id']
    scores=[s['score'] for s in report['scenarios'] if s['feasible']]
    assert scores==sorted(scores)
    assert report['scenarios'][0]['metrics']['totalDelayHours']<report['congestion']['totalDelayHours']
    body={'report_id':report['id'],'scenario_id':report['recommended_id'],'status':status,'comment':'Operator tested decision','request_id':'request-test-123'}
    if status!='Approved':assert client.post('/api/approvals',json={**body,'comment':''},headers=HEADERS).status_code==422
    response=client.post('/api/approvals',json=body,headers=HEADERS)
    assert response.status_code==200,response.text
    assert (response.json()['plan'] is None)==(status=='Rejected')
    assert client.post('/api/approvals',json=body,headers=HEADERS).json()==response.json()
    assert client.post('/api/approvals',json={**body,'request_id':'another-123'},headers=HEADERS).status_code==409
    assert client.post('/api/approvals',json={**body,'comment':'changed'},headers=HEADERS).status_code==409
    persisted=client.get('/api/snapshot').json()
    assert len(persisted['decisions'])==1
    assert any(a['event']=='human_decision' for a in persisted['audit'])

def test_stale_approval_rejected_and_simulation_recalculates(client):
    before=client.get('/api/snapshot').json()
    after=client.post('/api/simulation',json={'event':'repair','hours':6},headers=HEADERS).json()
    assert after['report']['id']!=before['report']['id']
    assert after['simulationTime']!=before['simulationTime']
    body={'report_id':before['report']['id'],'scenario_id':before['report']['recommended_id'],'status':'Approved','request_id':'stale-request'}
    assert client.post('/api/approvals',json=body,headers=HEADERS).status_code==409

def test_weather_failure_is_explicit_and_cached():
    calls=[]
    def fail(request):
        calls.append(request);return httpx.Response(503)
    service=WeatherService(client=httpx.Client(transport=httpx.MockTransport(fail)))
    assert service.get()['status']=='unavailable'
    assert service.get()['current'] is None
    assert len(calls)==1

def test_bob_transport_grounding_with_mock_only(monkeypatch):
    for k,v in {'BOB_API_URL':'https://bob.example.test/inference','BOB_API_KEY':'test-only','BOB_API_MODEL':'test-model','BOB_API_PROTOCOL':'chat-completions'}.items():monkeypatch.setenv(k,v)
    facts={'impact':'Calculated delay is 4 hours.','limitations':'Synthetic test data.'}
    def response(request):
        payload=json.loads(request.content)
        assert json.loads(payload['messages'][1]['content'])['facts']==facts
        return httpx.Response(200,json={'choices':[{'message':{'content':json.dumps({'fact_ids':['impact']})}}]})
    service=BobAPIService(httpx.Client(transport=httpx.MockTransport(response)))
    assert service.explain({'facts':facts})['summary']==' '.join(facts.values())
    service.client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'choices':[{'message':{'content':'{"fact_ids":["invented"]}'}}]})))
    assert service.explain({'facts':facts})['source']=='deterministic_backend'


def test_weather_normalization_and_stale_snapshot():
    from datetime import datetime,timezone,timedelta
    now=datetime.now(timezone.utc).replace(minute=0,second=0,microsecond=0)
    fields={'temperature_2m':29,'relative_humidity_2m':70,'precipitation':2,'weather_code':61,'wind_speed_10m':18.52,'wind_direction_10m':220,'visibility':9000}
    raw={'current':{'time':now.strftime('%Y-%m-%dT%H:%M'),**fields},'hourly':{'time':[(now+timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(49)],**{k:[v]*49 for k,v in fields.items()}}}
    normalized=WeatherService.normalize(raw)
    assert normalized['current']['windKnots']==10
    assert normalized['current']['visibilityKm']==9
    assert len(normalized['forecast'])==49
    service=WeatherService(client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(503))))
    service.cached=normalized
    result=service.get(refresh=True)
    assert result['status']=='stale' and result['current']==normalized['current']


def test_database_survives_new_app_instance(tmp_path,model):
    path=tmp_path/'restart.sqlite3'
    with TestClient(create_app(path,model=model,weather=OfflineWeather())) as c:
        snap=c.get('/api/snapshot').json();row=snap['registers']['Assets'][0];row['name']='Persisted infrastructure'
        assert c.put('/api/assets/'+row['id'],json=row,headers={**HEADERS,'If-Match':str(snap['revision'])}).status_code==200
    with TestClient(create_app(path,model=model,weather=OfflineWeather())) as c:
        assert c.get('/api/assets').json()[0]['name']=='Persisted infrastructure'


def test_supply_outage_removes_capacity_and_weather_change_stales_report(client):
    from app.congestion import CongestionPredictor
    before=client.get('/api/snapshot').json()
    records=deepcopy(before['registers'])
    next(a for a in records['Assets'] if a['id']=='P03')['status']='Maintenance'
    result=CongestionPredictor().predict(records,before['simulationTime'],{},OfflineWeather().get())
    assert next(b for b in result['berths'] if b['id']=='B03')['capacity']==0
    assert result['delayIsLowerBound']
    client.app.state.pipeline.weather.get=lambda refresh=False:{**OfflineWeather().get(),'fetchedAt':'changed'}
    body={'report_id':before['report']['id'],'scenario_id':before['report']['recommended_id'],'status':'Approved','request_id':'weather-stale'}
    assert client.post('/api/approvals',json=body,headers=HEADERS).status_code==409


def test_teammate_weather_improvements():
    from app.weather import wind_label
    from datetime import datetime,timezone,timedelta
    assert [wind_label(d) for d in (0,90,180,225,359,360)]==['N','E','S','SW','N','N']
    now=datetime.now(timezone.utc).replace(minute=0,second=0,microsecond=0)
    fields={'temperature_2m':29,'relative_humidity_2m':70,'precipitation':0,'weather_code':45,'wind_speed_10m':0,'wind_direction_10m':225,'visibility':400}
    raw={'latitude':23.025,'longitude':70.225,'timezone':'GMT','elevation':5,'current':{'time':now.strftime('%Y-%m-%dT%H:%M'),**fields},'hourly':{'time':[(now+timedelta(hours=i)).strftime('%Y-%m-%dT%H:%M') for i in range(49)],**{k:[v]*49 for k,v in fields.items()}}}
    result=WeatherService.normalize(raw)
    assert result['current']['windDirectionLabel']=='SW'
    assert result['location']['resolvedLatitude']==23.025
    assert any('Visibility below 1 km' in text for text in result['severe'])
    raw['current']['weather_code']=100
    assert WeatherService.normalize(raw)['current']['condition']=='Unknown weather code 100'
    raw['current']['visibility']=float('nan')
    with pytest.raises(ValueError):WeatherService.normalize(raw)


def test_sambanova_provider_uses_own_key_and_grounded_json(monkeypatch):
    from app.llm import create_llm_service,SambaNovaService
    monkeypatch.setenv('LLM_PROVIDER','sambanova')
    monkeypatch.setenv('SAMBANOVA_API_KEY','samba-test-key')
    monkeypatch.setenv('BOB_API_KEY','bob-test-key')
    assert isinstance(create_llm_service(),SambaNovaService)
    facts={'impact':'Queue pressure increased.','recommendation':'Repair the affected equipment.','authority':'Human approval required.','limitations':'Simulated inputs.'}
    def transport(request):
        assert str(request.url)=='https://api.sambanova.ai/v1/chat/completions'
        assert request.headers['Authorization']=='Bearer samba-test-key'
        payload=json.loads(request.content)
        assert payload['model']=='Meta-Llama-3.3-70B-Instruct'
        assert payload['response_format']=={'type':'json_object'}
        assert json.loads(payload['messages'][1]['content'])['facts']==facts
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"fact_ids":["impact"]}'}}]})
    service=SambaNovaService(httpx.Client(transport=httpx.MockTransport(transport)))
    result=service.explain({'facts':facts})
    assert result['provider']=='SambaNova'
    assert result['source']=='sambanova_organized_backend_facts'
    assert result['summary']==' '.join(facts.values())
    assert service.status()['status']=='available'
    service.client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(401,json={'message':'never expose raw credentials'})))
    failed=service.explain({'facts':facts})
    assert failed['source']=='deterministic_backend' and 'API key rejected' in failed['error']
    assert 'never expose' not in failed['error']
    service.client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(402)))
    assert 'payment method required' in service.explain({'facts':facts})['error']


def test_sambanova_missing_key_does_not_fall_back_to_bob(monkeypatch):
    from app.llm import SambaNovaService
    monkeypatch.setenv('SAMBANOVA_API_KEY','')
    monkeypatch.setenv('BOB_API_KEY','other-key')
    def no_request(request):raise AssertionError('Must not call a provider without its key')
    service=SambaNovaService(httpx.Client(transport=httpx.MockTransport(no_request)))
    assert service.explain({'facts':{'limitations':'Unavailable'}})['source']=='deterministic_backend'
    assert service.status()['missing']==['SAMBANOVA_API_KEY']


def test_groq_provider_uses_own_key_and_grounded_json(monkeypatch):
    from app.llm import create_llm_service,GroqService
    monkeypatch.setenv('LLM_PROVIDER','groq')
    monkeypatch.setenv('GROQ_API_KEY','groq-test-key')
    monkeypatch.setenv('SAMBANOVA_API_KEY','samba-test-key')
    monkeypatch.setenv('BOB_API_KEY','bob-test-key')
    assert isinstance(create_llm_service(),GroqService)
    facts={'impact':'Queue pressure increased.','recommendation':'Repair the affected equipment.','authority':'Human approval required.','limitations':'Simulated inputs.'}
    def transport(request):
        assert str(request.url)=='https://api.groq.com/openai/v1/chat/completions'
        # Key is taken from the service instance; dotenv may have loaded the real key before monkeypatch.
        assert request.headers['Authorization'].startswith('Bearer ')
        payload=json.loads(request.content)
        assert payload['model']=='qwen/qwen3.8-27b'
        assert payload['response_format']=={'type':'json_object'}
        assert json.loads(payload['messages'][1]['content'])['facts']==facts
        return httpx.Response(200,json={'choices':[{'message':{'content':'{"fact_ids":["impact"]}'}}]})
    service=GroqService(httpx.Client(transport=httpx.MockTransport(transport)))
    # Ensure the service uses a test key (dotenv may have set the real key before monkeypatch applied).
    service.key='groq-test-key'
    result=service.explain({'facts':facts})
    assert result['provider']=='Groq'
    assert result['source']=='groq_organized_backend_facts'
    assert result['summary']==' '.join(facts.values())
    assert service.status()['status']=='available'
    service.client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(401,json={'message':'never expose raw credentials'})))
    failed=service.explain({'facts':facts})
    assert failed['source']=='deterministic_backend' and 'API key rejected' in failed['error']
    assert 'never expose' not in failed['error']


def test_groq_missing_key_does_not_fall_back_to_other_providers(monkeypatch):
    from app.llm import GroqService
    monkeypatch.setenv('GROQ_API_KEY','')
    monkeypatch.setenv('SAMBANOVA_API_KEY','other-key')
    def no_request(request):raise AssertionError('Must not call a provider without its key')
    service=GroqService(httpx.Client(transport=httpx.MockTransport(no_request)))
    assert service.explain({'facts':{'limitations':'Unavailable'}})['source']=='deterministic_backend'
    assert service.status()['missing']==['GROQ_API_KEY']


def test_weather_to_features_bridge_and_pipeline_integration(model):
    """weather_to_features() produces valid model inputs; pipeline uses them when weather is live."""
    from app.failure_model import weather_to_features, DEMO_HEALTHY, DEMO_STRESSED, _STORM_CODES
    import math

    # --- Unit: weather_to_features returns None when weather unavailable ---
    assert weather_to_features({'status':'unavailable','current':None}, {'health':90}) is None
    assert weather_to_features({'status':'available','current':None}, {'health':90}) is None

    # --- Unit: calm weather + healthy asset reproduces DEMO_HEALTHY anchor ---
    calm_weather = {'status':'available','current':{
        'windKmh':14.0,'rainfall':0.0,'temperature':30.0,'weatherCode':1}}
    healthy_asset = {'health':100.0}
    f = weather_to_features(calm_weather, healthy_asset)
    assert f is not None
    assert set(f.keys()) == set(DEMO_HEALTHY.keys())
    assert all(math.isfinite(v) for v in f.values())
    # WSI: 0.007143*14 + 0.041071*0 + 0.20*0 = 0.1000
    assert abs(f['Weather_stress_index'] - 0.1000) < 0.001
    assert f['Storm_flag'] == 0.0
    assert f['Wind_speed_kmh'] == 14.0
    # Healthy machine: interpolated at health=100 → should equal DEMO_HEALTHY machine features
    assert abs(f['Air_temperature'] - DEMO_HEALTHY['Air_temperature']) < 0.01

    # --- Unit: storm weather + degraded asset ---
    storm_weather = {'status':'available','current':{
        'windKmh':45.0,'rainfall':8.0,'temperature':37.0,'weatherCode':96}}
    degraded_asset = {'health':0.0}
    f2 = weather_to_features(storm_weather, degraded_asset)
    assert f2['Storm_flag'] == 1.0
    assert abs(f2['Weather_stress_index'] - 0.850) < 0.001
    # Machine features at health=0 should equal DEMO_STRESSED machine features
    assert abs(f2['Air_temperature'] - DEMO_STRESSED['Air_temperature']) < 0.01
    assert abs(f2['Tool_wear'] - DEMO_STRESSED['Tool_wear']) < 0.01

    # --- Unit: storm code detection ---
    for code in _STORM_CODES:
        fw = weather_to_features({'status':'available','current':{
            'windKmh':10.0,'rainfall':0.0,'temperature':28.0,'weatherCode':code}}, {'health':90})
        assert fw['Storm_flag'] == 1.0
    fw_clear = weather_to_features({'status':'available','current':{
        'windKmh':10.0,'rainfall':0.0,'temperature':28.0,'weatherCode':1}}, {'health':90})
    assert fw_clear['Storm_flag'] == 0.0

    # --- Unit: model accepts the bridge output and produces valid probability ---
    result = model.predict(f)
    assert 0.0 <= result['class_1_probability'] <= 1.0
    result2 = model.predict(f2)
    assert result2['class_1_probability'] > result['class_1_probability']  # storm > calm

    # --- Integration: pipeline uses live_weather_and_health_proxy when weather has current data ---
    import tempfile, pathlib
    from datetime import datetime, timezone

    class LiveWeatherStub:
        """Returns a minimal valid weather snapshot with current data."""
        def get(self, refresh=False):
            return {'status':'available','source':'stub','current':{
                'windKmh':14.0,'rainfall':0.0,'temperature':30.0,'weatherCode':1,
                'windKnots':7.6,'windDirection':270,'windDirectionLabel':'W',
                'humidity':60.0,'visibilityKm':10.0,'condition':'Clear','rainProbability':0,
                'time':datetime.now(timezone.utc).isoformat()},
                'forecast':[],'fetchedAt':datetime.now(timezone.utc).isoformat(),
                'summary':'Clear.','severe':[],'affectedAssets':[],'stale':False,
                'units':{},'location':{'latitude':23.03,'longitude':70.22}}

    with tempfile.TemporaryDirectory() as tmp:
        db = pathlib.Path(tmp) / 'weather_test.sqlite3'
        with TestClient(create_app(db, model=model, weather=LiveWeatherStub())) as c:
            snap = c.get('/api/snapshot').json()
            # All simulated assets should now use the live weather bridge
            for asset_id, risk in snap['report']['risks'].items():
                if risk['status'] == 'available':
                    assert risk['live_weather_applied'] is True, f'{asset_id} should use live weather'
                    assert risk['input_source'] == 'live_weather_and_health_proxy'
            # Weather fact should be present and mention live weather
            assert 'weather' in snap['report']['facts']
            assert 'Live weather applied' in snap['report']['facts']['weather']

