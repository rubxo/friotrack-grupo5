# Solicitudes de cotización y consulta al profesor (borradores, no enviados)

Estado: borradores del 2026-11-02. Nada de esto se ha enviado. Faltan destinatarios y firma; no hay correos ni contactos en el repo, así que están en blanco a propósito. Cuando lleguen las respuestas, se pegan en las celdas amarillas de `docs/friotrack-costos-5-anios.xlsx` (hojas `Costo_*`, tabla "Chía") y se adjunta el PDF de cada cotización.

## 1. Consulta al profesor (reemplaza el borrador de `consulta-docente.md`)

Asunto: Grupo 5 - dudas para cerrar el escenario B y los precios

Profesor/a:

Somos el Grupo 5 (DynamoDB, AWS). Antes de la sustentación del jueves 5 de noviembre necesitamos confirmar cuatro puntos para no incumplir el enunciado:

1. Entendemos que DynamoDB es un servicio administrado de AWS y que no existe una edición instalable para producción on premise (DynamoDB Local es solo una herramienta de desarrollo). Por eso presentaremos el escenario B como la variante híbrida del §2 del enunciado (aplicación, gateway y copias independientes en Chía, DynamoDB en AWS), costeada completa, y documentaremos con fuentes por qué el B estrictamente local no es viable. ¿Hay algo adicional que el jurado espere ver en el escenario B?
2. Nuestro diseño guarda 30 días de lecturas en DynamoDB y hasta 2 años en S3/Parquet consultable con Athena. ¿Eso cuenta como "2 años en línea consultables desde el portal"?
3. Para el hardware de Chía, ¿basta el precio de lista de un distribuidor con la referencia exacta (con enlace y fecha), o se exige cotización formal en PDF? Para los precios de nube, ¿es suficiente la lista pública de precios de AWS con la captura de la AWS Pricing Calculator?
4. ¿Cuándo y por qué medio recibiremos la carta de evento?

Aclaramos que el prototipo local es una demostración adicional y que los componentes de AWS son propuestas, no recursos desplegados.

[Nombre del integrante que envía] - Grupo 5

## 2. Solicitud de cotización: servidores de aplicación (Chía)

Asunto: Solicitud de cotización - 2 servidores rack para aplicación y gateway (Chía, Cundinamarca)

Buen día. Solicitamos cotización formal (PDF, con validez de la oferta, referencia exacta y garantía) para:

- Cantidad: 2 servidores rack.
- Procesador: 1 socket, 16 núcleos o más.
- Memoria: 128 GB o más.
- Almacenamiento: 2 SSD de unos 960 GB en RAID 1, con controladora.
- Fuentes de poder: 2, redundantes.
- Red: 2 puertos de 10 GbE o 4 de 1 GbE.
- Garantía y soporte del fabricante por 5 años, con atención en sitio.
- Entrega e instalación en rack en Chía, Cundinamarca.

Por favor indicar: precio unitario sin IVA y con IVA, moneda (COP o USD) y fecha de la lista, consumo eléctrico típico y máximo en vatios por equipo, tiempo de entrega y costo de renovación de garantía si no es de 5 años.

[Nombre] - FríoTrack SAS (proyecto académico, Universidad de La Sabana). Es una cotización con fines de estudio; no se realizará compra.

## 3. Solicitud de cotización: enlace de internet (Chía)

Asunto: Solicitud de cotización - internet dedicado simétrico con IP fija (Chía)

Buen día. Solicitamos cotización mensual y anual de internet dedicado para una sede en Chía, Cundinamarca:

- Ancho de banda simétrico: cotizar 100 Mbps y 200 Mbps (por validar con nuestro cálculo de tráfico).
- IP pública fija (al menos 1; cotizar un bloque de 4).
- Disponibilidad contractual (SLA): 99,9 % o superior, y tiempos de reparación.
- Compatibilidad con VPN sitio a sitio (IPsec) hacia una nube pública.
- Plazo de contrato de 36 meses y costo de instalación.

Por favor indicar: valor mensual sin IVA y con IVA, costo de instalación, condiciones del SLA y si hay un segundo enlace de respaldo y a qué precio.

[Nombre] - FríoTrack SAS (proyecto académico, Universidad de La Sabana). Cotización con fines de estudio.

## 4. Datos que debemos tener antes de enviar (tareas internas)

- Quién envía cada solicitud y desde qué correo.
- Confirmar el cálculo de ancho de banda: el modelo estima unos 91 TB de datos al año hacia Chía (alrededor de 7,6 TB al mes), un supuesto de consultas por validar.
- Confirmar si el servidor debe ser 1U o 2U según el rack real de Chía (el libro dice 2U; un R660 es 1U).
- Decidir con el grupo si el escenario B incluye la unidad de cinta LTO-9 (USD 8.902 de referencia), porque pesa mucho en el año 1.
