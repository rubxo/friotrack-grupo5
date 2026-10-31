import {mkdir,readFile,writeFile,rename,rm,copyFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {DescribeTableCommand} from '@aws-sdk/client-dynamodb';
import {ScanCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import {db,raw,tables,initialize} from '../dynamodb/client.ts';
import {canonical} from '../domain/index.ts';
import {maintenanceLease} from './lease.ts';
import {eventLog} from './log.ts';
const roles=['core','telemetry','ops'] as const;
const digest=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
export async function tableRows(TableName:string){
 const rows:Record<string,any>[]=[];let key:Record<string,any>|undefined;
 do{const page=await db.send(new ScanCommand({TableName,ConsistentRead:true,ExclusiveStartKey:key}));rows.push(...page.Items??[]);key=page.LastEvaluatedKey;}while(key);
 return rows.sort((a,b)=>canonical([a.PK,a.SK]).localeCompare(canonical([b.PK,b.SK])));
}
export async function createBackup(destination:string,queuePath='.local/gateway.sqlite',source=tables){
 const release=maintenanceLease(),log=eventLog('.local/logs/backup.jsonl');
 const dir=resolve(destination),temp=dir+'.partial-'+randomUUID();
 try{
  await mkdir(dirname(dir),{recursive:true,mode:0o700});await mkdir(temp,{mode:0o700});
  const files:Record<string,{sha256:string;bytes:number;rows?:number}>={};
  const manifest={version:1,kind:'local-logical-backup',startedAt:new Date().toISOString(),completedAt:'',source,files,limitations:'Writers stopped using local leases. Local copies only; no WORM, encryption, offsite or AWS PITR. External writers bypassing this repository must also be stopped.'};
  for(const role of roles){const rows=await tableRows(source[role]);const content=canonical(rows)+'\n';const file=role+'.json';await writeFile(join(temp,file),content,{mode:0o600});files[file]={sha256:digest(content),bytes:Buffer.byteLength(content),rows:rows.length};}
  const queue=new DatabaseSync(queuePath,{readOnly:true});
  try{const check=queue.prepare('PRAGMA integrity_check').get();if(Object.values(check??{})[0]!=='ok')throw new Error('SQLite integrity check failed');await backup(queue,join(temp,'gateway.sqlite'));}finally{queue.close();}
  const queueBytes=await readFile(join(temp,'gateway.sqlite'));files['gateway.sqlite']={sha256:digest(queueBytes),bytes:queueBytes.length};
  // A second complete read also catches accidental uncoordinated source mutations.
  for(const role of roles)if(digest(canonical(await tableRows(source[role]))+'\n')!==files[role+'.json'].sha256)throw new Error('Source changed during backup; stop every writer.');
  manifest.completedAt=new Date().toISOString();await writeFile(join(temp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  // Never overwrite an existing backup, even an empty directory.
  await mkdir(dir,{mode:0o700});
  try{for(const file of [...Object.keys(files),'manifest.json'])await rename(join(temp,file),join(dir,file));await rm(temp,{recursive:true});}catch(e){await rm(dir,{recursive:true,force:true});throw e;}
  log('backup_completed',{directory:dir,counts:Object.fromEntries(roles.map(role=>[role,files[role+'.json'].rows]))});return manifest;
 }catch(e){await rm(temp,{recursive:true,force:true});log('backup_failed');throw e;}finally{release();}
}
export async function verifyBackup(directory:string){
 const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 if(manifest.version!==1||manifest.kind!=='local-logical-backup')throw new Error('Unsupported backup manifest');
 const required=['core.json','telemetry.json','ops.json','gateway.sqlite'];
 if(JSON.stringify(Object.keys(manifest.files).sort())!==JSON.stringify(required.sort()))throw new Error('Invalid backup files');
 const rows:Record<string,Record<string,any>[]>={};
 for(const file of required){const bytes=await readFile(join(directory,file));const expected=manifest.files[file];if(bytes.length!==expected.bytes||digest(bytes)!==expected.sha256)throw new Error('Backup checksum mismatch: '+file);
  if(file.endsWith('.json')){const items=JSON.parse(bytes.toString());if(!Array.isArray(items)||items.length!==expected.rows||items.some(i=>typeof i.PK!=='string'||typeof i.SK!=='string'))throw new Error('Invalid records: '+file);rows[file]=items;}}
 const queue=new DatabaseSync(join(directory,'gateway.sqlite'),{readOnly:true});try{if(Object.values(queue.prepare('PRAGMA integrity_check').get()??{})[0]!=='ok')throw new Error('Invalid SQLite backup');queue.prepare('SELECT COUNT(*) FROM queue').get();}finally{queue.close();}
 return {manifest,rows};
}
export async function restoreBackup(directory:string,prefix:string,queueDestination:string){
 const release=maintenanceLease(),log=eventLog('.local/logs/backup.jsonl');
 try{
  if(!/^RESTORE_[A-Za-z0-9_-]{1,80}$/.test(prefix))throw new Error('Use a fresh RESTORE_ prefix, never the active tables.');
  const {manifest,rows}=await verifyBackup(directory);
  const target={core:prefix+'Core',telemetry:prefix+'TelemetryHot',ops:prefix+'Ops'};
  for(const TableName of Object.values(target)){
   try{await raw.send(new DescribeTableCommand({TableName}));throw new Error('Restore target already exists: '+TableName);}catch(e){if((e as Error).name!=='ResourceNotFoundException')throw e;}
  }
  // Reserve the new SQLite destination before creating any tables. Refuse clobber.
  await mkdir(dirname(resolve(queueDestination)),{recursive:true,mode:0o700});
  await writeFile(queueDestination,'',{flag:'wx',mode:0o600});
  try{
   await initialize(target);
   for(const role of roles)for(const Item of rows[role+'.json'])await db.send(new PutCommand({TableName:target[role],Item,ConditionExpression:'attribute_not_exists(PK)'}));
   await copyFile(join(directory,'gateway.sqlite'),queueDestination);
   for(const role of roles){if(digest(canonical(await tableRows(target[role]))+'\n')!==manifest.files[role+'.json'].sha256)throw new Error('Restored table differs: '+role);}
   if(digest(await readFile(queueDestination))!==manifest.files['gateway.sqlite'].sha256)throw new Error('Restored queue differs');
   const result={verified:true,at:new Date().toISOString(),tables:target,queueDestination,counts:Object.fromEntries(roles.map(role=>[role,rows[role+'.json'].length]))};log('restore_verified',result);return result;
  }catch(e){log('restore_incomplete',{prefix});throw e;}
 }finally{release();}
}
