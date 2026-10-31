import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {eventLog} from '../packages/operations/log.ts';
import {writerLease,maintenanceLease} from '../packages/operations/lease.ts';
import {DurableQueue,forwardBatch} from '../packages/gateway/index.ts';
test('logs rotate and remain independently parseable JSONL',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'friotrack-log-')),file=join(dir,'events.jsonl');const log=eventLog(file,200,2);
 for(let i=0;i<20;i++)log('retry',{attempt:i});
 const names=await readdir(dir);assert.ok(names.includes('events.jsonl.2'));assert.equal(names.length,3);
 for(const n of names)for(const line of (await readFile(join(dir,n),'utf8')).trim().split('\n')){const e=JSON.parse(line);assert.equal(e.event,'retry');assert.ok(e.at);}
});
test('backup lock refuses active writers and writers refuse maintenance',async()=>{
 const root=await mkdtemp(join(tmpdir(),'friotrack-lease-'));
 const release=writerLease('unit-test',root);try{assert.throws(()=>maintenanceLease(root),/escritores activos/);}finally{release();}
 const end=maintenanceLease(root);try{assert.throws(()=>writerLease('blocked',root),/curso/);}finally{end();}
});
test('retryable HTTP errors stay pending; successful replay records delivery metadata',async()=>{
 const logEvents:any[]=[],q=new DurableQueue(':memory:');
 const input={readingId:'retry',lotId:'lot',sensorId:'sensor',observedAt:new Date().toISOString(),temperatureC:5,humidityPct:70,batteryPct:90,doorOpen:false,latitude:4.7,longitude:-74.1};
 q.enqueue(input,'key');
 for(const [i,status] of [408,425,429,503].entries()){await forwardBatch(q,async()=>status,i*100000,(event,data)=>logEvents.push({event,...data}));assert.equal(q.stats().pending,1);assert.equal(q.stats().quarantined,0);}
 await forwardBatch(q,async()=>200,500000,(event,data)=>logEvents.push({event,...data}));assert.equal(q.stats().sent,1);assert.equal(logEvents.filter(e=>e.event==='queue_retry').length,4);assert.equal(logEvents.at(-1).event,'queue_delivered');assert.equal(JSON.stringify(logEvents).includes('latitude'),false);q.close();
});

test('HTTP 202 does not acknowledge a committed reading',async()=>{
 const q=new DurableQueue(':memory:');q.enqueue({readingId:'r',lotId:'l',sensorId:'s',observedAt:new Date().toISOString(),temperatureC:5,humidityPct:70,batteryPct:90,doorOpen:false,latitude:0,longitude:0},'k');
 await forwardBatch(q,async()=>202,0);assert.equal(q.stats().sent,0);assert.equal(q.stats().pending,1);q.close();
});
