# Resultado local de FríoTrack al 31 de octubre de 2026

La prueba end-to-end aprobó. Se verificaron **1.440 lecturas únicas**, sin pérdidas ni duplicados, con todos sus contenidos y cadenas de integridad consistentes. El modo fue **acelerado**: representa una hora de 12 sensores cada 30 segundos; la caída real fue de **7.882 segundos**, y el drenaje tras restaurar la API tardó **29.544 segundos**. No fue una hora de espera real. La opción para ejecutarla en tiempo real está implementada pero no se ha ejecutado.

## Qué se comprobó

- Peticiones HTTP reales al gateway; API no disponible durante la acumulación.
- Reinicio por SIGKILL con 720 lecturas pendientes, sin pérdida después del reinicio.
- 1.440 pendientes antes de la recuperación; 0 pendientes y 0 en cuarentena después.
- Backup de la cola pendiente, copia recuperada y replay realizado desde esa copia.
- Una respuesta perdida después de commit: el reintento devolvió replay sin duplicar la lectura.
- Ocho reenvíos concurrentes devolvieron replay; contenido conflictivo devolvió HTTP 409.
- Comparación del contenido de todas las lecturas y de sus marcadores en DynamoDB Local; 12 cadenas de hash válidas.
- Backup de las tres tablas y SQLite, restauración a destinos nuevos y comparación SHA-256 de todas las filas y de la cola.
- Rechazo de un respaldo corrupto. Un ensayo adicional comprobó que restore rechaza el daño antes de crear el archivo de destino.

## Otros controles ejecutados

| Control | Resultado |
|---|---|
| Pruebas unitarias y HTTP de gateway | 17 aprobadas, 0 fallidas |
| Integración de API con DynamoDB Local | 8 aprobadas, 0 fallidas |
| TypeScript y build React | Aprobados |
| Rollback por condición fallida | Sin lectura, marcador ni cambio parcial de cabeza |
| Backup de las tablas habituales de demo | 86 filas Core, 1.647 TelemetryHot, 3.334 Ops |
| Restore de demo a RESTORE_demo_20261031 | Igualdad de todos los contenidos verificada |
| Backup con escritores activos | Rechazado antes de exportar |
| Visor | Query por PK, dos páginas de 25 sin solapamiento, cursor ajeno rechazado con 400 |
| Navegador | Sin desbordamiento horizontal a 1440 px y 390 px; vista de tabla y formulario comprobados |
| Lectura adicional por gateway de demo | Dos envíos con la misma clave; una sola fila persistida y cola enviada |

El backup de demo es una instantánea anterior a la lectura adicional de comprobación. Incluye datos TEST alterados intencionalmente por las pruebas de integridad; no debe interpretarse su existencia como daño de los lotes de demostración.

## Dónde ver y repetir

Abre http://127.0.0.1:5173 y selecciona **Base de datos**. Los cuatro procesos locales se dejaron iniciados. Si se detienen, desde la carpeta del proyecto ejecuta `npm run db:up` y `npm run dev`.

- [Guía de uso, DynamoDB y AWS, backups y clases](../../docs/guia-local-dynamodb.md)
- [Resultado técnico y hashes de código](result.json)
- [Resultado completo E2E](../gateway-e2e/latest.json)
- [Informe de la ejecución E2E](../gateway-e2e/2026-10-31T17-42-19-893Z-45ab0c43/report.md)
- Logs de esta validación: unit.log.txt, integration.log.txt, build.log.txt, e2e.log.txt, backup-demo.log.txt y restore-demo.log.txt.
- Backups y colas de la prueba E2E: `.local/e2e/`, subcarpeta indicada en el resultado.
- Backup habitual: `.local/backups/2026-10-31-demo`.
- Logs activos con rotación: `.local/logs/`.

Se conserva una ejecución preliminar fallida por intentar iniciar otro gateway mientras una restauración previa tenía el bloqueo de mantenimiento. No se borró esa evidencia. Las ejecuciones aprobadas posteriores y la validación final son las que sustentan los resultados de este informe.

## Límites y trabajo académico

No se ha desplegado o contratado AWS. No se acreditan rendimiento de 4.500 sensores, disponibilidad, desastre regional, SLA, RPO/RTO productivos ni cumplimiento jurídico. Los backups locales no son independientes, cifrados o inmutables, y no satisfacen por sí solos 3-2-1-1-0. El prototipo filtra telemetría a 30 días, no implementa todavía dos años en línea/cinco en total. Las filas enviadas de la cola se conservan; la capacidad configurada no es una prueba de capacidad física de disco.

El documento del profesor define investigación y diseño sin crear cuentas cloud. Este prototipo adicional responde al pedido de implementación del estudiante. Los conceptos ACID y de concurrencia de las clases se relacionan con transacciones condicionales y versionado; no se afirma haber implementado internamente un gestor de bloqueos/MVCC. Los detalles y enlaces a documentación oficial están en la guía.
