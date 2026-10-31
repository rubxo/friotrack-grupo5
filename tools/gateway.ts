import {buildGateway} from '../packages/gateway/app.ts';
const {app}=buildGateway();
await app.listen({host:'127.0.0.1',port:Number(process.env.GATEWAY_PORT??3002)});
console.log('Gateway persistente http://127.0.0.1:'+(process.env.GATEWAY_PORT??3002));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void app.close());
