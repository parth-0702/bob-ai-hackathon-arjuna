from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

DOMAINS = {'assets':'Assets','vessels':'Vessels','berths':'Berths','cranes':'Cranes'}

def utcnow():
    return datetime.now(timezone.utc).isoformat()

class PortRecord(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=40, pattern=r'^[A-Za-z0-9-]+$')
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=80)
    location: str = Field(min_length=1, max_length=100)
    capacity: float = Field(gt=0, le=1e8)
    capacityUnit: str = 'units'
    status: Literal['Available','Working','Occupied','At risk','Restricted','Alongside','Waiting','Inbound','Maintenance','Departed'] = 'Available'
    health: float = Field(default=100, ge=0, le=100)
    workload: float = Field(default=0, ge=0, le=100)
    maintenance: str = ''
    operatingHours: float = Field(default=0, ge=0)
    constraints: str = Field(default='', max_length=2000)
    origin: str = ''
    destination: str = 'Kandla'
    eta: str = ''
    plannedEta: str = ''
    priority: Literal['Normal','High','Critical'] = 'Normal'
    assignedCranes: str = ''
    handlingHours: float = Field(default=8, gt=0, le=240)
    imo: str | None = None
    mmsi: str | None = None
    position: dict[str,float] | None = None
    speed: float = Field(default=0, ge=0, le=50)
    heading: float = Field(default=0, ge=0, lt=360)
    draft: float = Field(default=10, gt=0, le=30)
    length: float = Field(default=180, gt=0, le=500)
    maxDraft: float = Field(default=13, gt=0, le=30)
    cargoType: str = 'General cargo'
    cargoUnits: float = Field(default=600, ge=0, le=1e7)
    handlingRate: float = Field(default=80, gt=0, le=10000)
    supplyAsset: str | None = None
    modelFeatures: dict[str,float] | None = None
    source: Literal['simulated','operator-entered'] = 'operator-entered'

    @field_validator('eta','plannedEta')
    @classmethod
    def valid_eta(cls,v):
        if v:
            try: datetime.fromisoformat(v.replace('Z','+00:00'))
            except ValueError: raise ValueError('ETA must be an ISO date/time; unzoned values are interpreted as Asia/Kolkata')
        return v

    @field_validator('imo')
    @classmethod
    def valid_imo(cls,v):
        if v and (not v.isdigit() or len(v)!=7): raise ValueError('IMO must contain seven digits')
        return v

    @field_validator('mmsi')
    @classmethod
    def valid_mmsi(cls,v):
        if v and (not v.isdigit() or len(v)!=9): raise ValueError('MMSI must contain nine digits')
        return v

class DecisionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    report_id: str
    scenario_id: str
    status: Literal['Approved','Modified','Rejected']
    comment: str = Field(default='', max_length=4000)
    request_id: str = Field(min_length=8, max_length=100)

class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    hours: int = Field(default=6, ge=1, le=48)
    event: Literal['advance','degrade','repair','reset'] = 'advance'

class InferenceRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    features: dict[str,float]

class ExplainRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    report_id: str
