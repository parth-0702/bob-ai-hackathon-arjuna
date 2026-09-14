"""Orchestrates replaceable services and persists each reproducible analysis."""
from copy import deepcopy
import hashlib,json
from .alerts import AlertEngine
from .congestion import CongestionPredictor
from .dependencies import DependencyEngine
from .failure_model import DEMO_HEALTHY,DEMO_STRESSED,ModelUnavailable,weather_to_features
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
            weather_live=weather.get('status') in ('available','stale') and weather.get('current') is not None
            for asset in records['Assets']+records['Cranes']:
                if asset['id'] in risks:continue
                features=asset.get('modelFeatures')
                input_src='operator_supplied_engineered_features'
                live_applied=False
                if features is None and asset.get('source')=='simulated':
                    # Prefer live-weather bridge; fall back to static demo vectors
                    live_features=weather_to_features(weather,asset)
                    if live_features is not None:
                        features=live_features;input_src='live_weather_and_health_proxy';live_applied=True
                    else:
                        features=DEMO_STRESSED if asset['health']<75 else DEMO_HEALTHY;input_src='synthetic_preengineered_demo_vector'
                if features is None:
                    risks[asset['id']]={'status':'unavailable','risk_probability':None,'note':'No verified engineered model inputs for this asset.'};continue
                try:
                    result=self.model.predict(features);risks[asset['id']]={**result,'status':'available','input_source':input_src,'live_weather_applied':live_applied}
                except (ValueError,ModelUnavailable) as exc:risks[asset['id']]={'status':'unavailable','risk_probability':None,'note':str(exc)}
            dependencies=self.dependencies.analyze(records,clock,risks);congestion=self.congestion.predict(records,clock,risks,weather);alerts=self.alerts.generate(records,congestion,dependencies,risks,weather)
            scenarios=self.scenarios.evaluate(records,clock,risks,weather,congestion,dependencies) if alerts else []
            recommended=next((s for s in scenarios if s['feasible']),None)
            primary=alerts[0] if alerts else None
            weather_note=f'Live weather applied to model inputs (wind {weather["current"]["windKmh"]:g} km/h, rain {weather["current"]["rainfall"]:g} mm/h, {"storm active" if weather["current"].get("weatherCode") in {95,96,99} else "no storm"}).' if weather_live else 'Live weather unavailable; static demo vectors used for model inputs.'
            # Build richer facts so the LLM can explain the full cause->impact->solution chain
            primary_risk=risks.get(primary['asset_id']) if primary and primary.get('asset_id') else None
            primary_dep=primary['dependency'] if primary and primary.get('dependency') else None
            scenario_summary='; '.join(s['name']+' (delay avoided: '+str(s['delay'])+'h, feasible: '+str(s['feasible'])+')' for s in scenarios) if scenarios else ''
            facts={
                'state':f'The operational snapshot is simulated at {clock}.',
                'weather':weather_note,
                'alert':(primary['title']+' — '+primary['problem']) if primary else 'No active alerts.',
                'risk':('Asset '+primary['asset_id']+' has a model-estimated failure risk of '+f'{primary_risk["class_1_probability"]:.2%}'+' (band: '+primary_risk['threshold_band']+'). Input source: '+primary_risk['input_source']+'.') if (primary_risk and primary_risk.get('class_1_probability') is not None) else ('Infrastructure risk is elevated based on asset health and current weather.' if primary else 'No infrastructure risk detected.'),
                'dependency':('Asset '+primary_dep['asset_id']+' serves cranes '+str(primary_dep['crane_ids'])+' at berths '+str(primary_dep['berth_ids'])+', affecting '+str(len(primary_dep['vessel_ids']))+' vessel(s) with '+str(primary_dep['workload_exposure'])+' cargo units of exposure. Criticality index: '+str(primary_dep['criticality'])+'/100. Available substitutes: '+str(primary_dep['substitutes'] or 'none')+'.') if primary_dep else 'No dependency chain identified.',
                'impact':f'Queue simulation estimates {congestion["averageDelayHours"]:g} hours average vessel delay and a peak congestion index of {congestion["peakCongestion"]:g} out of 100. Berth '+next((b['id'] for b in congestion['berths'] if b['congestion']==max(b2['congestion'] for b2 in congestion['berths'])),'')+ ' has the highest congestion.',
                'recommendation':('Recommended response: '+recommended['name']+'. Tasks: '+recommended['detail']+' Resources needed: '+recommended['resources']+'. Expected improvement: '+str(recommended['delay'])+' vessel-delay hours avoided, congestion reduced by '+str(recommended['congestion'])+' points.') if recommended else 'No intervention recommendation is pending.',
                'scenarios':('All evaluated responses in order: '+scenario_summary+'.') if scenarios else 'No scenarios evaluated.',
                'authority':'A human operator must review the selected scenario and approve, modify or reject it. No real equipment action is executed by this system.',
                'limitations':'Weather features are applied using formulas derived from demo anchor points; WSI formula and class-1 semantics require confirmation by the training author.' if not self.model.confirmed else 'Failure estimates combine live weather and health-interpolated machine state; not a guarantee of equipment failure.',
            }
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
