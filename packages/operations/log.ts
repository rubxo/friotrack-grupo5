import {appendFileSync,existsSync,mkdirSync,renameSync,statSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
export type EventLog=(event:string,details?:Record<string,unknown>)=>void;
/** Bounded JSONL; callers pass metadata only, never reading bodies or headers. */
export function eventLog(file:string,maxBytes=5*1024*1024,keep=3):EventLog {
 mkdirSync(dirname(file),{recursive:true,mode:0o700});
 return (event,details={})=>{
  const line=JSON.stringify({...details,at:new Date().toISOString(),event})+'\n';
  try{
   if(existsSync(file)&&statSync(file).size+Buffer.byteLength(line)>maxBytes){
    if(existsSync(file+'.'+keep))unlinkSync(file+'.'+keep);
    for(let i=keep-1;i>=1;i--)if(existsSync(file+'.'+i))renameSync(file+'.'+i,file+'.'+(i+1));
    renameSync(file,file+'.1');
   }
   appendFileSync(file,line,{mode:0o600});
  }catch{process.stderr.write(JSON.stringify({at:new Date().toISOString(),event:'log_write_failed',sourceEvent:event})+'\n');}
 };
}
