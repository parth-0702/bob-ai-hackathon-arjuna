"""Deterministic dependency traversal and an explicitly heuristic criticality index."""
from datetime import datetime,timedelta,timezone


def arrival_hours(value,clock):
    if not value:return 0.
    eta=datetime.fromisoformat(value.replace('Z','+00:00'))
    if eta.tzinfo is None:eta=eta.replace(tzinfo=timezone(timedelta(hours=5,minutes=30)))
    return max(0.,(eta-datetime.fromisoformat(clock)).total_seconds()/3600)

class DependencyEngine:
    def analyze(self,records,clock,risks):
        results=[];assets={r['id']:r for r in records['Assets']+records['Cranes']}
        for id,asset in assets.items():
            cranes=[c for c in records['Cranes'] if c['id']==id or c.get('supplyAsset')==id]
            berths=sorted({c['location'] for c in cranes})
            if not berths and asset['location'] in {b['id'] for b in records['Berths']}:berths=[asset['location']]
            vessels=[v for v in records['Vessels'] if v['location'] in berths and v['status']!='Departed']
            substitutes=[c['id'] for c in records['Cranes'] if c['id'] not in {x['id'] for x in cranes} and c['status']=='Available' and not any(v['location']==c['location'] and arrival_hours(v.get('eta'),clock)<6 for v in records['Vessels'])]
            exposure=sum(v.get('cargoUnits',0) for v in vessels);pressure=sum(arrival_hours(v.get('eta'),clock)<=6 for v in vessels)
            risk=risks.get(id,{}).get('risk_probability')
            health_risk=(100-asset['health'])/100
            score=min(100,round(25*(risk if risk is not None else health_risk)+min(30,exposure/80)+min(25,pressure*10)+(20 if not substitutes else 5)))
            results.append({'asset_id':id,'crane_ids':[c['id'] for c in cranes],'berth_ids':berths,'vessel_ids':[v['id'] for v in vessels],'workload_exposure':exposure,'substitutes':substitutes,'arrivals_within_6h':pressure,'criticality':score,'basis':'Weighted risk, cargo exposure, arrival pressure and substitute availability; index, not probability'})
        return sorted(results,key=lambda r:(-r['criticality'],r['asset_id']))
