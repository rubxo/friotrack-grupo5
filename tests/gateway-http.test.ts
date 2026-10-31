import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildGateway} from '../packages/gateway/app.ts';
test('gateway validates HTTP inputs, conflicts and backpressure without losing accepted data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'friotrack-http-'));
 const gateway=buildGateway({path:join(dir,'q.sqlite'),capacity:1,intervalMs:0,log:()=>{}});
 try{
  const body={readingId:'r1',lotId:'lot',sensorId:'s1',observedAt:new Date().toISOString(),temperatureC:5,humidityPct:70,batteryPct:90,doorOpen:false,latitude:0,longitude:0};
  assert.equal((await gateway.app.inject({method:'POST',url:'/readings',payload:body})).statusCode,400);
  const post=(payload:any,key='k1')=>gateway.app.inject({method:'POST',url:'/readings',headers:{'idempotency-key':key},payload});
  assert.equal((await post({...body,humidityPct:101})).statusCode,400);
  assert.equal((await post(body)).statusCode,202);
  const duplicate=await post(body);assert.equal(duplicate.statusCode,202);assert.equal(duplicate.json().duplicate,true);
  assert.equal((await post({...body,temperatureC:0})).statusCode,409);
  assert.equal((await post({...body,readingId:'r2'},'k2')).statusCode,503);
  assert.equal(gateway.queue.stats().pending,1);assert.equal(gateway.queue.stats().sent,0);
 }finally{await gateway.app.close();}
});
