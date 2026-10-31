# ADR-009: Limitar el laboratorio a localhost

## Estado
Aceptado para prototipo

## Fecha
2026-10-20, America/Bogota.

## Contexto
No hay identidad de usuarios ni autorización por cliente implementadas.

## Decisión
Enlazar API, panel y Docker a loopback; bloquear endpoints remotos en el cliente DynamoDB.

## Alternativas
Publicar el panel en una LAN facilitaría demostraciones pero expondría datos y escrituras sin autorización.

## Consecuencias y verificación
CORS no es autenticación. Antes de producción implementar identidad, permisos por cliente, IAM mínimo, TLS y auditoría. No usar datos personales reales.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.UsageNotes.html
