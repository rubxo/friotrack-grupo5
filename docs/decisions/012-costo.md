# ADR-012: Costear el modelo físico real

## Estado
Aceptado como criterio de cálculo

## Fecha
2026-10-20, America/Bogota.

## Contexto
Una lectura lógica de 180 B produce varios ítems, transacciones, índices y réplicas.

## Decisión
Medir tamaños con nombres y valores, redondear por unidad facturable, separar región escritora y réplica, incluir Ops, archivo, consultas y administración.

## Alternativas
Multiplicar 180 B por lecturas sirve para volumen crudo, no para estimar la factura completa.

## Consecuencias y verificación
No afirmar cumplimiento de presupuesto con precios faltantes. Costos de prototipo y arquitectura optimizada deben distinguirse. La optimización necesita pruebas antes de reducir amplificación.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
