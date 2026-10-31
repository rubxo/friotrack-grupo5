import { randomUUID } from 'node:crypto';
import { TransactWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, tables, get, queryAll } from '../../../packages/dynamodb/client.ts';
import { ApiError, bucketKeys, daysBetween, decodeCursor, encodeCursor, hashReading, readingSchema, sha256, type ReadingInput, type SensorReading, type Lot, type Alarm } from '../../../packages/domain/index.ts';

const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const clean=(item:Record<string,any>)=>Object.fromEntries(Object.entries(item).filter(([k])=>!['PK','SK','GSI1PK','GSI1SK'].includes(k)));
export async function lot(lotId:string):Promise<Lot> {
 const row=await get(tables.core,'LOT#'+lotId,'META');
 if(!row) throw new ApiError(404,'LOT_NOT_FOUND','Lote no encontrado.');
 return clean(row) as Lot;
}
export async function ingest(body:unknown, key:string) {
 const input=readingSchema.parse(body);
 if(Date.parse(input.observedAt)>Date.now()+300000 || Date.parse(input.observedAt)<Date.now()-30*86400000) throw new ApiError(400,'TIMESTAMP_OUTSIDE_HOT_WINDOW','La lectura debe pertenecer a los últimos 30 días y no superar 5 minutos en el futuro.');
 const meta=await lot(input.lotId);
 if(!meta.sensorIds.includes(input.sensorId)) throw new ApiError(400,'UNKNOWN_SENSOR','El sensor no pertenece al lote.');
 const requestHash=sha256(input), idKey='IDEMP#'+sha256({lotId:input.lotId,key});
 const uniqueKey='READING#'+input.lotId+'#'+input.readingId;
 const headKey=`CHAIN#${input.lotId}#${input.observedAt.slice(0,10)}#${input.sensorId}`;
 for(let attempt=0;attempt<16;attempt++) {
  const existing=await get(tables.ops,idKey,'META');
  if(existing) {
   if(existing.requestHash!==requestHash) throw new ApiError(409,'IDEMPOTENCY_CONFLICT','Esta clave ya se usó con otra lectura.');
   return {reading:existing.response,replayed:true};
  }
  const duplicate=await get(tables.ops,uniqueKey,'META');
  if(duplicate) {
   if(duplicate.requestHash!==requestHash) throw new ApiError(409,'READING_CONFLICT','El identificador de lectura ya tiene otro contenido.');
   return {reading:duplicate.response,replayed:true};
  }
  const [head,current]=await Promise.all([get(tables.ops,headKey,'HEAD'),get(tables.core,'LOT#'+input.lotId,'SENSOR#'+input.sensorId)]);
  const previousHash=head?.hash??'GENESIS';
  const reading:SensorReading={...input,receivedAt:new Date().toISOString(),previousHash,payloadHash:hashReading(input,previousHash),sequence:(head?.sequence??0)+1,expiresAt:Math.floor(Date.parse(input.observedAt)/1000)+30*86400};
  const noExists='attribute_not_exists(PK)';
  const Put=(TableName:string,Item:Record<string,unknown>,ConditionExpression=noExists,ExpressionAttributeValues?:Record<string,unknown>)=>({Put:{TableName,Item,ConditionExpression,ExpressionAttributeValues}});
  const actions:any[]=[
   Put(tables.telemetry,{...bucketKeys(input),...reading}),
   Put(tables.ops,{PK:idKey,SK:'META',requestHash,response:reading,expiresAt:reading.expiresAt}),
   Put(tables.ops,{PK:uniqueKey,SK:'META',requestHash,response:reading,expiresAt:reading.expiresAt}),
   Put(tables.ops,{PK:headKey,SK:'HEAD',hash:reading.payloadHash,sequence:reading.sequence,lotId:input.lotId,day:input.observedAt.slice(0,10),sensorId:input.sensorId,GSI1PK:'CHAINS#'+input.lotId,GSI1SK:headKey},head?'#sequence = :old':noExists,head?{':old':head.sequence}:undefined),
  ];
  if(head) actions[3].Put.ExpressionAttributeNames={'#sequence':'sequence'};
  if(!current || input.observedAt>current.observedAt) actions.push(Put(tables.core,{PK:'LOT#'+input.lotId,SK:'SENSOR#'+input.sensorId,...reading},current?'observedAt = :old':noExists,current?{':old':current.observedAt}:undefined));
  if(input.temperatureC<meta.minC || input.temperatureC>meta.maxC) {
   const alarm:Alarm={alarmId:sha256({lotId:input.lotId,readingId:input.readingId}).slice(0,32),lotId:input.lotId,sensorId:input.sensorId,observedAt:input.observedAt,temperatureC:input.temperatureC,status:'OPEN',version:1};
   actions.push(Put(tables.core,{PK:'ALARM#'+alarm.alarmId,SK:'META',...alarm,GSI1PK:'ALARMS#'+input.lotId,GSI1SK:input.observedAt+'#'+alarm.alarmId}));
  }
  try { await db.send(new TransactWriteCommand({TransactItems:actions})); return {reading,replayed:false}; }
  catch(err) { if(!['TransactionCanceledException','TransactionConflictException','ProvisionedThroughputExceededException','ThrottlingException'].includes((err as Error).name)) throw err; await wait(Math.min(10*2**attempt,250)+Math.random()*30); }
 }
 throw new ApiError(503,'WRITE_BUSY','No se pudo confirmar la escritura. Reintente con la misma clave.');
}

