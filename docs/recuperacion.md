# Recuperación: diseño y runbooks

Estado: propuesta académica. No hay mediciones AWS ni evidencia de cumplimiento de RPO/RTO. DynamoDB Local no permite validar PITR o recuperación regional.

## Objetivos y método

| Clase | RPO objetivo | RTO objetivo | Disponibilidad requerida |
|---|---:|---:|---:|
| Transacciones | 5 minutos | 2 horas | 99,9 % |
| Telemetría | 1 hora | 4 horas | 99,5 % |
| Archivo | 24 horas | 48 horas | Según enunciado |

RTO medido = detección + declaración + conmutación/restauración + reconstrucción + validación + cambio de tráfico. Registrar inicio y fin UTC de cada etapa. Si etapas se solapan, usar el camino crítico y conservar ambos tiempos; no sumarlas dos veces.

RPO observado = instante del incidente − instante de la última operación recuperable y confirmada. Medir por tabla, cola y archivo. Usar identificadores de secuencia, no solo la fecha del último backup. Una réplica retrasada o una cola perdida puede tener un RPO peor que el nominal.

Antes del simulacro llenar: tamaño por tabla, cantidad de índices, región, método de recuperación, último backup limpio, claves disponibles, tasa medida de reconstrucción y responsables. No rellenar tiempos faltantes con garantías atribuidas al proveedor.

## Inventario 3-2-1-1-0 propuesto

Tres copias lógicas: operación, recuperación independiente, archivo verificable. Dos mecanismos: base/backup y objetos archivados. Una ubicación fuera del sitio principal. Una copia inmutable o aislada con autoridad administrativa independiente. Cero errores solo después de restaurar y validar checksums, conteos, autorización y consultas. Réplicas regionales por sí solas no sustituyen este inventario. Confirmar que las claves y las cuentas de respaldo no comparten un único punto de compromiso.

## Runbook 1 — caída del principal

1. Abrir incidente, capturar hora UTC, alarmas y última escritura confirmada. Responsable: operador de turno.
2. Distinguir indisponibilidad de corrupción. Si hay corrupción, no promover una réplica hasta hallar un punto limpio. Responsable: administrador de datos.
3. Aislar el escritor principal mediante el mecanismo de fencing diseñado y probado. Si no se puede asegurar escritor único, mantener ingestión en cola y escalar. No habilitar ambos escritores.
4. Medir retraso por tabla, confirmar claves y permisos, cotejar los últimos identificadores de lectura y registros transaccionales en la región de recuperación.
5. Autorizar promoción solo si la pérdida observada está dentro del RPO; si no, registrar desviación y solicitar decisión del responsable de negocio.
6. Cambiar configuración/tráfico de forma controlada. Ejecutar lectura canaria por lote, escritura idempotente, reintento y verificación de cadena en un día cerrado.
7. Reproducir la cola con las claves originales. Observar errores, duplicados y latencia. No generar nuevas claves durante el replay.
8. Cerrar la recuperación cuando el portal, alarmas y archivo vuelvan a operar. Registrar cada componente y el RTO real. Si falla la canaria, detener escrituras secundarias y conservar cola; no volver al principal sin revalidación.
9. Retornar a la región original mediante otro cambio aprobado y reconciliación, no automáticamente.

## Runbook 2 — pérdida total de Chía o compromiso administrativo

1. Declarar pérdida de sitio y preservar evidencia fuera del sitio. Revocar accesos comprometidos y abrir control de cambios.
2. Establecer operación desde sitio alterno autorizado, identidad de emergencia y conectividad. Confirmar responsables disponibles y custodia de llaves.
3. Si AWS permanece sano, reconstruir gateway/aplicación desde versiones verificadas. Cuantificar la cola local perdida: sin copia externa no se garantiza RPO de esa cola.
4. Si también se comprometió la base, elegir un backup limpio anterior al incidente y restaurar a tablas nuevas, en entorno aislado. No sobrescribir evidencia original.
5. Restaurar configuración, permisos, índices e integraciones. Reconciliar lotes, alarmas, cabezas, manifiestos y archivo independiente. Detectar huecos de secuencia y datos tardíos.
6. Comparar hashes y firmas con referencias bajo custodia independiente. Un hash regenerado desde datos comprometidos no es una validación.
7. Probar acceso por cliente, consulta de 21 días y recuperación de objeto archivado. Medir el tiempo completo incluyendo disponibilidad para el usuario, no solo el cambio de estado del servicio.
8. Autorizar reapertura, anunciar pérdidas confirmadas y registrar RPO/RTO por clase. Ante diferencias no explicadas, mantener aislamiento y solicitar validación humana.

## Evidencia del simulacro

Registrar: escenario, versión de scripts/configuración, tamaño, tiempos de cada etapa, último ID confirmado/recuperado, prueba de restauración, hashes, acceso autorizado/denegado, capturas originales y responsable que acepta resultados. Pendiente completar mediante un ensayo autorizado; no crear recursos AWS en este proyecto.
