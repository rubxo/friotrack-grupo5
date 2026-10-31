# Pruebas del panel FríoTrack

## Inicio para esta noche

En la carpeta del proyecto, con Docker activo y Node 24:

```bash
npm ci
npm run demo
```

Si las dependencias ya están instaladas, basta `npm run demo`. Mantén la terminal abierta y visita http://127.0.0.1:5173. Si la aplicación ya está corriendo, no abras un segundo servidor. `Ctrl+C` detiene API y panel; `docker compose stop` detiene la base sin borrar datos.

El arranque carga lecturas sintéticas recientes, sin borrar las pruebas anteriores. Los estados de las alarmas que ya reconociste se conservan. No uses `docker compose down -v`: eliminaría el volumen.

## Recorrido de aceptación manual

1. **Operación:** aparecen tres lotes, cuatro sensores registrados y una gráfica al seleccionar cada lote. El diseño es oscuro, con navegación superior y un único botón principal lima por vista.
2. **Periodo:** cambia entre 24 horas, 48 horas, 7 días y 21 días. La gráfica debe indicar carga y actualizarse. El panel recupera páginas de 500 hasta un máximo visible de 10.000 lecturas; avisa al alcanzar el límite. Los intervalos largos pueden tardar más.
3. **Simular excursión:** selecciona un lote y pulsa el botón. Debe aparecer confirmación y una nueva alarma. Son datos sintéticos que quedan guardados.
4. **Alarma:** pulsa Reconocer y luego Cerrar en esa fila. Comprueba que cambia de Abierta a Reconocida y finalmente a Cerrada. Recarga para verificar persistencia.
5. **Trazabilidad:** cambia de lote y revisa finca, ruta y los tres hitos de custodia.
6. **Integridad:** ejecuta la verificación y espera el conteo y las inconsistencias. Realízala sin simulador de carga concurrente; las consultas no constituyen un snapshot global. No confundas cero lecturas con una prueba de datos existentes.
7. **Móvil:** prueba un ancho de 390 px. La navegación, el selector de periodo, los botones y la ficha deben seguir accesibles. Las tablas pueden desplazarse horizontalmente dentro de su contenedor.
8. **Errores:** si detienes la base, debe mostrarse un error, no una confirmación falsa. Reactiva con `npm run db:up`, espera unos segundos y pulsa Actualizar.

## Pruebas automatizadas

```bash
npm run build
npm test
npm run test:integration
```

Las pruebas de integración crean lotes `TEST-*` y alteran intencionalmente una lectura de prueba. Esos lotes no aparecen en el resumen. No modifiques directamente los lotes de demostración para probar alteraciones si quieres conservar sus cadenas.

## Verificación ejecutada el 25 de octubre de 2026

Compilación correcta, siete pruebas unitarias/estáticas y siete pruebas de integración aprobadas. En navegador se verificaron selección de lote, simulación de excursión, reconocimiento y cierre persistido en la base, trazabilidad y prueba de integridad (73 lecturas, dos cadenas, cero inconsistencias). El historial de 21 días mostró 1055 lecturas, superando correctamente la primera página de 500. Vista móvil comprobada a 390 px, con ancho de documento de 390 px y controles disponibles. La consola no registró errores durante ese recorrido.

Capturas y estados del navegador en `output/playwright/linear-*`. Las pruebas modificaron únicamente datos sintéticos. No se ejecutó una nueva prueba de rendimiento de 150/642 escrituras por segundo.

## Límites que siguen vigentes

Prototipo local sin autenticación, no apto para publicar en Internet. El diseño aplicado no implementa Global Tables, archivo S3/Athena, gateway persistente ni recuperación productiva. La carga de 150/642 escrituras por segundo no está acreditada. Los entregables académicos finales siguen pendientes. La firma local no es una copia independiente ni Object Lock.

Referencia visual: DESIGN (6).md proporcionado por el usuario, identificado como Linear. Se adaptan paleta #08090a/#0f1011, bordes #23252a, texto #d0d6e0 y acción #e4f222. Se conserva la identidad FríoTrack; no se añaden marcas o clientes ficticios. Se usa Inter si está instalada, con tipografía del sistema como alternativa sin dependencia de una descarga externa.
