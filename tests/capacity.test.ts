import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demand,writeUnits,readUnits} from '../packages/domain/capacity.ts';
test('five-year demand uses mean population and end-year peak',()=>{
 const years=demand();assert.equal(years.length,5);assert.equal(years[0].endSensors,5625);assert.equal(years[0].averageSensors,5062.5);assert.equal(Math.round(years[0].readings),6740820000);assert.equal(years[0].lots,675000);assert.equal(years[1].startSensors,years[0].endSensors);assert.ok(Math.abs(years[4].peakEndYearRps-641.619140625)<.0001);assert.ok(demand(4500,2)[4].readings>years[4].readings);
});
test('capacity rounding includes 1KB/4KB boundaries and transactional multiplier',()=>{
 assert.equal(writeUnits(180),1);assert.equal(writeUnits(1024),1);assert.equal(writeUnits(1025),2);assert.equal(writeUnits(180,true),2);assert.equal(readUnits(4096),.5);assert.equal(readUnits(4097),1);assert.equal(readUnits(4097,'transactional'),4);
});
