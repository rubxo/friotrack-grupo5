# ADR-005: 30 días calientes y dos años consultables

## Estado
Propuesto; interpretación académica pendiente

## Fecha
2026-10-20, America/Bogota.

## Contexto
Mantener todo en DynamoDB añade costo a datos históricos de acceso esporádico.

## Decisión
30 días en DynamoDB y hasta dos años detallados en S3/Parquet con Athena; años 3–5 en archivo con recuperación medida inferior a 48 horas.

## Alternativas
Dos años completos en DynamoDB simplifican el portal y encarecen almacenamiento/respaldos.

## Consecuencias y verificación
El portal deberá resolver dos proveedores y mostrar latencia distinta. Esta integración no está implementada. La aceptación de «en línea» debe confirmarse con docente.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html
