import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile,open,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as sleep} from 'node:timers/promises';
const started=Date.now(),runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const real=process.argv.includes('--real-time');
process.env.TABLE_PREFIX='E2E_'+runId.replace(/[^a-zA-Z0-9_]/g,'_');
const dir=resolve('evidence/gateway-e2e',runId),work=resolve('.local/e2e',runId);
await mkdir(dir,{recursive:true});await mkdir(work,{recursive:true,mode:0o700});
const [{buildApp},{initialize,put,tables,get},{readings,integrity},{sha256,readingSchema},{createBackup,restoreBackup,verifyBackup},{eventLog}]=await Promise.all([
 import('../apps/api/src/app.ts'),import('../packages/dynamodb/client.ts'),import('../apps/api/src/service.ts'),import('../packages/domain/index.ts'),import('../packages/operations/backup.ts'),import('../packages/operations/log.ts')]);
const log=eventLog(join(dir,'events.jsonl'));
let queuePath=join(work,'gateway.sqlite');const gatewayLog=join(dir,'gateway.jsonl');
const lotId='TEST-E2E-'+randomUUID().slice(0,8),sensors=Array.from({length:12},(_,i)=>'S-'+i);
const base=real?Date.now():Date.now()-3600000;
const expected=Array.from({length:120},(_,tick)=>sensors.map((sensorId,i)=>({readingId:`r-${tick}-${i}`,lotId,sensorId,observedAt:new Date(base+tick*30000).toISOString(),temperatureC:tick%20===0?12:5,humidityPct:70,batteryPct:90,doorOpen:false,latitude:4.7,longitude:-74.1}))).flat();
let gateway:ChildProcess|undefined,api:ReturnType<typeof buildApp>|undefined,apiPort=0,dropped=0,proxyFailures=0,replayed=0,upstreamCommitted=0,firstDroppedId='';
const proxy=createServer(async(req,res)=>{
 try{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const body=Buffer.concat(chunks).toString();
  const response=await fetch(`http://127.0.0.1:${apiPort||1}/api/v1/readings`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':String(req.headers['idempotency-key'])},body,signal:AbortSignal.timeout(5000)});
  const text=await response.text();const result=JSON.parse(text);
  if(response.ok){upstreamCommitted++;if(result.replayed)replayed++;}
  if(response.status===201&&dropped===0){dropped++;firstDroppedId=JSON.parse(body).readingId;log('ack_dropped_after_commit',{readingId:firstDroppedId});res.destroy();return;}
  res.writeHead(response.status,{'content-type':'application/json'});res.end(text);
 }catch{proxyFailures++;res.writeHead(503);res.end('{}');}
});
await new Promise<void>(resolve=>proxy.listen(0,'127.0.0.1',resolve));
const proxyPort=(proxy.address() as import('node:net').AddressInfo).port;
async function freePort(){const s=createServer();await new Promise<void>(r=>s.listen(0,'127.0.0.1',r));const port=(s.address() as import('node:net').AddressInfo).port;await new Promise<void>(r=>s.close(()=>r()));return port;}
const gatewayPort=await freePort(),gatewayUrl=`http://127.0.0.1:${gatewayPort}`;
async function waitUntil(fn:()=>Promise<boolean>,timeout=30000){const until=Date.now()+timeout;while(Date.now()<until){if(await fn())return;await sleep(100);}throw new Error('Timeout waiting for E2E condition');}
async function boot(){
 const file=await open(join(dir,'gateway-process.log'),'a');
 gateway=spawn(process.execPath,['--import','tsx','tools/gateway.ts'],{cwd:process.cwd(),env:{...process.env,GATEWAY_DB:queuePath,GATEWAY_LOG:gatewayLog,GATEWAY_PORT:String(gatewayPort),GATEWAY_INTERVAL_MS:'100',API_URL:`http://127.0.0.1:${proxyPort}`},stdio:['ignore',file.fd,file.fd]});
 await file.close();await waitUntil(async()=>{if(gateway?.exitCode!==null)throw new Error('Gateway no inició; consulte gateway-process.log');try{return(await fetch(gatewayUrl+'/health',{signal:AbortSignal.timeout(500)})).ok;}catch{return false;}});
}
async function kill(signal:NodeJS.Signals){if(gateway&&gateway.exitCode===null&&gateway.signalCode===null){const exited=once(gateway,'exit');gateway.kill(signal);await exited;}gateway=undefined;}
async function post(input:typeof expected[number],key=input.readingId){const res=await fetch(gatewayUrl+'/readings',{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify(input)});assert.equal(res.status,202,await res.text());}
const summary:any={runId,environment:'DynamoDB Local + real HTTP + SQLite on this computer',mode:real?'real-time':'accelerated',representedOutageSeconds:3600,sensors:sensors.length,intervalSeconds:30,expectedReadings:expected.length,tables,lotId,startedAt:new Date(started).toISOString(),claims:{awsTested:false,fleet4500Validated:false,independentOffsiteBackup:false}};
try{
 await initialize();await put(tables.core,{PK:'LOT#'+lotId,SK:'META',lotId,product:'Prueba E2E',farm:'Laboratorio',route:'Local',carrier:'Demo',customer:'Demo',minC:2,maxC:8,sensorIds:sensors,GSI1PK:'LOTS',GSI1SK:lotId});
 await boot();const outageStart=Date.now();log('api_offline',{representedSeconds:3600,mode:summary.mode});
 for(let tick=0;tick<120;tick++){
  if(real)await sleep(Math.max(0,outageStart+tick*30000-Date.now()));
  for(const input of expected.slice(tick*12,(tick+1)*12))await post(input);
  if(tick===59){await kill('SIGKILL');log('gateway_sigkill',{enqueued:720});await boot();const health=await(await fetch(gatewayUrl+'/health')).json();assert.equal(health.queue.pending,720);assert.equal(health.queue.sent,0);summary.persistedAfterCrash=health.queue;}
 }
 await Promise.all(Array.from({length:8},()=>post(expected[0])));
 await waitUntil(async()=>proxyFailures>0);
 if(real)await sleep(Math.max(0,outageStart+3600000-Date.now()));
 summary.actualOutageSeconds=(Date.now()-outageStart)/1000;
 summary.beforeRecovery=await(await fetch(gatewayUrl+'/health')).json();assert.equal(summary.beforeRecovery.queue.pending,expected.length);assert.equal(summary.beforeRecovery.queue.sent,0);
 await kill('SIGTERM');
 const pendingBackup=join(work,'pending-backup');await createBackup(pendingBackup,queuePath);await verifyBackup(pendingBackup);
 const pendingDB=new DatabaseSync(join(pendingBackup,'gateway.sqlite'),{readOnly:true});assert.equal(pendingDB.prepare("SELECT COUNT(*) AS n FROM queue WHERE state='pending'").get()!.n,expected.length);pendingDB.close();
 summary.pendingBackupVerified=true;queuePath=join(work,'pending-recovered.sqlite');await copyFile(join(pendingBackup,'gateway.sqlite'),queuePath);assert.deepEqual(await readFile(queuePath),await readFile(join(pendingBackup,'gateway.sqlite')));summary.replayedFromRestoredPendingQueue=true;await boot();
 api=buildApp({log:eventLog(join(dir,'api.jsonl'))});await api.listen({host:'127.0.0.1',port:0});apiPort=(api.server.address() as import('node:net').AddressInfo).port;
 summary.actualOutageSeconds=(Date.now()-outageStart)/1000;
 const recoveryStart=Date.now();log('api_restored',{port:apiPort});
 await waitUntil(async()=>{const q=(await(await fetch(gatewayUrl+'/health')).json()).queue;return q.pending===0&&q.sent===expected.length;},300000);
 summary.recoverySeconds=(Date.now()-recoveryStart)/1000;summary.afterRecovery=await(await fetch(gatewayUrl+'/health')).json();assert.equal(summary.afterRecovery.queue.quarantined,0);
 const from=new Date(base-1).toISOString(),to=new Date(base+3600000).toISOString();
 const found:any[]=[];let cursor:string|undefined;
 do{const page=await readings(lotId,from,to,500,cursor);found.push(...page.items);cursor=page.cursor;}while(cursor);
 assert.equal(found.length,expected.length);assert.equal(new Set(found.map(r=>r.readingId)).size,expected.length);
 const actual=new Map(found.map(r=>[r.readingId,r]));
 for(const input of expected){const r=actual.get(input.readingId);assert.ok(r);assert.equal(sha256(readingSchema.parse(Object.fromEntries(Object.keys(input).map(k=>[k,r[k]])))),sha256(input));const marker=await get(tables.ops,'READING#'+lotId+'#'+input.readingId,'META');assert.equal(marker?.requestHash,sha256(input));}
 const proof=await integrity(lotId,from,to);assert.equal(proof.valid,true,JSON.stringify(proof));assert.equal(proof.checked,expected.length);assert.equal(dropped,1);assert.ok(replayed>=1);
 const duplicates=await Promise.all(Array.from({length:8},()=>fetch(`http://127.0.0.1:${apiPort}/api/v1/readings`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':expected[0].readingId},body:JSON.stringify(expected[0])}).then(async r=>({status:r.status,body:await r.json()}))));
 assert.ok(duplicates.every(r=>r.status===200&&r.body.replayed));
 const conflict=await fetch(`http://127.0.0.1:${apiPort}/api/v1/readings`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':expected[0].readingId},body:JSON.stringify({...expected[0],temperatureC:0})});assert.equal(conflict.status,409);await conflict.text();
 await api.close();api=undefined;await kill('SIGTERM');
 const q=new DatabaseSync(queuePath,{readOnly:true});summary.queueAttempts=q.prepare('SELECT SUM(attempts) AS failures,MAX(attempts) AS maximum FROM queue').get();q.close();
 summary.database={count:found.length,uniqueIds:actual.size,lost:0,duplicates:0,allPayloadHashesMatch:true,proof};summary.network={proxyFailures,acknowledgementsDropped:dropped,firstDroppedId,replayed,upstreamCommitted,concurrentDuplicates:duplicates.length,conflictStatus:conflict.status};
 const backupDir=join(work,'backup');summary.backup=await createBackup(backupDir,queuePath);await verifyBackup(backupDir);
 summary.restore=await restoreBackup(backupDir,'RESTORE_'+runId.replace(/[^a-zA-Z0-9_]/g,'_'),join(work,'restored-gateway.sqlite'));
 // Verify replay against restored idempotency state through the actual API code.
 const original=process.env.TABLE_PREFIX;
 const restoreCheck=spawn(process.execPath,['--import','tsx','tools/verify-restored.ts',backupDir,lotId,from,to],{env:{...process.env,TABLE_PREFIX:(Object.values(summary.restore.tables) as string[])[0].slice(0,-4)},stdio:['ignore','pipe','pipe']});
 let checkText='',checkError='';restoreCheck.stdout!.on('data',c=>checkText+=c);restoreCheck.stderr!.on('data',c=>checkError+=c);
 const [checkExit]=await once(restoreCheck,'exit');assert.equal(checkExit,0,checkError);summary.restoredIntegrity=JSON.parse(checkText);process.env.TABLE_PREFIX=original;
 // Corrupt a copy; verify must reject before restoring anything.
 const {cp}=await import('node:fs/promises');const corrupt=join(work,'corrupt-backup');await cp(backupDir,corrupt,{recursive:true});await writeFile(join(corrupt,'telemetry.json'),'[]\n');await assert.rejects(()=>verifyBackup(corrupt),/checksum/);summary.corruptionRejected=true;
 summary.expectedPayloadSetHash=sha256(expected);summary.actualPayloadSetHash=sha256(expected.map(input=>readingSchema.parse(Object.fromEntries(Object.keys(input).map(k=>[k,actual.get(input.readingId)[k]])))));
 summary.backupDirectory=backupDir;summary.finishedAt=new Date().toISOString();summary.wallSeconds=(Date.now()-started)/1000;summary.passed=true;
 await writeFile(join(dir,'result.json'),JSON.stringify(summary,null,2)+'\n');await writeFile('evidence/gateway-e2e/latest.json',JSON.stringify({directory:dir,result:summary},null,2)+'\n');
 await writeFile(join(dir,'report.md'),`# Prueba local del gateway FríoTrack\n\nResultado: PASÓ. Modo: ${summary.mode}. Hora representada: 3600 segundos. Caída real: ${summary.actualOutageSeconds} segundos. Duración total: ${summary.wallSeconds} segundos.\n\n${expected.length} lecturas de ${sensors.length} sensores, cada 30 segundos durante una hora simulada. 720 lecturas sobrevivieron a SIGKILL. Recuperación: ${summary.recoverySeconds} segundos. Lecturas verificadas en DynamoDB Local: ${found.length}; perdidas: 0; duplicadas: 0. Todos los contenidos coinciden con sus hashes esperados.\n\nSe perdió una respuesta después del commit y se observó replay. Ocho reenvíos concurrentes devolvieron replay; el contenido conflictivo devolvió 409. La recuperación usa una cola pendiente restaurada desde backup. Restauración final a tablas nuevas y SQLite nuevo verificada por contenido; backup corrupto rechazado.\n\nLos archivos JSONL y result.json contienen la evidencia técnica. Datos y respaldos: ${work}.\n\nNo prueba una hora de espera real en modo acelerado, 4500 sensores, rendimiento AWS, recuperación regional, independencia del respaldo ni protección contra administrador local.\n`);
 console.log(JSON.stringify({passed:true,directory:dir,readings:found.length,recoverySeconds:summary.recoverySeconds,actualOutageSeconds:summary.actualOutageSeconds,wallSeconds:summary.wallSeconds},null,2));
}catch(error){summary.passed=false;summary.error=(error as Error).stack;await writeFile(join(dir,'result.json'),JSON.stringify(summary,null,2));console.error(error);process.exitCode=1;}
finally{await api?.close();await kill('SIGTERM');proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));}
