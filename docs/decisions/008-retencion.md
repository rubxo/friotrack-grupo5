# ADR-008: Filtrar expirados sin depender de TTL

## Estado
Aceptado para consultas locales

## Fecha
2026-10-20, America/Bogota.

## Contexto
La expiración física no debe determinar qué devuelve el portal.

## Decisión
Consultar solo lecturas cuyo expiresAt esté vigente; configurar TTL productivo después de validar el archivo.

## Alternativas
Esperar que TTL borre exactamente a los 30 días vuelve impredecible la ventana visible.

## Consecuencias y verificación
El filtrado puede requerir más páginas. Nunca borrar antes de confirmar archivo completo y verificable. La activación TTL no está demostrada localmente.

## Evidencia
Documentación oficial consultada: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html
