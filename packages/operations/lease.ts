import {mkdirSync,readFileSync,readdirSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const defaultRoot='.local/operations';
function live(file:string){
 try {const {pid}=JSON.parse(readFileSync(file,'utf8'));if(!Number.isSafeInteger(pid)||pid<1)throw new Error('Invalid lease');try{process.kill(pid,0);return true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')return true;}unlinkSync(file);return false;}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}
}
function init(root:string){mkdirSync(join(root,'writers'),{recursive:true,mode:0o700});}
export function writerLease(label:string,root=defaultRoot){
 init(root);const maintenance=join(root,'maintenance');
 if(live(maintenance))throw new Error('Respaldo/restauración en curso; espere antes de escribir.');
 const path=join(root,'writers',process.pid+'-'+randomUUID());
 writeFileSync(path,JSON.stringify({pid:process.pid,label}),{flag:'wx',mode:0o600});
 const release=()=>{try{unlinkSync(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}};
 if(live(maintenance)){release();throw new Error('Respaldo/restauración en curso.');}
 return release;
}
export function maintenanceLease(root=defaultRoot){
 init(root);const path=join(root,'maintenance');live(path);
 writeFileSync(path,JSON.stringify({pid:process.pid,label:'backup/restore'}),{flag:'wx',mode:0o600});
 const release=()=>unlinkSync(path);
 try{const active=readdirSync(join(root,'writers')).filter(n=>live(join(root,'writers',n)));if(active.length)throw new Error('Detenga API, gateway, seed y simulador antes del respaldo/restauración. Hay escritores activos.');return release;}
 catch(e){release();throw e;}
}
