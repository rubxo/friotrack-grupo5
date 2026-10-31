# ADR-003: Deduplicación transaccional persistida

## Estado
Aceptado para prototipo

## Fecha
2026-10-20, America/Bogota.

## Contexto
Los sensores pueden reenviar una lectura después de perder la respuesta.

## Decisión
Escribir lectura, registro de clave, registro de readingId y cabeza en una transacción. Rechazar contenidos distintos con 409.

## Alternativas
Deduplicar solo en memoria pierde protección al reiniciar. El token transaccional nativo no reemplaza la retención requerida.

## Consecuencias y verificación
Mayor amplificación de escritura y almacenamiento. Dos copias de respuesta persisten en Ops. Reintentos con backoff pueden agotar su límite y devolver 503.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
