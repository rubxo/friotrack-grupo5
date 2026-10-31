import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { z } from 'zod';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const readingSchema = z.object({
  readingId: id, lotId: id, sensorId: id,
  observedAt: z.iso.datetime({ offset: true }).transform(v => new Date(v).toISOString()),
  temperatureC: z.number().min(-90).max(90), humidityPct: z.number().min(0).max(100),
  batteryPct: z.number().min(0).max(100), doorOpen: z.boolean(),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180)
}).strict();
export type ReadingInput = z.infer<typeof readingSchema>;
export type SensorReading = ReadingInput & { receivedAt: string; payloadHash: string; previousHash: string; sequence: number; expiresAt: number };
export type Lot = { lotId: string; product: string; farm: string; route: string; carrier: string; customer: string; minC: number; maxC: number; sensorIds: string[] };
export type TraceEvent = { eventId: string; at: string; title: string; location: string; actor: string };
export type Alarm = { alarmId: string; lotId: string; sensorId: string; observedAt: string; temperatureC: number; status: 'OPEN'|'ACKNOWLEDGED'|'CLOSED'; version: number };
export type CertificateMetadata = { certificateId: string; lotId: string; sha256: string; objectKey: string };
export type IntegrityProof = { valid: boolean; checked: number; chains: number; issues: string[]; evidence: string };
export type PaginatedResult<T> = { items: T[]; cursor?: string };
export class ApiError extends Error { constructor(public statusCode: number, public code: string, message: string) { super(message); } }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export const sha256 = (v: unknown) => createHash('sha256').update(canonical(v)).digest('hex');
export function hashReading(input: ReadingInput, previousHash: string) { return sha256({ input: readingSchema.parse(input), previousHash }); }
export function shard(sensorId: string) { return parseInt(createHash('sha256').update(sensorId).digest('hex').slice(0,8),16) % 4; }
export function bucketKeys(r: ReadingInput) {
  return { PK: `LOT#${r.lotId}#DAY#${r.observedAt.slice(0,10)}#SHARD#${shard(r.sensorId)}`, SK: `TS#${r.observedAt}#SENSOR#${r.sensorId}#${r.readingId}` };
}
export function daysBetween(from: string, to: string) {
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end-start > 31*86400000) throw new ApiError(400,'INVALID_RANGE','El intervalo debe ser válido y de máximo 31 días.');
  const result: string[] = [];
  for(let t=Math.floor(start/86400000)*86400000;t<=end;t+=86400000) result.push(new Date(t).toISOString().slice(0,10));
  return result;
}
const cursorSecret = process.env.CURSOR_SECRET ?? randomBytes(32).toString('hex');
export function encodeCursor(data: { last: string; scope: string }) {
  const payload=Buffer.from(JSON.stringify(data)).toString('base64url');
  return payload+'.'+createHmac('sha256',cursorSecret).update(payload).digest('hex');
}
export function decodeCursor(cursor: string, scope: string): {last: string; scope: string} {
  try {
    const [payload,sig,...extra]=cursor.split('.');
    if (!/^[a-f0-9]{64}$/.test(sig??'')) throw new Error();
    const expected=createHmac('sha256',cursorSecret).update(payload).digest();
    const actual=Buffer.from(sig,'hex');
    if(extra.length || actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw new Error();
    const data=JSON.parse(Buffer.from(payload,'base64url').toString());
    if(data.scope!==scope || typeof data.last!=='string') throw new Error();
    return data;
  } catch { throw new ApiError(400,'INVALID_CURSOR','Cursor inválido o perteneciente a otra consulta.'); }
}
