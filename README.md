# FríoTrack — Grupo 5

Prototipo académico de Juan David Rubio Aranguren. Fastify + React + TypeScript + **DynamoDB Local real**. No se despliega ni se factura infraestructura AWS.

## Para continuar en grupo

Empiecen por [la guía de entrega al grupo](docs/ENTREGA-GRUPO.md). Allí están lo que funciona, cómo abrirlo y las tareas que faltan. El repositorio contiene código, documentación y evidencias sintéticas; cada integrante debe generar su propia base local con los comandos de abajo.

## Arranque

Requisitos: Node 24, npm y Docker Compose. Después de clonar el repositorio, entra en su carpeta antes de ejecutar los comandos.

```bash
npm ci
npm run db:up
npm run db:init
npm run db:seed
npm run dev
```

Panel: http://127.0.0.1:5173. API: http://127.0.0.1:3001/api/v1/health.
Los datos persisten en el volumen de Docker. `docker compose down` detiene el servicio sin borrar el volumen. No ejecutar `down -v` si se quieren conservar.

## Verificación

```bash
npm run build
npm test
npm run test:integration
npm run simulate
RATE=642 SECONDS=10 npm run simulate
npm run archive -- FT-2026-001 2026-10-20
```

Las pruebas de integración agregan lotes `TEST-*` aislados y alteran intencionalmente una lectura de prueba. El panel los excluye. El simulador agrega lecturas sintéticas, registra tasa solicitada y obtenida en `evidence/`; no demuestra rendimiento productivo de AWS. El archivo diario se firma localmente con Ed25519 en `.local/archive`, no ofrece WORM, KMS ni independencia frente al administrador local.

## API

Base `/api/v1`. POST `/readings` requiere `Idempotency-Key` y campos `readingId`, `lotId`, `sensorId`, `observedAt` ISO, `temperatureC`, `humidityPct`, `batteryPct`, `doorOpen`, `latitude`, `longitude`.

- GET `/lots/:lotId/readings?from=&to=&limit=&cursor=`: fechas ISO, hasta 31 días y 500 elementos por página. Reutilizar exactamente el intervalo al paginar. Cursores firmados, inválidos después de reiniciar salvo `CURSOR_SECRET` estable.
- GET `/lots/:lotId/trace` e `/integrity?from=&to=`.
- GET `/alarms?lotId=&status=&cursor=`; lote obligatorio en el prototipo.
- PATCH `/alarms/:alarmId`: `{ "status": "ACKNOWLEDGED", "version": 1 }`; transiciones posteriores a `CLOSED`.
- GET `/dashboard`, `/lots`, `/health`.

No hay endpoints de modificación o eliminación de lecturas. Errores JSON tienen `error.code` y `error.message`. El historial consulta buckets mediante Query, nunca Scan. Las escrituras transaccionales deduplican lectura y clave de idempotencia; las cabezas de cadena usan control optimista. Lecturas tardías no reemplazan un estado más reciente.

## Límites importantes

Solo laboratorio, enlazado a loopback y sin autenticación multiusuario. No exponer en Internet. Global Tables, S3/Athena, PITR, backups independientes, CloudTrail, autorización por cliente y failover regional siguen siendo arquitectura pendiente, no funciones de este ejecutable. La prueba de hashes local no resiste un administrador que reescriba datos y cabezas. El historial no consulta aún los dos años de archivo.

Tres tablas separan datos operacionales, telemetría caliente y operaciones. Cada lectura produce varias escrituras transaccionales e índices: **no costear una lectura como una única WRU**. Los registros de idempotencia conservan una respuesta completa y deben incluirse en la volumetría. La expiración se filtra en las consultas; la configuración y ejecución TTL no se consideran probadas por el emulador.

El paquete académico completo está en construcción. No presentar como final hasta cerrar precios y evidencias, comparar los escenarios y verificar los archivos exportados. La consulta al docente sobre el escenario on premise necesita destinatario y respuesta; no se ha enviado.

## Gateway, logs, backups y visor de la base

`npm run dev` inicia API, gateway, inspector local de solo lectura y web. Abre http://127.0.0.1:5173 y selecciona **Base de datos** para ver tablas reales, cola, logs y resultado E2E. No necesitas cuenta AWS.

Con `dev` detenido y DynamoDB encendido, ejecuta secuencialmente:

```bash
npm test
npm run test:integration
npm run test:e2e
npm run build
```

El E2E representa una hora con 1.440 lecturas de 12 sensores en modo acelerado, fuerza SIGKILL, pierde un ACK después del commit y verifica replay, integridad y restauración. `npm run test:e2e -- --real-time` permite una hora de espera real. Evidencia en `evidence/gateway-e2e/latest.json`. No valida la flota de 4.500 sensores ni AWS.

Consulta [la guía local](docs/guia-local-dynamodb.md) para entender DynamoDB/AWS, la relación con las clases, comandos de backup/restore y sus límites. La actividad oficial es de investigación y diseño, sin crear cuentas cloud.
