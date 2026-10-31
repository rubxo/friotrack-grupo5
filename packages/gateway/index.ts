import {DatabaseSync} from 'node:sqlite';
import type {EventLog} from '../operations/log.ts';
import {readingSchema,sha256,type ReadingInput} from '../domain/index.ts';
export type QueueItem={id:number;key:string;body:ReadingInput;attempts:number};
/** Single local writer; SQLite is a spool, not the assigned system of record. */
export class DurableQueue {
 private db:DatabaseSync;
 constructor(path:string,private capacity=2400000){
  if(!Number.isSafeInteger(capacity)||capacity<1)throw new Error('Invalid capacity');
  this.db=new DatabaseSync(path,{timeout:5000});
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS queue(id INTEGER PRIMARY KEY,lot TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at INTEGER NOT NULL DEFAULT 0,error TEXT,created_at INTEGER NOT NULL,UNIQUE(lot,key));
   CREATE INDEX IF NOT EXISTS queue_ready ON queue(state,next_at,id);`);
 }
 enqueue(body:unknown,key:string){
  const input=readingSchema.parse(body);if(!key||key.length>128)throw new Error('Invalid idempotency key');
  const hash=sha256(input);
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const existing=this.db.prepare('SELECT hash FROM queue WHERE lot=? AND key=?').get(input.lotId,key);
   if(existing){if(existing.hash!==hash)throw new Error('Idempotency conflict');this.db.exec('COMMIT');return {duplicate:true};}
   const count=this.db.prepare("SELECT COUNT(*) AS n FROM queue WHERE state!='sent'").get()!;
   if(Number(count.n)>=this.capacity)throw new Error('Queue full: backpressure; no data deleted');
   this.db.prepare('INSERT INTO queue(lot,key,hash,body,created_at) VALUES(?,?,?,?,?)').run(input.lotId,key,hash,JSON.stringify(input),Date.now());
   this.db.exec('COMMIT');return {duplicate:false};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 ready(now=Date.now(),limit=50):QueueItem[]{return this.db.prepare("SELECT id,key,body,attempts FROM queue WHERE state='pending' AND next_at<=? ORDER BY id LIMIT ?").all(now,limit).map(r=>({id:Number(r.id),key:String(r.key),body:JSON.parse(String(r.body)),attempts:Number(r.attempts)}));}
 acknowledge(id:number){this.db.prepare("UPDATE queue SET state='sent',error=NULL WHERE id=? AND state='pending'").run(id);}
 fail(item:QueueItem,reason:string,permanent:boolean,now:number){
  this.db.prepare('UPDATE queue SET state=?,attempts=attempts+1,next_at=?,error=? WHERE id=?').run(permanent?'quarantined':'pending',now+Math.min(60000,1000*2**Math.min(item.attempts,6)),reason.slice(0,500),item.id);
 }
 stats(){const out={pending:0,sent:0,quarantined:0,capacity:this.capacity};for(const r of this.db.prepare('SELECT state,COUNT(*) AS n FROM queue GROUP BY state').all())out[r.state as 'pending'|'sent'|'quarantined']=Number(r.n);return out;}
 inspect(limit=25){return this.db.prepare('SELECT id,lot,state,attempts,next_at,error,created_at FROM queue ORDER BY id DESC LIMIT ?').all(limit);}
 close(){this.db.close();}
}
export async function forwardBatch(queue:DurableQueue,send:(item:QueueItem)=>Promise<number>,now=Date.now(),log:EventLog=()=>{}){
 let delivered=0;
 for(const item of queue.ready(now)){
  try{const status=await send(item);if([200,201].includes(status)){queue.acknowledge(item.id);delivered++;log('queue_delivered',{queueId:item.id,attempt:item.attempts+1,status});}
   else {const permanent=status>=400&&status<500&&![408,425,429].includes(status);queue.fail(item,`HTTP ${status}`,permanent,now);log(permanent?'queue_quarantined':'queue_retry',{queueId:item.id,attempt:item.attempts+1,status});}
  }catch(e){queue.fail(item,(e as Error).message,false,now);log('queue_retry',{queueId:item.id,attempt:item.attempts+1,reason:'network_or_timeout'});}
 }
 return delivered;
}
