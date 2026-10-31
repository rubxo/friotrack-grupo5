import Fastify from 'fastify';
import {ZodError} from 'zod';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DurableQueue,forwardBatch} from './index.ts';
import {eventLog,type EventLog} from '../operations/log.ts';
import {writerLease} from '../operations/lease.ts';
export function buildGateway(options:{path?:string;target?:string;intervalMs?:number;capacity?:number;log?:EventLog;send?:(item:import('./index.ts').QueueItem)=>Promise<number>}={}){
 const path=options.path??process.env.GATEWAY_DB??'.local/gateway.sqlite';
 const target=options.target??process.env.API_URL??'http://127.0.0.1:3001';
 if(!['localhost','127.0.0.1'].includes(new URL(target).hostname))throw new Error('Solo destino local autorizado');
 const release=writerLease('gateway');
 let queue:DurableQueue;
 try{mkdirSync(dirname(path),{recursive:true,mode:0o700});queue=new DurableQueue(path,options.capacity??2400000);}catch(e){release();throw e;}
 const log=options.log??eventLog(process.env.GATEWAY_LOG??'.local/logs/gateway.jsonl');
 const app=Fastify({bodyLimit:16384});
 let timer:NodeJS.Timeout|undefined,forwarding:Promise<number>|undefined;
 app.get('/health',async()=>({status:'ok',kind:'persistent-local-gateway',queue:queue.stats()}));
 app.post('/readings',async(req,reply)=>{
  try{const key=req.headers['idempotency-key'];if(typeof key!=='string')return reply.code(400).send({error:'Idempotency-Key requerido'});
   const result=queue.enqueue(req.body,key);log('queue_accepted',{requestId:req.id,duplicate:result.duplicate});return reply.code(202).send({accepted:true,...result});}
  catch(e){const message=(e as Error).message;const status=message.includes('conflict')?409:e instanceof ZodError||message==='Invalid idempotency key'?400:503;log('queue_rejected',{requestId:req.id,status});return reply.code(status).send({error:message});}
 });
 const send=options.send??(async item=>{const response=await fetch(target+'/api/v1/readings',{method:'POST',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json','idempotency-key':item.key},body:JSON.stringify(item.body)});await response.text();return response.status;});
 async function drain(){if(forwarding)return forwarding;forwarding=forwardBatch(queue,send,Date.now(),log);try{return await forwarding;}finally{forwarding=undefined;}}
 app.addHook('onReady',async()=>{if((options.intervalMs??Number(process.env.GATEWAY_INTERVAL_MS??1000))>0)timer=setInterval(()=>void drain().catch(()=>log('drain_failed')),options.intervalMs??Number(process.env.GATEWAY_INTERVAL_MS??1000));log('gateway_started');});
 app.addHook('onClose',async()=>{if(timer)clearInterval(timer);try{await forwarding;}finally{queue.close();release();log('gateway_stopped');}});
 return {app,queue,drain};
}
