import {writerLease} from '../packages/operations/lease.ts';
const releaseWriter=writerLease('tools/seed.ts');
process.once('exit',releaseWriter);
import { initialize,put,tables } from '../packages/dynamodb/client.ts';
import { ingest } from '../apps/api/src/service.ts';
const lots=[
 {lotId:'FT-2026-001',product:'Rosas de exportación',farm:'Finca La Sabana',route:'Chía → El Dorado → Ámsterdam',carrier:'Andes Cargo',customer:'Flora Europe',minC:2,maxC:8,sensorIds:['S-001','S-002']},
 {lotId:'FT-2026-002',product:'Aguacate Hass',farm:'Finca El Retiro',route:'Antioquia → Cartagena → Rotterdam',carrier:'Ruta Fría',customer:'Green Market',minC:4,maxC:7,sensorIds:['S-003']},
 {lotId:'FT-2026-003',product:'Arándanos',farm:'Finca Santa Elena',route:'Cundinamarca → El Dorado → Miami',carrier:'Andes Cargo',customer:'Berry Fresh',minC:0,maxC:4,sensorIds:['S-004']}
];
await initialize();
const base=Math.floor(Date.now()/86400000)*86400000;
for(const [li,l]of lots.entries()){
 await put(tables.core,{PK:'LOT#'+l.lotId,SK:'META',...l,GSI1PK:'LOTS',GSI1SK:l.lotId});
 for(const [i,title]of ['Cosecha y preenfriamiento','Salida de finca','Recepción en terminal'].entries())await put(tables.core,{PK:'LOT#'+l.lotId,SK:'TRACE#'+i,eventId:'trace-'+i,at:new Date(base-(3-i)*3600000).toISOString(),title,location:i===0?l.farm:i===1?'Centro logístico':'Terminal de carga',actor:'Operario DEMO-'+i});
 for(let i=0;i<72;i++)for(const sensorId of l.sensorIds){
  const observedAt=new Date(base-24*3600000+i*20*60000).toISOString();
  const readingId='seed-'+observedAt.slice(0,10)+'-'+i+'-'+sensorId;
  await ingest({readingId,lotId:l.lotId,sensorId,observedAt,temperatureC:Math.round(((l.minC+l.maxC)/2+Math.sin(i/6)*.7+(li===0&&i>=58&&i<=62?4.2:0))*10)/10,humidityPct:77+Math.round(Math.sin(i)*4),batteryPct:94-i*.1,doorOpen:li===0&&i===60,latitude:4.86-i*.001,longitude:-74.05-i*.001},readingId);
 }
}
console.log('3 lotes sintéticos, trazabilidad y lecturas disponibles.');
