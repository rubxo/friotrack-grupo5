# Estado verificable de la construcción

Actualización local: 31 de octubre de 2026, hora de Colombia. Los resultados históricos de carga de abajo se conservan como antecedentes; no son mediciones nuevas.

## Implementado y probado

- API Fastify, panel React, tipos y validaciones TypeScript, tres tablas con índices en DynamoDB Local.
- Carga de tres lotes y cuatro sensores sintéticos. Ingestión, deduplicación transaccional, alarmas versionadas, estado actual, trazabilidad e integridad.
- Validación actual: build y TypeScript correctos; 17 pruebas unitarias/HTTP y 8 de integración aprobadas. Logs en `evidence/validation-2026-10-31`.
- En navegador: el botón de integridad verificó 902 lecturas de cuatro cadenas sin inconsistencias, después de terminar las cargas. Captura en `output/playwright/integrity.png`; no demuestra resistencia a administrador privilegiado.
- Archivo diario de 144 lecturas con firma Ed25519 verificada, bajo `.local/archive`. No es Object Lock ni copia independiente.
- Modelo reproducible de demanda y crecimiento duplicado en `evidence/volumetry.json`. Los valores son crudos, no tamaños físicos de factura.
- Doce ADR, dos runbooks, consulta docente y plantilla de evento en Markdown. Son borradores de diseño, no simulacros AWS ni documentos finales exportados.

## Resultados de carga que no cumplen el objetivo

Ambas pruebas concentran solicitudes en dos sensores, con hasta 100 en vuelo. Esto genera contención artificial sobre sus cabezas. No representa una población de 4500 sensores y no valida capacidad AWS.

| Objetivo de envío | Solicitudes | Confirmadas | HTTP 503 | Duración total | Tasa confirmada |
|---|---:|---:|---:|---:|---:|
| 150/s durante 2 s | 300 | 256 | 44 | 10,18 s | 25,16/s |
| 642/s durante 1 s | 642 | 502 | 140 | 19,08 s | 26,31/s |

Una ejecución previa devolvió 400 por identificadores de sensor incorrectos del simulador; se corrigieron. Su JSON se conserva para no ocultar el fallo, y no debe tratarse como medición de rendimiento del motor.

Siguiente prueba necesaria: carga distribuida entre muchos sensores, duración sostenida, drenaje/reintento con la misma clave, registro de la tasa realmente ofrecida y ausencia de pérdida. La carga solicitada no equivale a tasa alcanzada: el límite de concurrencia extiende el envío.

## Pendiente para cerrar el plan

1. Gateway persistente: prueba E2E de una hora de datos en modo acelerado completada; consultar `evidence/gateway-e2e/latest.json` y `docs/guia-local-dynamodb.md`. No se ha ejecutado la variante de una hora de tiempo real ni demostrado capacidad para 4.500 sensores.
2. Consumidor de Streams, historia S3/Athena, aislamiento de identidades, manifiestos independientes y simulacros regionales: diseño solamente; no desplegar AWS sin autorización.
3. Costos completos con fuentes y capturas por región; libro XLSX recalculable, sensibilidad y comparación presupuestal. No hay conclusión de cumplimiento presupuestal.
4. Matriz completa contra rúbrica, revisión jurídica con fuentes oficiales, informe PDF de máximo 25 páginas y presentación de máximo 20 diapositivas.
5. Verificación visual de los archivos finales y ensayo de sustentación.
6. Respuesta del docente sobre on premise y carta de evento. La consulta no se ha enviado.

No presentar el repositorio como paquete académico terminado. Las capacidades de AWS descritas en los ADR son propuestas y no funciones desplegadas por este laboratorio.

## Ampliación local del 31 de octubre

Se añadieron logs JSONL con rotación, leases para impedir respaldo con escritores activos, copia lógica de las tres tablas y SQLite con manifiesto SHA-256, restauración a nombres nuevos, y un visor de tablas/cola/logs en la sección **Base de datos** del panel. El E2E usa HTTP real y DynamoDB Local, conserva 720 pendientes tras SIGKILL, verifica 1.440 lecturas de 12 sensores y provoca pérdida de confirmación después del commit. Comprueba replay y restauración por contenido. La ejecución final y sus tiempos exactos se registran en `latest.json`; no implica validación AWS.

El documento docente aportado define el proyecto como investigación y diseño sin creación de cuentas cloud. Este prototipo es una ampliación solicitada por el estudiante. La guía separa ese alcance, la relación con ACID/concurrencia de las clases y las limitaciones de las copias locales. La retención implementada de telemetría sigue siendo 30 días, no los dos años exigidos por el diseño académico.
