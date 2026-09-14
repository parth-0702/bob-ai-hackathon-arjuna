"""Orchestrates replaceable services and persists each reproducible analysis."""
from copy import deepcopy
import hashlib,json
from .alerts import AlertEngine
from .congestion import CongestionPredictor
from .dependencies import DependencyEngine
from .failure_model import DEMO_HEALTHY,DEMO_STRESSED,ModelUnavailable
from .scenarios import ScenarioEngine
from .schemas import utcnow

class Pipeline:
    def __init__(self,store,model,weather,llm):
        self.store=store;self.model=model;self.weather=weather;self.llm=llm;self.dependencies=DependencyEngine();self.congestion=CongestionPredictor();self.scenarios=ScenarioEngine(self.congestion);self.alerts=AlertEngine();self.cache={}
    def analyze(self,refresh_weather=False):
        records,clock,revision,decisions=self.store.state();weather=self.weather.get(refresh_weather)
        digest=hashlib.sha256(json.dumps({'engine_version':'queue-v2-supply-health','revision':revision,'weather_time':weather.get('fetchedAt'),'weather_status':weather['status'],'model':self.model.metadata()},sort_keys=True).encode()).hexdigest()[:16]
        report_id='R-'+digest
        if report_id in self.cache:report=deepcopy(self.cache[report_id])
        else:
            risks={}
            for asset in records['Assets']+records['Cranes']:
                if asset['id'] in risks:continue
                features=asset.get('modelFeatures')
                if features is None and asset.get('source')=='simulated':features=DEMO_STRESSED if asset['health']<75 else DEMO_HEALTHY
                if features is None:
                    risks[asset['id']]={'status':'unavailable','risk_probability':None,'note':'No verified engineered model inputs for this asset.'};continue
                try:
                    result=self.model.predict(features);risks[asset['id']]={**result,'status':'available','input_source':'operator_supplied_engineered_features' if asset.get('modelFeatures') else 'synthetic_preengineered_demo_vector','live_weather_applied':False}
                except (ValueError,ModelUnavailable) as exc:risks[asset['id']]={'status':'unavailable','risk_probability':None,'note':str(exc)}
            dependencies=self.dependencies.analyze(records,clock,risks);congestion=self.congestion.predict(records,clock,risks,weather);alerts=self.alerts.generate(records,congestion,dependencies,risks,weather)
            scenarios=self.scenarios.evaluate(records,clock,risks,weather,congestion,dependencies) if alerts else []
            recommended=next((s for s in scenarios if s['feasible']),None)
            primary=alerts[0] if alerts else None
            facts={'state':f'The operational snapshot is simulated at {clock}.', 'impact':f'Queue simulation estimates {congestion["averageDelayHours"]:g} hours average vessel delay and a peak congestion index of {congestion["peakCongestion"]:g} out of 100.', 'recommendation':f'The lowest-score feasible response is {recommended["name"]}, with {recommended["delay"]:g} total vessel-delay hours avoided.' if recommended else 'No intervention recommendation is pending.', 'authority':'A human operator must review the selected scenario. No real equipment action is executed.', 'limitations':'Model feature definitions and class-1 meaning are unconfirmed; live-weather-to-model preprocessing is unavailable.' if not self.model.confirmed else 'Failure estimates use explicitly provided or simulated engineered inputs; no guarantee of operational outcome.'}
            report={'id':report_id,'revision':revision,'at':utcnow(),'simulationTime':clock,'source':'simulated_port_state','risks':risks,'dependencies':dependencies,'congestion':congestion,'alerts':alerts,'primaryAlert':primary,'scenarios':scenarios,'recommended_id':recommended['id'] if recommended else None,'facts':facts,'weather':weather,'model':self.model.metadata()}
            self.store.save_report(report);self.cache={report_id:deepcopy(report)}
        # Persisted explanation belongs to its exact report, never to a different revision.
        explanation=self.store.report(report_id).get('explanation')
        if explanation and explanation.get('provider')==self.llm.provider and explanation.get('model')==self.llm.model:report['explanation']=explanation
        else:report['explanation']={'status':'not_requested','provider':self.llm.provider,'model':self.llm.model,'source':'deterministic_backend','summary':' '.join(report['facts'].values())}
        return {'registers':records,'decisions':decisions,'revision':revision,'report':report,'weather':weather,'audit':self.store.audit(),'services':{'model':self.model.metadata(),'weather':weather['status'],'llm':self.llm.status()},'simulationTime':clock}
    def explain(self,id):
        report=self.store.report(id);explanation=self.llm.explain({'report_id':id,'facts':report['facts']})
        with self.store.connect() as db:
            report['explanation']=explanation;db.execute('UPDATE reports SET body=? WHERE id=?',(json.dumps(report),id));self.store._audit(db,'explanation_generated',{'report_id':id,'source':explanation['source'],'status':explanation['status']})
        return explanation
