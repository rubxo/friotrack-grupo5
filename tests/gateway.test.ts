import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DurableQueue, forwardBatch} from '../packages/gateway/index.ts';
const sample={readingId:'r1',lotId:'LOT-1',sensorId:'S-1',observedAt:new Date().toISOString(),temperatureC:5,humidityPct:70,batteryPct:90,doorOpen:false,latitude:4.7,longitude:-74.1};
test('queue survives restart and rejects conflicting idempotency payload',async()=>{
 const file=join(await mkdtemp(join(tmpdir(),'friotrack-queue-')),'queue.db');
 let q=new DurableQueue(file,10);q.enqueue(sample,'key');q.close();
 q=new DurableQueue(file,10);assert.equal(q.stats().pending,1);assert.equal(q.enqueue(sample,'key').duplicate,true);
 assert.throws(()=>q.enqueue({...sample,temperatureC:9},'key'),/conflict/i);q.close();
});
test('disconnect preserves payload and replay acknowledges only after success',async()=>{
 const q=new DurableQueue(':memory:');q.enqueue(sample,'original-key');
 await forwardBatch(q,async()=>{throw new Error('offline');},0);
 assert.equal(q.stats().pending,1);assert.equal(q.stats().sent,0);
 let seen='';await forwardBatch(q,async(item)=>{seen=item.key;assert.deepEqual(item.body,sample);return 201;},100000);
 assert.equal(seen,'original-key');assert.equal(q.stats().pending,0);assert.equal(q.stats().sent,1);q.close();
});
test('permanent errors are quarantined, never silently discarded',async()=>{
 const q=new DurableQueue(':memory:');q.enqueue(sample,'bad-key');
 await forwardBatch(q,async()=>409,0);assert.equal(q.stats().quarantined,1);assert.equal(q.stats().sent,0);q.close();
});
test('queue backpressure refuses new data instead of deleting pending data',()=>{
 const q=new DurableQueue(':memory:',1);q.enqueue(sample,'one');
 assert.throws(()=>q.enqueue({...sample,readingId:'r2'},'two'),/full/i);assert.equal(q.stats().pending,1);q.close();
});
test('lost acknowledgement can safely replay the original key',async()=>{
 const q=new DurableQueue(':memory:');q.enqueue(sample,'retry-key');const seen=new Set<string>();
 await forwardBatch(q,async(item)=>{seen.add(item.key);throw new Error('response lost');},0);
 await forwardBatch(q,async(item)=>{assert.ok(seen.has(item.key));return 200;},100000);
 assert.equal(q.stats().sent,1);assert.equal(seen.size,1);q.close();
});
