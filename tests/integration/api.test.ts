import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../apps/api/src/app.ts';
import { initialize, put, tables, db } from '../../packages/dynamodb/client.ts';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { bucketKeys } from '../../packages/domain/index.ts';

const lotId='TEST-'+randomUUID();
const sensorId='S-01';
const at=new Date().toISOString();
const reading={readingId:'r1',lotId,sensorId,observedAt:at,temperatureC:12,humidityPct:80,batteryPct:90,doorOpen:false,latitude:4.7,longitude:-74.1};
const app=buildApp();
before(async()=>{await initialize(); await put(tables.core,{PK:'LOT#'+lotId,SK:'META',lotId,product:'Rosas',farm:'Prueba',route:'Chía - El Dorado',carrier:'Demo',customer:'Demo',minC:2,maxC:8,sensorIds:[sensorId],GSI1PK:'LOTS',GSI1SK:lotId});});
after(async()=>app.close());
test('concurrent duplicate ingestion produces one immutable reading and alarm',async()=>{
  const responses=await Promise.all(Array.from({length:8},()=>app.inject({method:'POST',url:'/api/v1/readings',headers:{'idempotency-key':'k1-'+lotId},payload:reading})));
  assert.ok(responses.every(r=>[200,201].includes(r.statusCode)),responses.map(r=>r.body).join('\n'));
  const range=`?from=${encodeURIComponent(at)}&to=${encodeURIComponent(at)}`;
  const list=await app.inject('/api/v1/lots/'+lotId+'/readings'+range);
  assert.equal(list.json().items.length,1);
  const alarms=await app.inject('/api/v1/alarms?lotId='+lotId);
  assert.equal(alarms.json().items.length,1);
  const proof=await app.inject('/api/v1/lots/'+lotId+'/integrity'+range);
  assert.equal(proof.json().valid,true,proof.body);
});
test('reusing an idempotency key with different content fails',async()=>{
 const r=await app.inject({method:'POST',url:'/api/v1/readings',headers:{'idempotency-key':'k1-'+lotId},payload:{...reading,temperatureC:0}});
 assert.equal(r.statusCode,409);
});
test('out-of-order reading does not move latest sensor timestamp backwards',async()=>{
 const r=await app.inject({method:'POST',url:'/api/v1/readings',headers:{'idempotency-key':'k2-'+lotId},payload:{...reading,readingId:'r2',observedAt:new Date(Date.parse(at)-1000).toISOString()}});
 assert.equal(r.statusCode,201,r.body);
 const trace=await app.inject('/api/v1/lots/'+lotId+'/trace');
 assert.equal(trace.json().sensors[0].observedAt,at);
});
test('alarm optimistic version rejects lost updates',async()=>{
 const alarms=(await app.inject('/api/v1/alarms?lotId='+lotId)).json().items;
 const url='/api/v1/alarms/'+alarms[0].alarmId;
 assert.equal((await app.inject({method:'PATCH',url,payload:{status:'ACKNOWLEDGED',version:1}})).statusCode,200);
 assert.equal((await app.inject({method:'PATCH',url,payload:{status:'CLOSED',version:1}})).statusCode,409);
});
test('pagination returns each reading once and filters expired items before TTL deletion',async()=>{
 const from=new Date(Date.parse(at)-2000).toISOString();
 const query=`?from=${encodeURIComponent(from)}&to=${encodeURIComponent(at)}&limit=1`;
 const first=(await app.inject(`/api/v1/lots/${lotId}/readings${query}`)).json();
 assert.equal(first.items.length,1);assert.ok(first.cursor);
 const second=(await app.inject(`/api/v1/lots/${lotId}/readings${query}&cursor=${encodeURIComponent(first.cursor)}`)).json();
 assert.equal(second.items.length,1);assert.notEqual(first.items[0].readingId,second.items[0].readingId);assert.equal(second.cursor,undefined);
 const older={...reading,readingId:'r2',observedAt:new Date(Date.parse(at)-1000).toISOString()};
 await db.send(new UpdateCommand({TableName:tables.telemetry,Key:bucketKeys(older),UpdateExpression:'SET expiresAt = :v',ExpressionAttributeValues:{':v':1}}));
 const filtered=(await app.inject(`/api/v1/lots/${lotId}/readings${query}`)).json();
 assert.equal(filtered.items[0].readingId,'r1');assert.equal(filtered.cursor,undefined);
});
test('integrity check detects direct database tampering',async()=>{
 await db.send(new UpdateCommand({TableName:tables.telemetry,Key:bucketKeys(reading),UpdateExpression:'SET temperatureC = :v',ExpressionAttributeValues:{':v':0}}));
 const from=new Date(Date.parse(at)-2000).toISOString();
 const proof=await app.inject(`/api/v1/lots/${lotId}/integrity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(at)}`);
 assert.equal(proof.json().valid,false,proof.body);
});
test('bad sensor values and malformed cursors return client errors',async()=>{
 assert.equal((await app.inject({method:'POST',url:'/api/v1/readings',headers:{'idempotency-key':'bad'},payload:{...reading,humidityPct:101}})).statusCode,400);
 assert.equal((await app.inject('/api/v1/lots/'+lotId+'/readings?cursor=evil')).statusCode,400);
});
test('a failed transaction leaves no partial reading, marker or chain update',async()=>{
 const {sha256}=await import('../../packages/domain/index.ts');
 const {get}=await import('../../packages/dynamodb/client.ts');
 const candidate={...reading,readingId:'atomic-rollback',sensorId:'S-01',observedAt:new Date(Date.parse(at)-5000).toISOString()};
 const alarmId=sha256({lotId,readingId:candidate.readingId}).slice(0,32);
 // Force the alarm conditional Put to fail, after the transaction also proposes a reading and markers.
 await put(tables.core,{PK:'ALARM#'+alarmId,SK:'META',sentinel:true});
 const headKey=`CHAIN#${lotId}#${candidate.observedAt.slice(0,10)}#S-01`;
 const before=await get(tables.ops,headKey,'HEAD');
 const response=await app.inject({method:'POST',url:'/api/v1/readings',headers:{'idempotency-key':'atomic-'+lotId},payload:candidate});
 assert.equal(response.statusCode,503,response.body);
 const keys=bucketKeys(candidate);assert.equal(await get(tables.telemetry,keys.PK,keys.SK),undefined);
 assert.equal(await get(tables.ops,'READING#'+lotId+'#'+candidate.readingId,'META'),undefined);
 assert.equal(await get(tables.ops,'IDEMP#'+sha256({lotId,key:'atomic-'+lotId}),'META'),undefined);
 assert.deepEqual(await get(tables.ops,headKey,'HEAD'),before);
});
