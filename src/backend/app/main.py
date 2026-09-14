from contextlib import asynccontextmanager
import hmac,sqlite3
from fastapi import FastAPI,Depends,HTTPException,Request,Header,Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from . import config
from .schemas import DOMAINS,PortRecord,DecisionRequest,SimulationRequest,InferenceRequest,ExplainRequest
from .store import Store,Conflict
from .simulation import seed_port,advance_port
from .failure_model import FailureRiskModel,ModelUnavailable
from .weather import WeatherService
from .llm import create_llm_service
from .pipeline import Pipeline

def create_app(database_path=None,model=None,weather=None,llm=None):
    @asynccontextmanager
    async def lifespan(app):
        store=Store(database_path or config.DB_PATH);app.state.store=store
        app.state.pipeline=Pipeline(store,model or FailureRiskModel(),weather or WeatherService(store),llm or create_llm_service())
        yield
    app=FastAPI(title='PortSentinel Nexus API',version='0.1.0',lifespan=lifespan)
    app.add_middleware(CORSMiddleware,allow_origins=['http://127.0.0.1:5173','http://localhost:5173'],allow_methods=['GET','POST','PUT'],allow_headers=['Content-Type','X-PortSentinel-Client','X-Operator-Token','If-Match'])
    def pipeline(request:Request):return request.app.state.pipeline
    def operator(request:Request,x_portsentinel_client:str=Header(default=''),x_operator_token:str=Header(default='')):
        if x_portsentinel_client!='ui':raise HTTPException(403,'Explicit operator client header is required for changes')
        if config.OPERATOR_TOKEN and not hmac.compare_digest(x_operator_token,config.OPERATOR_TOKEN):raise HTTPException(401,'Operator token is required')
        return 'configured-operator' if config.OPERATOR_TOKEN else 'local-demo-operator'
    @app.exception_handler(Conflict)
    async def conflict(request,exc):return JSONResponse(status_code=409,content={'detail':str(exc)})
    @app.exception_handler(KeyError)
    async def missing(request,exc):return JSONResponse(status_code=404,content={'detail':'Record or report not found'})
    @app.exception_handler(ValueError)
    async def invalid(request,exc):return JSONResponse(status_code=422,content={'detail':str(exc)})
    @app.exception_handler(ModelUnavailable)
    async def model_error(request,exc):return JSONResponse(status_code=503,content={'detail':str(exc)})
    @app.exception_handler(sqlite3.Error)
    async def database_error(request,exc):return JSONResponse(status_code=503,content={'detail':'Database operation unavailable; no change was committed'})
    @app.get('/api/health')
    def health(p=Depends(pipeline)):return {'status':'ok','model':p.model.metadata(),'llm':p.llm.status(),'mode':'local_demo','operationalAuthority':'no_equipment_control'}
    @app.get('/api/snapshot')
    def snapshot(p=Depends(pipeline)):return p.analyze()
    @app.get('/api/weather')
    def get_weather(refresh:bool=False,p=Depends(pipeline)):return p.weather.get(refresh)
    @app.get('/api/port/live')
    def live(p=Depends(pipeline)):
        s=p.analyze();return {'registers':s['registers'],'simulationTime':s['simulationTime'],'risks':s['report']['risks'],'dependencies':s['report']['dependencies'],'congestion':s['report']['congestion'],'source':'simulated'}
    @app.get('/api/model/metadata')
    def model_metadata(p=Depends(pipeline)):return p.model.metadata()
    @app.post('/api/model/predict')
    def model_predict(body:InferenceRequest,p=Depends(pipeline),actor=Depends(operator)):return p.model.predict(body.features)
    @app.get('/api/congestion')
    def congestion(p=Depends(pipeline)):return p.analyze()['report']['congestion']
    @app.get('/api/dependencies')
    def dependencies(p=Depends(pipeline)):return p.analyze()['report']['dependencies']
    @app.get('/api/alerts')
    def alerts(p=Depends(pipeline)):return p.analyze()['report']['alerts']
    @app.get('/api/scenarios')
    def scenarios(p=Depends(pipeline)):return p.analyze()['report']['scenarios']
    @app.get('/api/approvals')
    def approvals(p=Depends(pipeline)):
        s=p.analyze();return {'report_id':s['report']['id'],'pending':not any(d['report_id']==s['report']['id'] for d in s['decisions']) and bool(s['report']['scenarios']),'recommendation':s['report']['recommended_id'],'history':s['decisions']}
    @app.post('/api/approvals')
    def decide(body:DecisionRequest,p=Depends(pipeline),actor=Depends(operator)):return p.store.decide(body,actor,p.analyze()['report']['id'])
    @app.get('/api/operations')
    def operations(p=Depends(pipeline)):return [d for d in p.store.state()[3] if d['plan'] is not None]
    @app.get('/api/audit')
    def audit(p=Depends(pipeline)):return p.store.audit()
    @app.post('/api/explanations')
    def explain(body:ExplainRequest,p=Depends(pipeline),actor=Depends(operator)):return p.explain(body.report_id)
    @app.post('/api/simulation')
    def simulation(body:SimulationRequest,p=Depends(pipeline),actor=Depends(operator)):
        records,clock,revision,_=p.store.state()
        if body.event=='reset':records,clock=seed_port()
        else:records,clock=advance_port(records,clock,body.hours,body.event)
        p.store.simulation(records,clock,revision,body.event);return p.analyze()
    @app.get('/api/recommendations/{report_id}')
    def report(report_id:str,p=Depends(pipeline)):return p.store.report(report_id)
    def domain_name(domain):
        if domain not in DOMAINS:raise HTTPException(404,'Unknown register')
        return DOMAINS[domain]
    @app.get('/api/{domain}')
    def register(domain:str,p=Depends(pipeline)):return p.store.state()[0][domain_name(domain)]
    def save_record(domain,record,create,expected,p):
        domain=domain_name(domain);records,_,revision,_=p.store.state()
        if expected is None:raise HTTPException(428,'If-Match state revision is required')
        if domain in ('Cranes','Vessels') and record.location not in {b['id'] for b in records['Berths']}:
            if not (domain=='Vessels' and record.location in ('Anchorage','Inbound')):raise ValueError('Assigned berth does not exist')
        if record.supplyAsset and record.supplyAsset not in {a['id'] for a in records['Assets']}:raise ValueError('Supply asset does not exist')
        if domain=='Vessels' and (not record.eta or not record.origin or not record.destination):raise ValueError('Vessels require origin, destination and ETA')
        if record.modelFeatures is not None:p.model.validate_input(record.modelFeatures)
        p.store.save_record(domain,record.model_dump(),create,int(expected));return {'status':'saved','revision':revision+1}
    @app.post('/api/{domain}',status_code=201)
    def create_record(domain:str,record:PortRecord,if_match:str|None=Header(default=None),p=Depends(pipeline),actor=Depends(operator)):return save_record(domain,record,True,if_match,p)
    @app.put('/api/{domain}/{record_id}')
    def update_record(domain:str,record_id:str,record:PortRecord,if_match:str|None=Header(default=None),p=Depends(pipeline),actor=Depends(operator)):
        if record.id!=record_id:raise ValueError('Record ID cannot be changed')
        return save_record(domain,record,False,if_match,p)
    return app

app=create_app()
