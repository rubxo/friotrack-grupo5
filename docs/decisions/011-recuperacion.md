# ADR-011: Separar réplica de respaldo

## Estado
Propuesto, sin simulacro AWS

## Fecha
2026-10-20, America/Bogota.

## Contexto
Una réplica puede propagar borrado o corrupción.

## Decisión
PITR por réplica y copias independientes con aislamiento administrativo; archivo versionado con retención inmutable.

## Alternativas
Solo Global Tables no ofrece recuperación a un punto limpio ante todas las amenazas.

## Consecuencias y verificación
Medir restauración, reconstrucción, validación y tráfico. La regla 3-2-1-1-0 requiere inventario de copias y pruebas, no se satisface por nombrar servicios.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
