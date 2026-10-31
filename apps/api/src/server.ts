import {buildApp} from './app.ts';
const app=buildApp();
await app.listen({host:'127.0.0.1',port:Number(process.env.PORT??3001)});
console.log('FríoTrack API http://127.0.0.1:3001');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
