import {writerLease} from '../../packages/operations/lease.ts';
const releaseWriter=writerLease('tools/simulator/index.ts');
process.once('exit',releaseWriter);
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const rate=Number(process.env.RATE??150), seconds=Number(process.env.SECONDS??10);
if(!Number.isFinite(rate)||rate<1||rate>1000||!Number.isFinite(seconds)||seconds<1||seconds>300) throw new Error('RATE: 1–1000; SECONDS: 1–300');
const base=process.env.API_URL??'http://127.0.0.1:3001';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Solo API local');
const total=Math.floor(rate*seconds), started=performance.now(), latencies:number[]=[],statuses:Record<string,number>={};
const pending=new Set<Promise<void>>();
let completed=0;
for(let i=0;i<total;i++) {
 const delay=started+i*1000/rate-performance.now();
 if(delay>0) await new Promise(r=>setTimeout(r,delay));
 while(pending.size>=100) await Promise.race(pending);
 const id=randomUUID(),begin=performance.now();
 const task=(async()=>{
  try {const response=await fetch(base+'/api/v1/readings',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json','idempotency-key':id},body:JSON.stringify({readingId:id,lotId:'FT-2026-001',sensorId:i%2?'S-001':'S-002',observedAt:new Date().toISOString(),temperatureC:5,humidityPct:80,batteryPct:90,doorOpen:false,latitude:4.7,longitude:-74.1})});await response.text();statuses[response.status]=(statuses[response.status]??0)+1;if(response.ok)completed++;}
  catch {statuses.networkError=(statuses.networkError??0)+1;}
  finally{latencies.push(performance.now()-begin);}
 })();
 pending.add(task);void task.then(()=>pending.delete(task));
}
await Promise.all(pending);
const elapsed=(performance.now()-started)/1000;latencies.sort((a,b)=>a-b);
const report={at:new Date().toISOString(),scope:'DynamoDB Local, dos sensores con contención; no representa capacidad AWS',targetRate:rate,requestedSeconds:seconds,total,completed,statuses,elapsedSeconds:elapsed,actualSuccessfulRate:completed/elapsed,p50Ms:latencies[Math.floor(latencies.length*.5)],p95Ms:latencies[Math.floor(latencies.length*.95)]};
await mkdir('evidence',{recursive:true});await writeFile(`evidence/load-${rate}-${Date.now()}.json`,JSON.stringify(report,null,2));console.log(report);
if(completed!==total)process.exitCode=1;
