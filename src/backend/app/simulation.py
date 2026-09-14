"""Reproducible operational fixtures, independent of external live weather."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json

BASE = json.loads((Path(__file__).parent/'fixtures/port.json').read_text(encoding='utf-8'))

def seed_port():
    records=deepcopy(BASE)
    clock=datetime.now(timezone.utc).replace(minute=0,second=0,microsecond=0)
    for domain, rows in records.items():
        for row in rows:
            row.update(source='simulated',capacityUnit='m' if domain=='Berths' else 't' if domain=='Cranes' else 'units')
    for i,v in enumerate(records['Vessels']):
        arrival=[0,0,0,4,7][i]
        v.update(eta=(clock+timedelta(hours=arrival)).isoformat(),plannedEta=(clock+timedelta(hours=arrival)).isoformat(),location=['B01','B02','B03','B03','B03'][i],cargoUnits=[640,560,1000,720,640][i],handlingHours=[8,7,12.5,9,8][i],position={'latitude':23.032+i*.003,'longitude':70.222+i*.003},speed=0 if i<3 else 4.5,heading=315,length=180,draft=10,cargoType='General cargo')
    for c in records['Cranes']:
        c.update(handlingRate=80,supplyAsset='P03' if c['id']=='C07' else None)
    for b in records['Berths']:
        b.update(maxDraft=13,cargoType='General cargo')
    return records,clock.isoformat()

def advance_port(records, clock, hours, event):
    out=deepcopy(records); now=datetime.fromisoformat(clock)+timedelta(hours=hours)
    for vessel in out['Vessels']:
        eta=datetime.fromisoformat(vessel['eta'].replace('Z','+00:00'))
        if eta.tzinfo is None: eta=eta.replace(tzinfo=timezone(timedelta(hours=5,minutes=30)))
        if vessel['status'] in ('Inbound','Waiting'):
            vessel['status']='Waiting' if eta<=now else 'Inbound'
            vessel['position']={'latitude':23.03+max(0,(eta-now).total_seconds()/3600)*.001,'longitude':70.225}
            vessel['speed']=0 if eta<=now else 4.5
    if event in ('degrade','repair'):
        for domain in ('Assets','Cranes'):
            for r in out[domain]:
                if r['id'] in ('P03','C07'):
                    r['health']=42 if event=='degrade' else 96
                    r['status']='Restricted' if event=='degrade' else 'Available'
    return out,now.isoformat()
