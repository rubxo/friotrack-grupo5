# ADR-010: Convención lineal anual de sensores

## Estado
Aceptado como supuesto explícito

## Fecha
2026-10-20, America/Bogota.

## Contexto
El volumen anual cambia según si el crecimiento ocurre al inicio, al final o durante el año.

## Decisión
4500 al inicio del año 1; crecimiento 25%,25%,15%,15%,15%; promedio de inicio y cierre para volumen, cierre para pico.

## Alternativas
Usar solo cierre es conservador pero aumenta el volumen anual; usar solo inicio lo subestima.

## Consecuencias y verificación
Mantener el crecimiento fraccionario para planeación y redondear hacia arriba el dimensionamiento físico. Sensibilidad con crecimiento duplicado. Fuente: enunciado y convención del plan, no AWS.

## Evidencia
Enunciado FríoTrack, sección de demanda. Convención adoptada por el plan del Grupo 5.
