import {writerLease} from '../packages/operations/lease.ts';
const releaseWriter=writerLease('tools/setup.ts');
process.once('exit',releaseWriter);
import {initialize} from '../packages/dynamodb/client.ts';
for(let attempt=0;attempt<20;attempt++) {
 try {await initialize();break;}
 catch(error) {
  const e=error as NodeJS.ErrnoException;
  if(attempt===19||!['ECONNRESET','ECONNREFUSED','ETIMEDOUT','TimeoutError'].includes(e.code??e.name))throw error;
  console.log('Esperando el arranque de DynamoDB Local…');
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
}
console.log('Tablas e índices locales disponibles.');
