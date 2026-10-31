# ADR-002: Consultar buckets diarios

## Estado
Aceptado para prototipo

## Fecha
2026-10-20, America/Bogota.

## Contexto
El usuario consulta un lote durante 3–21 días; un Scan no limita trabajo al lote.

## Decisión
Usar PK por lote, día y shard determinista, y SK temporal. Fusionar los resultados y firmar cursores con HMAC.

## Alternativas
Un único PK por lote reduce consultas pero concentra carga e historia; Scan se descarta.

## Consecuencias y verificación
Cuatro shards iniciales aumentan consultas vacías. Medir antes de ampliar. El cursor requiere el mismo intervalo y no promete snapshot bajo escrituras concurrentes.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html
