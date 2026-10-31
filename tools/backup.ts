import {createBackup,verifyBackup,restoreBackup} from '../packages/operations/backup.ts';
const [action,dir,prefix,queue]=process.argv.slice(2);
if(!dir)throw new Error('Uso: npm run backup -- create|verify|restore DIRECTORIO [RESTORE_prefijo] [archivo-cola-nuevo]');
if(action==='create')console.log(JSON.stringify(await createBackup(dir,process.env.GATEWAY_DB),null,2));
else if(action==='verify'){const {manifest}=await verifyBackup(dir);console.log(JSON.stringify({verified:true,...manifest},null,2));}
else if(action==='restore'){if(!prefix||!queue)throw new Error('Restore necesita un prefijo RESTORE_ nuevo y ruta SQLite nueva.');console.log(JSON.stringify(await restoreBackup(dir,prefix,queue),null,2));}
else throw new Error('Acción inválida.');
