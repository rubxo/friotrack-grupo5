/** Academic demand model. Decimal bytes; physical DynamoDB overhead is separate. */
export function demand(initialSensors=4500,growthMultiplier=1) {
 if(!Number.isFinite(initialSensors)||initialSensors<=0||!Number.isFinite(growthMultiplier)||growthMultiplier<0)throw new Error('Invalid demand assumptions');
 let start=initialSensors;
 return [.25,.25,.15,.15,.15].map((growth,index)=>{
  const end=start*(1+growth*growthMultiplier),average=(start+end)/2;
  const normalRps=average/30,seasonRps=average*(.4/10+.6/30);
  const readings=365*86400*(normalRps*8/12+seasonRps*4/12);
  const lots=50000*12*average/4500;
  const row={year:index+1,startSensors:start,endSensors:end,averageSensors:average,readings,normalAverageRps:normalRps,seasonAverageRps:seasonRps,peakEndYearRps:end*(.4/10+.6/30),rawTelemetryBytes:readings*180,alarms:readings*.005,rawAlarmBytes:readings*.005*400,lots,rawLotBytes:lots*2000,traceEvents:lots*12,rawTraceBytes:lots*12*600,pdfs:lots*1.5,rawPdfBytes:lots*1.5*350000,auditEvents:24000000,rawAuditBytes:24000000*300};
  start=end;return row;
 });
}
export function writeUnits(bytes:number,transactional=false){if(!Number.isFinite(bytes)||bytes<1)throw new Error('Invalid item bytes');return Math.ceil(bytes/1024)*(transactional?2:1);}
export function readUnits(bytes:number,consistency:'eventual'|'strong'|'transactional'='eventual'){if(!Number.isFinite(bytes)||bytes<1)throw new Error('Invalid item bytes');return Math.ceil(bytes/4096)*({eventual:.5,strong:1,transactional:2}[consistency]);}