export async function readings(lotId:string,from:string,to:string,limit=100,cursor?:string,includeExpired=false) {
 await lot(lotId);
 const days=daysBetween(from,to);
 const normalizedFrom=new Date(from).toISOString(), normalizedTo=new Date(to).toISOString();
 const scope=sha256({lotId,from:normalizedFrom,to:normalizedTo});
 const last=cursor?decodeCursor(cursor,scope).last:undefined;
 const rows:Record<string,any>[]=[];
 for(const day of days) {
  for(let shard=0;shard<4;shard++) {
   const PK=`LOT#${lotId}#DAY#${day}#SHARD#${shard}`;
   let next:Record<string,any>|undefined;
   let count=0;
   do {
    const page=await db.send(new QueryCommand({TableName:tables.telemetry,ConsistentRead:true,KeyConditionExpression:'PK = :pk AND SK BETWEEN :lo AND :hi',ExpressionAttributeValues:{':pk':PK,':lo':last&&last>'TS#'+normalizedFrom?last:'TS#'+normalizedFrom,':hi':'TS#'+normalizedTo+'#\uffff'},Limit:limit+1,ExclusiveStartKey:next}));
    const valid=(page.Items??[]).filter(i=>(!last||i.SK>last)&&(includeExpired||i.expiresAt>Math.floor(Date.now()/1000)));
    rows.push(...valid); count+=valid.length; next=page.LastEvaluatedKey;
   } while(next&&count<=limit);
  }
  if(rows.length>limit) break;
 }
 rows.sort((a,b)=>a.SK.localeCompare(b.SK));
 const selected=rows.slice(0,limit);
 return {items:selected.map(clean) as SensorReading[],cursor:rows.length>limit?encodeCursor({scope,last:selected.at(-1)!.SK}):undefined};
}
export async function trace(lotId:string) {
 const meta=await lot(lotId);
 const rows=await queryAll({TableName:tables.core,KeyConditionExpression:'PK = :pk',ExpressionAttributeValues:{':pk':'LOT#'+lotId},ConsistentRead:true});
 return {lot:meta,sensors:rows.filter(r=>r.SK.startsWith('SENSOR#')).map(clean),events:rows.filter(r=>r.SK.startsWith('TRACE#')).map(clean)};
}
export async function lots() {return (await queryAll({TableName:tables.core,IndexName:'GSI1',KeyConditionExpression:'GSI1PK = :pk',ExpressionAttributeValues:{':pk':'LOTS'}})).map(clean) as Lot[];}
export async function alarms(lotId:string,status?:string,limit=100,cursor?:string) {
 await lot(lotId);
 const scope=sha256({lotId,status,type:'alarms'});
 const last=cursor?decodeCursor(cursor,scope).last:undefined;
 const all=await queryAll({TableName:tables.core,IndexName:'GSI1',KeyConditionExpression:'GSI1PK = :pk',ExpressionAttributeValues:{':pk':'ALARMS#'+lotId}});
 const matching=all.filter(r=>(!status||r.status===status)&&(!last||r.GSI1SK>last)).sort((a,b)=>a.GSI1SK.localeCompare(b.GSI1SK));
 return {items:matching.slice(0,limit).map(clean),cursor:matching.length>limit?encodeCursor({scope,last:matching[limit-1].GSI1SK}):undefined};
}
export async function updateAlarm(alarmId:string,status:Alarm['status'],version:number) {
 const item=await get(tables.core,'ALARM#'+alarmId,'META');
 if(!item) throw new ApiError(404,'ALARM_NOT_FOUND','Alarma no encontrada.');
 if(item.version!==version || item.status==='CLOSED' || (item.status==='ACKNOWLEDGED'&&status!=='CLOSED') || status==='OPEN') throw new ApiError(409,'ALARM_CONFLICT','La versión o transición de la alarma ya no es válida.');
 const updated={...item,status,version:version+1};
 try {await db.send(new TransactWriteCommand({TransactItems:[{Put:{TableName:tables.core,Item:updated,ConditionExpression:'version = :v',ExpressionAttributeValues:{':v':version}}},{Put:{TableName:tables.ops,Item:{PK:'AUDIT#'+item.lotId,SK:new Date().toISOString()+'#'+randomUUID(),action:'ALARM_'+status,alarmId,from:item.status,to:status,actor:'local-demo'}}}]}));}
 catch(err){if((err as Error).name==='TransactionCanceledException')throw new ApiError(409,'ALARM_CONFLICT','Otra sesión actualizó la alarma.');throw err;}
 return clean(updated);
}
export async function integrity(lotId:string,from:string,to:string) {
 // Check complete UTC days, because the hash chains are per day and sensor, in ingestion order.
 const days=daysBetween(from,to);
 const fullFrom=days[0]+'T00:00:00.000Z',fullTo=days.at(-1)+'T23:59:59.999Z';
 let cursor:string|undefined, all:SensorReading[]=[];
 do {const p=await readings(lotId,fullFrom,fullTo,500,cursor,true);all.push(...p.items);cursor=p.cursor;}while(cursor);
 const groups=new Map<string,SensorReading[]>();
 for(const r of all){const key=`CHAIN#${lotId}#${r.observedAt.slice(0,10)}#${r.sensorId}`;groups.set(key,[...(groups.get(key)??[]),r]);}
 const knownHeads=await queryAll({TableName:tables.ops,IndexName:'GSI1',KeyConditionExpression:'GSI1PK = :pk',ExpressionAttributeValues:{':pk':'CHAINS#'+lotId}});
 for(const h of knownHeads)if(days.includes(h.day)&&!groups.has(h.PK))groups.set(h.PK,[]);
 const issues:string[]=[];
 for(const [key,group] of groups){group.sort((a,b)=>a.sequence-b.sequence);let previous='GENESIS',sequence=0;
  for(const r of group){const {receivedAt,payloadHash,previousHash,sequence:seq,expiresAt,...input}=r;if(previousHash!==previous||seq!==sequence+1||hashReading(input,previousHash)!==payloadHash)issues.push('Cadena alterada: '+r.readingId);previous=payloadHash;sequence=seq;}
  const head=await get(tables.ops,key,'HEAD');if(!head||head.hash!==previous||head.sequence!==sequence)issues.push('Cabeza o lectura ausente: '+key);
 }
 return {valid:issues.length===0,checked:all.length,chains:groups.size,issues,evidence:'Verificación local contra cabezas DynamoDB. npm run archive genera un archivo firmado local, no una copia independiente ni KMS/Object Lock. Verifique periodos cerrados sin ingestión concurrente.',from:fullFrom,to:fullTo};
}
