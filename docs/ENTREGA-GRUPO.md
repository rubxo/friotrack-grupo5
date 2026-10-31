# Entrega al grupo FríoTrack

El proyecto ya tiene un prototipo local funcional. Lo que queda principalmente es completar y organizar la entrega académica. No es un despliegue de AWS ni el trabajo final terminado.

## Qué se hizo

- Aplicación web para ver lotes, temperaturas, alarmas y trazabilidad.
- API y tres tablas en DynamoDB Local, que corre en Docker.
- Gateway con cola persistente en SQLite para guardar lecturas cuando la API se cae y enviarlas cuando vuelve.
- Control de duplicados, validación, transacciones, integridad por hashes y control de versiones en alarmas.
- Logs con rotación, backups locales y restauración comprobada a tablas nuevas.
- Sección **Base de datos** para explorar tablas, lecturas, cola, logs y resultado de la prueba.
- 17 pruebas unitarias/HTTP, 8 de integración y compilación aprobadas en el equipo original.
- Prueba E2E con 1.440 lecturas de 12 sensores: reinicio forzado, respuesta perdida, recuperación desde una cola respaldada y replay sin pérdidas ni duplicados.

La prueba representa una hora de datos **en modo acelerado**. La caída real fue de 7,882 segundos y la recuperación tardó 29,544 segundos. No se esperó una hora real ni se probó la capacidad de 4.500 sensores o el rendimiento en AWS.

## Cómo abrirlo en otro computador

Instalen Git, Node 24 y Docker con Compose. Con Docker encendido, clonen este repositorio y entren en su carpeta. Si usan nvm, pueden ejecutar `nvm install` y `nvm use`.

```bash
npm ci
npm run db:up
npm run db:init
npm run db:seed
npm run dev
```

Abran http://127.0.0.1:5173 y entren en **Base de datos** para entender qué se está guardando. No necesitan una cuenta ni claves reales de AWS.

El código es público; la aplicación se ejecuta en cada computador. GitHub no aloja esta API ni las tablas de DynamoDB Local. Los enlaces `127.0.0.1` de las evidencias corresponden al equipo que los ejecuta.

La base, claves privadas y respaldos del equipo original no están en GitHub. Los comandos crean datos sintéticos nuevos en cada computador. Las capturas y los JSON incluidos son evidencias históricas, no mediciones de su equipo. Algunas evidencias contienen rutas locales del equipo original: sirven como registro de la ejecución, no como rutas que existan en sus computadores.

## Cómo probarlo

Primero detengan `npm run dev` con Ctrl+C y dejen Docker/DynamoDB encendido. Ejecuten cada comando cuando termine el anterior:

```bash
npm test
npm run test:integration
npm run test:e2e
npm run build
```

No inicien otro `dev`, seed o simulador mientras se ejecuta el E2E: incluye un respaldo que requiere detener escritores. Las pruebas crean datos y tablas aisladas; no borren el volumen con `docker compose down -v` si quieren conservarlos. La opción `npm run test:e2e -- --real-time` tarda más de una hora y no forma parte de los resultados publicados.

## Qué falta para la entrega

Estas tareas siguen abiertas; el grupo puede repartirlas como prefiera:

1. **Costos:** completar el Excel recalculable a cinco años, comparar nube y on premise/híbrido, justificar supuestos, actualizar fuentes y revisar el presupuesto. Los JSON de precios incluidos no son el libro de costos terminado.
2. **Arquitectura y recuperación:** cerrar el diseño de retención de dos años en línea/cinco en total, archivo histórico, seguridad, copias independientes, RPO y RTO con cálculos y fuentes. El código local usa una ventana de 30 días y backups en el mismo equipo.
3. **Consulta al profesor:** aclarar el escenario on premise con DynamoDB y obtener la carta de evento o las instrucciones que falten. Hay un borrador; no se ha enviado una consulta desde este proyecto.
4. **Informe:** completar la matriz de rúbrica, análisis jurídico con fuentes oficiales, comparación de escenarios, recomendación y PDF final de máximo 25 páginas.
5. **Presentación:** preparar máximo 20 diapositivas, respuesta a la carta de evento y reparto/ensayo de la sustentación.

El documento del profesor define un proyecto de **investigación y diseño sin crear cuentas ni contratar infraestructura cloud**. Los componentes AWS descritos en los borradores son propuestas que deben justificarse; no se debe escribir que ya están desplegados. El laboratorio es una demostración adicional para entender el flujo.

## Archivos para empezar

- [Guía local de DynamoDB, AWS, logs y backups](guia-local-dynamodb.md).
- [Estado y pendientes detallados](estado-entrega.md).
- [Informe de validación local](../evidence/validation-2026-10-31/INFORME.md).
- [Resultado completo E2E](../evidence/gateway-e2e/latest.json).
- [Decisiones de arquitectura](decisions/).
- [Recuperación propuesta](recuperacion.md).
- [Consulta docente en borrador](consulta-docente.md).
- [Plantilla del memorando de evento](memorando-evento.md).

## Cómo colaborar

Cada integrante puede clonar el repo y trabajar en una rama. Para subir cambios al mismo repositorio necesita permiso de colaborador; si no lo tiene, puede hacer un fork y enviar un pull request. Que el repo sea público permite leerlo y clonarlo, pero no da permiso de escritura a todos.

No suban `.env`, tokens, claves, datos personales, bases SQLite ni backups reales. `.gitignore` ya excluye el material local habitual. Actualicen la documentación cuando completen una tarea y distingan siempre resultados medidos de propuestas.
