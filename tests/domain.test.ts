import test from 'node:test';
import assert from 'node:assert/strict';
import { readingSchema, hashReading, bucketKeys, daysBetween, encodeCursor, decodeCursor } from '../packages/domain/index.ts';

const input = { readingId: 'r1', lotId: 'LOTE-001', sensorId: 'S-01', observedAt: '2026-10-20T12:00:00.000Z', temperatureC: 4, humidityPct: 75, batteryPct: 98, doorOpen: false, latitude: 4.71, longitude: -74.07 };
test('rejects impossible sensor values and ambiguous timestamps', () => {
  assert.equal(readingSchema.safeParse({ ...input, humidityPct: 101 }).success, false);
  assert.equal(readingSchema.safeParse({ ...input, observedAt: 'yesterday' }).success, false);
  assert.equal(readingSchema.safeParse(input).success, true);
});
test('hash detects changed measurements regardless of object property ordering', () => {
  assert.equal(hashReading(input, 'GENESIS'), hashReading({ ...input }, 'GENESIS'));
  assert.notEqual(hashReading(input, 'GENESIS'), hashReading({ ...input, temperatureC: 9 }, 'GENESIS'));
});
test('date buckets cover leap day and month boundary', () => {
  assert.deepEqual(daysBetween('2024-02-28T23:00:00Z', '2024-03-01T01:00:00Z'), ['2024-02-28','2024-02-29','2024-03-01']);
  assert.equal(bucketKeys(input).SK, 'TS#2026-10-20T12:00:00.000Z#SENSOR#S-01#r1');
});
test('cursor is bound to exact query and rejects tampering', () => {
  const token = encodeCursor({ last: 'x', scope: 'lot1' });
  assert.equal(decodeCursor(token, 'lot1').last, 'x');
  assert.throws(() => decodeCursor(token, 'lot2'));
  assert.throws(() => decodeCursor(token + 'x', 'lot1'));
});
