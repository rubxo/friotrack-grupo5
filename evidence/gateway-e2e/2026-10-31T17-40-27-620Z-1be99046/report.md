# Prueba local del gateway FríoTrack

Resultado: PASÓ. Modo: accelerated. Hora representada: 3600 segundos. Caída real: 7.244 segundos. Duración total: 88.434 segundos.

1440 lecturas de 12 sensores, cada 30 segundos durante una hora simulada. 720 lecturas sobrevivieron a SIGKILL. Recuperación: 29.371 segundos. Lecturas verificadas en DynamoDB Local: 1440; perdidas: 0; duplicadas: 0. Todos los contenidos coinciden con sus hashes esperados.

Se perdió una respuesta después del commit y se observó replay. Ocho reenvíos concurrentes devolvieron replay; el contenido conflictivo devolvió 409. Restauración a tablas nuevas y SQLite nuevo verificada por contenido; backup corrupto rechazado.

Los archivos JSONL y result.json contienen la evidencia técnica. Datos y respaldos: /home/rubxo/Documentos/ChatGPT/BASES DE DATOS/.local/e2e/2026-10-31T17-40-27-620Z-1be99046.

No prueba una hora de espera real en modo acelerado, 4500 sensores, rendimiento AWS, recuperación regional, independencia del respaldo ni protección contra administrador local.
