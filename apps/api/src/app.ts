import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError, z } from 'zod';
import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { raw,tables } from '../../../packages/dynamodb/client.ts';
import { ApiError } from '../../../packages/domain/index.ts';
import {eventLog} from '../../../packages/operations/log.ts';
import {writerLease} from '../../../packages/operations/lease.ts';
import * as service from './service.ts';

export function buildApp(options:{log?:import('../../../packages/operations/log.ts').EventLog}={}) {
 const app=Fastify({logger:false,bodyLimit:16384});
 const log=options.log??eventLog('.local/logs/api.jsonl');
 let release:(()=>void)|undefined;
 app.addHook('onReady',async()=>{release=writerLease('api');log('api_started');});
 app.addHook('onClose',async()=>{release?.();log('api_stopped');});
 app.addHook('onResponse',async(req,reply)=>{log('http_response',{requestId:req.id,method:req.method,route:req.routeOptions.url??'not_found',status:reply.statusCode,elapsedMs:Math.round(reply.elapsedTime)});});
 app.register(cors,{origin:['http://127.0.0.1:5173','http://localhost:5173']});
 app.setErrorHandler((err,request,reply)=>{
  const error=err as Error & {statusCode?:number;code?:string};
  const status=err instanceof ZodError?400:error.statusCode??503;
  reply.code(status).send({error:{code:err instanceof ZodError?'VALIDATION_ERROR':error.code??'SERVICE_UNAVAILABLE',message:status>=500?'Servicio local no disponible. Compruebe DynamoDB y vuelva a intentar.':error.message,requestId:request.id}});
 });
 const id=(v:unknown)=>z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).parse(v);
 const range=(query:any)=>({from:query.from??new Date(Date.now()-86400000).toISOString(),to:query.to??new Date().toISOString(),limit:z.coerce.number().int().min(1).max(500).parse(query.limit??100),cursor:query.cursor});
 app.get('/api/v1/health',async()=>{await raw.send(new DescribeTableCommand({TableName:tables.core}));return {status:'ok',database:'DynamoDB Local',production:false};});
 app.get('/api/v1/lots',service.lots);
 app.post('/api/v1/readings',async(req,reply)=>{const key=z.string().min(1).max(128).parse(req.headers['idempotency-key']);const result=await service.ingest(req.body,key);log('reading_committed',{requestId:req.id,replayed:result.replayed});reply.code(result.replayed?200:201);return result;});
 app.get<{Params:{lotId:string};Querystring:Record<string,string>}>('/api/v1/lots/:lotId/readings',async req=>{const r=range(req.query);return service.readings(id(req.params.lotId),r.from,r.to,r.limit,r.cursor);});
 app.get<{Params:{lotId:string}}>('/api/v1/lots/:lotId/trace',req=>service.trace(id(req.params.lotId)));
 app.get<{Params:{lotId:string};Querystring:Record<string,string>}>('/api/v1/lots/:lotId/integrity',req=>{const r=range(req.query);return service.integrity(id(req.params.lotId),r.from,r.to);});
 app.get<{Querystring:Record<string,string>}>('/api/v1/alarms',req=>{const r=range(req.query);return service.alarms(id(req.query.lotId),req.query.status?z.enum(['OPEN','ACKNOWLEDGED','CLOSED']).parse(req.query.status):undefined,r.limit,r.cursor);});
 app.patch<{Params:{alarmId:string}}>('/api/v1/alarms/:alarmId',req=>{const body=z.object({status:z.enum(['ACKNOWLEDGED','CLOSED']),version:z.number().int().min(1)}).strict().parse(req.body);return service.updateAlarm(id(req.params.alarmId),body.status,body.version);});
 app.get('/api/v1/dashboard',async()=>{
  const lots=await service.lots();
  const rows=await Promise.all(lots.filter(l=>!l.lotId.startsWith('TEST-')).map(async l=>({...(await service.trace(l.lotId)),alarms:(await service.alarms(l.lotId)).items})));
  return {lots:rows,updatedAt:new Date().toISOString(),environment:'Entorno demostrativo con DynamoDB Local'};
 });
 app.setNotFoundHandler((_req,reply)=>reply.code(404).send({error:{code:'NOT_FOUND',message:'Ruta no encontrada.'}}));
 return app;
}
