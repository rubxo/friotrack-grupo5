# ADR-006: No presentar DynamoDB Local como producción

## Estado
Pendiente de aclaración docente

## Fecha
2026-10-20, America/Bogota.

## Contexto
La asignación exige DynamoDB y también comparar un escenario on premise.

## Decisión
Preparar inviabilidad del escenario estrictamente local y alternativa híbrida condicionada a aprobación.

## Alternativas
Cambiar silenciosamente de motor incumple la asignación; atribuir PITR o Global Tables al emulador falsea capacidades.

## Consecuencias y verificación
La comparación B no puede recibir una cotización de una edición instalable inexistente. Mantener separado el laboratorio local de la arquitectura productiva.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html
