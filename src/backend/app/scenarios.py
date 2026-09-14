"""Predefined feasible interventions evaluated through the same congestion predictor."""
from copy import deepcopy

class ScenarioEngine:
    def __init__(self,predictor):self.predictor=predictor
    def evaluate(self,records,clock,risks,weather,baseline,dependencies):
        target=next((d for d in dependencies if d['berth_ids'] and d['vessel_ids']),None)
        if not target:return []
        berth_id=target['berth_ids'][0];affected=[v for v in records['Vessels'] if v['location']==berth_id and v['status']!='Departed']
        spare=next((c for c in records['Cranes'] if c['id'] in target['substitutes']),None)
        other=next((b for b in records['Berths'] if b['id']!=berth_id and any(c['location']==b['id'] and c['status']=='Available' for c in records['Cranes'])),None)
        vessel=next((v for v in affected if v['status'] in ('Waiting','Inbound')),None)
        scenarios=[]
        for id,kind in [('S0','Do nothing'),('S1','Repair affected equipment'),('S2','Reassign an available crane'),('S3','Shift the next vessel'),('S4','Repair and rebalance')]:
            state=deepcopy(records);adjusted_risks=deepcopy(risks);feasible=True;tasks=[];resources=[];constraints=[];effort=0
            if id in ('S1','S4'):
                for domain in ('Assets','Cranes'):
                    for row in state[domain]:
                        if row['id']==target['asset_id'] or row['id'] in target['crane_ids']:
                            row['health']=96;row['status']='Available';adjusted_risks.pop(row['id'],None)
                effort+=2;resources+=['Maintenance crew'];tasks.append(f'Inspect and restore {target["asset_id"]} and dependent handling equipment at {berth_id}.');constraints.append('Repair is assumed completed before the modeled handling window; no measured repair duration or success probability is available.')
            if id in ('S2','S4'):
                if spare:
                    next(c for c in state['Cranes'] if c['id']==spare['id'])['location']=berth_id
                    effort+=1;resources.append(spare['id']);tasks.append(f'Reassign {spare["id"]} from {spare["location"]} to {berth_id} after route and compatibility checks.');constraints.append('The donor berth has no scheduled arrival in the next 6 hours; crane travel and lifting compatibility require operator verification.')
                else:feasible=False;constraints.append('No eligible substitute crane available.')
            if id=='S3':
                if other and vessel and vessel.get('length',180)<=other['capacity'] and vessel.get('draft',10)<=other.get('maxDraft',13):
                    next(v for v in state['Vessels'] if v['id']==vessel['id'])['location']=other['id'];effort=2;resources=[other['id'],'Pilot and tugs'];tasks.append(f'Shift {vessel["name"]} to {other["id"]} with operator-authorized pilot/tug support.');constraints.append('Cargo and berth compatibility require local confirmation; geometric length/draft constraints pass.')
                else:feasible=False;constraints.append('No compatible alternate berth and waiting vessel pair.')
            if id=='S0':tasks=['Continue monitoring; keep the existing operational plan.'];constraints=['No improvement in capacity is assumed.']
            prediction=self.predictor.predict(state,clock,adjusted_risks,weather)
            metrics={'totalDelayHours':prediction['totalDelayHours'],'peakCongestion':prediction['peakCongestion'],'peakQueue':max(x['queue'] for x in prediction['series']),'resourceEffort':effort}
            score=round(metrics['totalDelayHours']+metrics['peakCongestion']*.1+effort*2,3)
            scenarios.append({'id':id,'name':kind,'detail':' '.join(tasks),'tasks':tasks,'resources':' · '.join(resources) or 'Existing shift resources','resourceIds':resources,'assumption':' '.join(constraints),'feasible':feasible,'score':score,'scoreBasis':'Total vessel delay hours + 0.1 × peak congestion index + 2 × resource effort units; lower is better. Effort units are not monetary costs.','delay':round(baseline['totalDelayHours']-prediction['totalDelayHours'],2),'congestion':round(baseline['peakCongestion']-prediction['peakCongestion'],1),'risk':'Conditional on operator checks' if id!='S0' else 'Existing exposure','affectedBerths':sorted(set([berth_id]+([other['id']] if id=='S3' and other else []))), 'affectedVessels':[v['id'] for v in affected],'metrics':metrics,'series':prediction['series']})
        return sorted(scenarios,key=lambda s:(not s['feasible'],s['score'],s['id']))
