# ADR-004: Cadena por sensor y día

## Estado
Aceptado para demostración; evidencia externa propuesta

## Fecha
2026-10-20, America/Bogota.

## Contexto
Una escritura condicional evita sobrescrituras normales pero no prueba ausencia de manipulación administrativa.

## Decisión
Hash canónico de la lectura y hash anterior, secuencia y cabeza por sensor/día. Archivo local firmado Ed25519 como demostración; KMS y Object Lock quedan propuestos.

## Alternativas
Una única cadena global serializa la ingestión. Un hash independiente no detecta omisión de eslabones.

## Consecuencias y verificación
La verificación local depende de cabezas confiables; no resiste reescritura coordinada de datos y cabezas. Verificar días cerrados o pausar ingestión para evitar cambios durante la consulta.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
