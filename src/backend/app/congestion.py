"""Replaceable discrete berth-queue simulation; this is not a trained ML model."""
from .dependencies import arrival_hours

class CongestionPredictor:
    def predict(self,records,clock,risks,weather):
        forecast=[];schedules=[];berth_metrics=[]
        weather_factor=1.
        if weather.get('current') and weather['status']=='available':
            wind=weather['current']['windKnots'];weather_factor=.65 if wind>=30 else .85 if wind>=20 else 1.
        for berth in records['Berths']:
            cranes=[c for c in records['Cranes'] if c['location']==berth['id'] and c['status'] not in ('Maintenance',)]
            capacity=0.
            for crane in cranes:
                probability=risks.get(crane['id'],{}).get('risk_probability')
                supply=risks.get(crane.get('supplyAsset'),{}).get('risk_probability')
                supplier=next((a for a in records['Assets'] if a['id']==crane.get('supplyAsset')),None)
                operational_health=min(crane['health'],supplier['health'] if supplier else 100)/100
                if supplier and supplier['status']=='Maintenance':continue
                factor=max(.1,operational_health*(1-.5*max(probability or 0,supply or 0)))*(.35 if crane['status']=='Restricted' else 1.)
                capacity+=crane.get('handlingRate',80)*factor*weather_factor
            vessels=sorted([v for v in records['Vessels'] if v['location']==berth['id'] and v['status']!='Departed'],key=lambda v:(arrival_hours(v.get('eta'),clock),{'Critical':0,'High':1,'Normal':2}[v.get('priority','Normal')],v['id']))
            next_free=0.;items=[]
            for vessel in vessels:
                arrival=arrival_hours(vessel.get('eta'),clock)
                feasible=vessel.get('length',180)<=berth['capacity'] and vessel.get('draft',10)<=berth.get('maxDraft',13)
                if capacity<=0 or not feasible:
                    start=max(arrival,49.);finish=start+vessel.get('handlingHours',8);delay=max(0.,48-arrival);reason='No compatible available crane capacity' if capacity<=0 else 'Vessel exceeds berth dimensions'
                else:
                    start=max(arrival,next_free);duration=vessel.get('cargoUnits',600)/capacity;finish=start+duration;delay=start-arrival;reason=None
                next_free=finish
                item={'vessel_id':vessel['id'],'berth_id':berth['id'],'arrival':round(arrival,2),'start':round(start,2),'finish':round(finish,2),'delay':round(delay,2),'capacityUnavailable':capacity<=0,'reason':reason};items.append(item);schedules.append(item)
            queue=sum(i['arrival']<=0 and i['start']>0 for i in items)
            load=sum(v.get('cargoUnits',600) for v in vessels)
            demand_index=min(100.,100*load/max(1,capacity*24)) if load else 0.
            berth_metrics.append({'id':berth['id'],'name':berth['name'],'congestion':round(demand_index,1),'utilization':round(min(100,100*sum(max(0,min(24,i['finish'])-min(24,i['start'])) for i in items)/24),1),'queue':queue,'delay':round(sum(i['delay'] for i in items)/max(1,len(items)),2),'cranes':[c['id'] for c in cranes],'capacity':round(capacity,1),'capacityUnit':'cargo units/hour','workload':load,'schedule':items})
        for hour in range(0,49,6):
            queue=sum(i['arrival']<=hour<i['start'] for i in schedules)
            occupied=sum(any(i['berth_id']==b['id'] and i['start']<=hour<i['finish'] for i in schedules) for b in records['Berths'])
            congestion=min(100,round(60*occupied/max(1,len(records['Berths']))+20*queue,1))
            forecast.append({'hour':hour,'congestion':congestion,'queue':queue,'utilization':round(100*occupied/max(1,len(records['Berths'])),1)})
        total_delay=round(sum(i['delay'] for i in schedules),2)
        return {'method':'deterministic-berth-queue-v1','basis':'Known arrivals, cargo demand, crane rate, availability and explicit weather/risk derating; not a calibrated probability','source':'simulated_port_operations','delayIsLowerBound':any(i['capacityUnavailable'] or i['reason'] for i in schedules),'weatherApplied':weather['status']=='available','weatherFactor':weather_factor,'berths':berth_metrics,'series':forecast,'vessels':schedules,'totalDelayHours':total_delay,'averageDelayHours':round(total_delay/max(1,len(schedules)),2),'peakCongestion':max((x['congestion'] for x in forecast),default=0),'currentCongestion':forecast[0]['congestion'],'waitingVessels':forecast[0]['queue']}
