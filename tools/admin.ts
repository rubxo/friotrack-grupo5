import Fastify from 'fastify';
import {ListTablesCommand,DescribeTableCommand} from '@aws-sdk/client-dynamodb';
import {ScanCommand,QueryCommand} from '@aws-sdk/lib-dynamodb';
import {DatabaseSync} from 'node:sqlite';
import {readFile,open} from 'node:fs/promises';
import {z} from 'zod';
import {raw,db} from '../packages/dynamodb/client.ts';
import {encodeCursor,decodeCursor,sha256} from '../packages/domain/index.ts';
const app=Fastify({bodyLimit:16384});
// Dedicated read-only laboratory inspector; operational endpoints never scan tables.
app.setErrorHandler((err,req,reply)=>{const e=err as Error&{statusCode?:number};reply.code(e.statusCode??(err instanceof z.ZodError?400:503)).send({error:{message:e.message,requestId:req.id}});});
app.get('/admin/tables',async()=>{
 const names:string[]=[];let next:string|undefined;
 do{const p=await raw.send(new ListTablesCommand({ExclusiveStartTableName:next}));names.push(...p.TableNames??[]);next=p.LastEvaluatedTableName;}while(next);
 return {environment:'DynamoDB Local',endpoint:process.env.DYNAMODB_ENDPOINT??'http://127.0.0.1:8000',readOnly:true,tables:await Promise.all(names.map(async name=>{const t=(await raw.send(new DescribeTableCommand({TableName:name}))).Table!;return {name,status:t.TableStatus,keySchema:t.KeySchema,indexes:t.GlobalSecondaryIndexes?.map(i=>i.IndexName)};}))};
});
app.get<{Params:{table:string};Querystring:{cursor?:string;pk?:string}}>('/admin/items/:table',async req=>{
 const TableName=z.string().regex(/^[a-zA-Z0-9_.-]{3,255}$/).parse(req.params.table);
 const pk=req.query.pk?z.string().max(2048).parse(req.query.pk):undefined,scope=sha256({TableName,pk:pk??null,type:'inspector'});
 const ExclusiveStartKey=req.query.cursor?JSON.parse(decodeCursor(req.query.cursor,scope).last):undefined;
 const page=pk?await db.send(new QueryCommand({TableName,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':pk},Limit:25,ConsistentRead:true,ExclusiveStartKey})):await db.send(new ScanCommand({TableName,Limit:25,ConsistentRead:true,ExclusiveStartKey}));
 return {items:page.Items??[],cursor:page.LastEvaluatedKey?encodeCursor({scope,last:JSON.stringify(page.LastEvaluatedKey)}):undefined,mode:pk?'Query por PK':'Scan de laboratorio (25 elementos por página)',snapshot:false};
});
app.get('/admin/queue',async()=>{
 let q:DatabaseSync;try{q=new DatabaseSync(process.env.GATEWAY_DB??'.local/gateway.sqlite',{readOnly:true});}catch{return {available:false,message:'Gateway aún sin iniciar. No se creó una cola vacía.'};}
 try{return {available:true,states:q.prepare('SELECT state,COUNT(*) AS count FROM queue GROUP BY state').all(),recent:q.prepare('SELECT id,lot,state,attempts,next_at,error FROM queue ORDER BY id DESC LIMIT 25').all(),pages:q.prepare('PRAGMA page_count').get(),pageSize:q.prepare('PRAGMA page_size').get()};}finally{q.close();}
});
app.get<{Querystring:{service?:string}}>('/admin/logs',async req=>{
 const service=z.enum(['api','gateway','backup']).parse(req.query.service??'gateway');let file;
 try{file=await open(`.local/logs/${service}.jsonl`,'r');}catch{return {service,events:[]};}
 try{const {size}=await file.stat();const start=Math.max(0,size-65536),buf=Buffer.alloc(size-start);await file.read(buf,0,buf.length,start);const lines=buf.toString().split('\n');if(start)lines.shift();return {service,events:lines.filter(Boolean).slice(-50).map(line=>JSON.parse(line)).reverse(),rotation:'5 MiB por archivo, 3 rotaciones'};}finally{await file.close();}
});
app.get('/admin/evidence',async()=>{try{return JSON.parse(await readFile('evidence/gateway-e2e/latest.json','utf8'));}catch{return {result:null};}});
await app.listen({host:'127.0.0.1',port:Number(process.env.ADMIN_PORT??3003)});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void app.close());
console.log('Inspector local de solo lectura: http://127.0.0.1:'+(process.env.ADMIN_PORT??3003));
