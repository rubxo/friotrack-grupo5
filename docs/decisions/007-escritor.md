# ADR-007: Un escritor activo con Global Tables MREC

## Estado
Propuesto, no desplegado

## Fecha
2026-10-20, America/Bogota.

## Contexto
La duplicación entre regiones no conserva una transacción como unidad global.

## Decisión
Diseñar un escritor activo con fencing y procedimiento de failover. Validar deduplicación y reconciliación antes de habilitar escrituras secundarias.

## Alternativas
Activo-activo incrementa disponibilidad de escritura pero agrega conflictos sobre cabezas y versiones.

## Consecuencias y verificación
Un flag local no basta como fencing. Definir autoridad externa y pruebas de partición. No prometer RPO cero ni atomicidad multirregión.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
