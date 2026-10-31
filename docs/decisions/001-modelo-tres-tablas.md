# ADR-001: Separar tres tablas

## Estado
Aceptado para prototipo

## Fecha
2026-10-20, America/Bogota.

## Contexto
La telemetría y la evidencia tienen retenciones distintas de los lotes.

## Decisión
Core almacena lotes, estado y alarmas; TelemetryHot almacena lecturas; Ops conserva deduplicación y cabezas.

## Alternativas
Una tabla única simplifica el despliegue pero acopla retención y observación de costos.

## Consecuencias y verificación
Hay transacciones entre tablas en una región. Se debe costear cada ítem y cada índice. No equivale a atomicidad entre regiones.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
