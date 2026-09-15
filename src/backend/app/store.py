"""SQLite transactions persist operational state, immutable analyses and decisions."""
from contextlib import contextmanager
from pathlib import Path
import json,sqlite3,re
from .schemas import utcnow
from .simulation import seed_port

class Conflict(ValueError): pass

class Store:
    def __init__(self,path):
        self.path=str(path);Path(path).parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as db:
            db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS records(domain TEXT,id TEXT,body TEXT NOT NULL,PRIMARY KEY(domain,id));
            CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,revision INTEGER,body TEXT NOT NULL,at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS decisions(id INTEGER PRIMARY KEY,report_id TEXT UNIQUE,request_id TEXT UNIQUE,body TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT,event TEXT,body TEXT);
            CREATE TABLE IF NOT EXISTS weather(id INTEGER PRIMARY KEY,at TEXT,body TEXT);
            ''')
            if not db.execute("SELECT 1 FROM meta WHERE key='revision'").fetchone():
                records,clock=seed_port();self._replace(db,records,clock,1);self._audit(db,'workspace_initialized',{'source':'simulated'})
    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row
        try:
            yield db;db.commit()
        except Exception:
            db.rollback();raise
        finally:db.close()
    def _audit(self,db,event,body):
        db.execute('INSERT INTO audit(at,event,body) VALUES(?,?,?)',(utcnow(),event,json.dumps(body)))
    def _replace(self,db,records,clock,revision):
        db.execute('DELETE FROM records')
        for domain,rows in records.items():
            for row in rows:db.execute('INSERT INTO records VALUES(?,?,?)',(domain,row['id'],json.dumps(row)))
        for key,value in [('clock',clock),('revision',str(revision))]:db.execute('INSERT OR REPLACE INTO meta VALUES(?,?)',(key,value))
    def state(self):
        with self.connect() as db:
            db.execute('BEGIN')
            records={k:[] for k in ('Assets','Vessels','Berths','Cranes')}
            for row in db.execute('SELECT * FROM records ORDER BY id'):records[row['domain']].append(json.loads(row['body']))
            meta=dict(db.execute('SELECT key,value FROM meta').fetchall())
            decisions=[json.loads(row['body']) for row in db.execute('SELECT body FROM decisions ORDER BY id')]
            return records,meta['clock'],int(meta['revision']),decisions
    def save_record(self,domain,record,create,expected_revision):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            revision=int(db.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0])
            if expected_revision!=revision:raise Conflict('Port state changed. Refresh before saving.')
            exists=db.execute('SELECT 1 FROM records WHERE domain=? AND id=?',(domain,record['id'])).fetchone()
            if create and exists:raise Conflict('That ID already exists.')
            if not create and not exists:raise KeyError(record['id'])
            rows=[(r['domain'],r['id'],json.loads(r['body'])) for r in db.execute('SELECT * FROM records')]
            unavailable={id for d,id,body in rows if d=='Cranes' and body.get('status')=='Maintenance'}
            assignments={part for part in re.split(r'[,;\s·]+',record.get('assignedCranes','')) if part}
            if domain=='Vessels' and assignments & unavailable:
                raise Conflict('Cannot assign cranes under maintenance: '+', '.join(sorted(assignments & unavailable)))
            db.execute('INSERT OR REPLACE INTO records VALUES(?,?,?)',(domain,record['id'],json.dumps(record)))
            if domain in ('Assets','Cranes'):
                other='Assets' if domain=='Cranes' else 'Cranes'
                duplicate=db.execute('SELECT body FROM records WHERE domain=? AND id=?',(other,record['id'])).fetchone()
                if duplicate:
                    merged={**json.loads(duplicate[0]),**record};db.execute('UPDATE records SET body=? WHERE domain=? AND id=?',(json.dumps(merged),other,record['id']))
            cleared=[]
            if domain in ('Assets','Cranes') and record['status']=='Maintenance' and (domain=='Cranes' or any(d=='Cranes' and id==record['id'] for d,id,_ in rows)):
                for d,id,body in rows:
                    if id==record['id'] and d in ('Assets','Cranes'):continue
                    assigned=[part for part in re.split(r'[,;\s·]+',body.get('assignedCranes','')) if part]
                    if record['id'] in assigned:
                        body['assignedCranes']=', '.join(part for part in assigned if part!=record['id'])
                        db.execute('UPDATE records SET body=? WHERE domain=? AND id=?',(json.dumps(body),d,id))
                        cleared.append({'domain':d,'id':id})
            db.execute("UPDATE meta SET value=? WHERE key='revision'",(str(revision+1),));self._audit(db,'record_created' if create else 'record_updated',{'domain':domain,'record':record,'clearedAssignments':cleared,'revision':revision+1})
    def delete_record(self,domain,record_id,expected_revision,actor):
        if domain not in ('Cranes','Berths'):raise ValueError('Only cranes and berths can be deleted')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            revision=int(db.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0])
            if revision!=expected_revision:raise Conflict('Port state changed. Refresh before deleting.')
            rows=[(r['domain'],r['id'],json.loads(r['body'])) for r in db.execute('SELECT * FROM records')]
            record=next((body for d,id,body in rows if d==domain and id==record_id),None)
            if record is None:raise KeyError(record_id)
            removed=[{'domain':domain,'record':record}]
            if domain=='Berths':
                linked=[f'{d}: {id}' for d,id,body in rows if d in ('Assets','Cranes','Vessels') and body.get('location')==record_id]
                if linked:raise Conflict('Reassign these records before deleting this berth: '+', '.join(linked))
            else:
                linked=[f'{d}: {id}' for d,id,body in rows if id!=record_id and body.get('supplyAsset')==record_id]
                if linked:raise Conflict('Reassign the supply asset for these records first: '+', '.join(linked))
                mirror=next((body for d,id,body in rows if d=='Assets' and id==record_id),None)
                if mirror is not None:
                    removed.append({'domain':'Assets','record':mirror})
                    db.execute('DELETE FROM records WHERE domain=? AND id=?',('Assets',record_id))
            updated=[]
            if domain=='Cranes':
                for d,id,body in rows:
                    if id==record_id and d in ('Cranes','Assets'):continue
                    assignments=[part for part in re.split(r'[,;\s·]+',body.get('assignedCranes','')) if part]
                    if record_id in assignments:
                        body['assignedCranes']=', '.join(part for part in assignments if part!=record_id)
                        db.execute('UPDATE records SET body=? WHERE domain=? AND id=?',(json.dumps(body),d,id))
                        updated.append({'domain':d,'id':id})
            db.execute('DELETE FROM records WHERE domain=? AND id=?',(domain,record_id))
            db.execute("UPDATE meta SET value=? WHERE key='revision'",(str(revision+1),))
            self._audit(db,'record_deleted',{'removed':removed,'clearedAssignments':updated,'revision':revision+1,'actor':actor})
            return revision+1
    def save_report(self,report):
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO reports VALUES(?,?,?,?)',(report['id'],report['revision'],json.dumps(report),utcnow()))
    def report(self,id):
        with self.connect() as db:
            row=db.execute('SELECT body FROM reports WHERE id=?',(id,)).fetchone()
            if not row:raise KeyError(id)
            return json.loads(row[0])
    def decide(self,request,actor,current_report_id=None):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            previous=db.execute('SELECT body FROM decisions WHERE request_id=?',(request.request_id,)).fetchone()
            if previous:
                decision=json.loads(previous[0])
                if any(decision[k]!=v for k,v in [('report_id',request.report_id),('solution',request.scenario_id),('status',request.status),('comment',request.comment)]):raise Conflict('Idempotency key was already used for a different decision.')
                return decision
            if current_report_id and current_report_id!=request.report_id:raise Conflict('Analysis inputs changed. Refresh and review the current recommendation.')
            row=db.execute('SELECT body FROM reports WHERE id=?',(request.report_id,)).fetchone()
            if not row:raise KeyError(request.report_id)
            report=json.loads(row[0]); revision=int(db.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0])
            if report['revision']!=revision:raise Conflict('Recommendation is stale. Refresh and review the new analysis.')
            if db.execute('SELECT 1 FROM decisions WHERE report_id=?',(request.report_id,)).fetchone():raise Conflict('A decision is already recorded for this recommendation.')
            scenario=next((s for s in report['scenarios'] if s['id']==request.scenario_id),None)
            if not scenario:raise ValueError('Unknown scenario')
            if request.status!='Rejected' and not scenario['feasible']:raise ValueError('An infeasible scenario cannot be approved')
            if request.status in ('Modified','Rejected') and not request.comment:raise ValueError('A comment is required for modification or rejection')
            decision={'id':request.report_id,'report_id':request.report_id,'solution':request.scenario_id,'scenario':scenario,'status':request.status,'comment':request.comment,'at':utcnow(),'actor':actor,'plan':None if request.status=='Rejected' else {'status':'accepted_in_demo','tasks':scenario['tasks'],'operatorConditions':request.comment,'execution':'not_executed','metrics':scenario['metrics']}}
            db.execute('INSERT INTO decisions(report_id,request_id,body) VALUES(?,?,?)',(request.report_id,request.request_id,json.dumps(decision)))
            self._audit(db,'human_decision',{'decision':decision,'model_results':report['risks'],'recommendation':report['recommended_id']})
            return decision
    def simulation(self,records,clock,expected_revision,event):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE');revision=int(db.execute("SELECT value FROM meta WHERE key='revision'").fetchone()[0])
            if revision!=expected_revision:raise Conflict('Port state changed. Retry simulation.')
            self._replace(db,records,clock,revision+1);self._audit(db,'simulation_'+event,{'revision':revision+1,'clock':clock})
    def audit(self):
        with self.connect() as db:return [{'id':r['id'],'at':r['at'],'event':r['event'],'details':json.loads(r['body'])} for r in db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 100')]
    def weather_save(self,snapshot):
        with self.connect() as db:db.execute('INSERT INTO weather(at,body) VALUES(?,?)',(utcnow(),json.dumps(snapshot)))
