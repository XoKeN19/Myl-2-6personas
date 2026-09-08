# Verificación · 7 de septiembre de 2026

Compilación de producción, TypeScript y revisión estática del código modificado sin errores. Las 43 pruebas automáticas pasan: movimiento libre, consultas privadas, transferencias, armas, temporizador, fases sugeridas, importación, persistencia y HTTP con seis jugadores.

## Cuatro recorridos en navegador

Se ejecutaron recorridos independientes en Chromium con los mazos Guerrero y Dragón, dos sesiones de jugador y una de espectador:

| Recorrido | Ventana | Jugadores | Movimiento |
| --- | --- | --- | --- |
| 1 | 1440 × 900 | 2 | Normal |
| 2 | 1280 × 800 | 2 | Normal |
| 3 | 1920 × 1080 | 6 | Normal |
| 4 | 390 × 844 | 2 | Reducido, entrada táctil emulada |

Cada recorrido comprueba robo, arrastre a defensa y ataque, cambio de fase, coste y fuerza, modificación de fuerza, última carta, barajado, búsqueda, consentimiento rival, privacidad del espectador, temporizador, paso de turno y regreso al mismo asiento desde el menú. La extracción de primera y última carta también tiene pruebas del motor. Se instrumentaron las animaciones de cartas y los sonidos para confirmar su ejecución; con movimiento reducido no se generan animaciones de cartas.

La prueba móvil detectó una cabecera superpuesta que impedía volver al menú. Se corrigió y se repitieron los cuatro recorridos. También se ajustaron el espacio de la mano en mesas de seis y las etiquetas de pilas. Se inspeccionaron capturas de escritorio y móvil. No se observaron errores de JavaScript ni desbordamiento horizontal. En móvil las mesas se apilan y requieren desplazamiento vertical; en los tamaños de escritorio probados caben en la ventana.

## Alcance

Las pruebas usan Chromium local y emulación móvil, no teléfonos físicos ni todos los navegadores. No garantizan ausencia universal de fallos. Las habilidades conservan resolución manual y los atajos no certifican su legalidad. No se desplegaron Render, Docker ni túneles públicos. Los mazos personales permanecen fuera del repositorio.

## Transformaciones y preparación

Se repitieron los cuatro recorridos añadiendo transformación desde la carta, fuerza y protecciones, apertura directa del Castillo y botones bloqueados tras repartir. Pasaron las 43 pruebas del motor, incluidas reversión al próximo turno, Oro sin habilidad y reloj total que conserva su límite al pasar turno. Una prueba adicional de navegador agotó un reloj de diez segundos y verificó que la alarma se generase una sola vez. TypeScript, compilación y revisión estática pasaron.

## Orden del Castillo

Debajo de cada carta consultada, Antes y Después cambian su posición. Guardar orden en el Castillo aplica el orden sin barajar y conserva los lugares de las cartas no consultadas. La posición 1 es la primera entre las cartas consultadas. Mover a… permite trasladar una carta usando el destino elegido en la ventana. Se probaron guardado y robo posterior en el motor y guardado desde escritorio y móvil.

## Intercambio directo en la consulta

Las cartas consultadas se pueden arrastrar sobre otra posición, o mover pulsando Mover de lugar y luego Colocar aquí. El intercambio se guarda automáticamente. Al sacar una carta de la consulta, las restantes siguen disponibles para ordenar sin consultar cartas adicionales. Se verificó el intercambio en cuatro tamaños de mesa y se mantuvieron las 44 pruebas del motor.

## Consulta simplificada

Se sustituyeron los controles repetidos de cada carta por una barra compartida: destino, mover y cambiar posición. Las acciones adicionales están plegadas. El menú del Castillo se oculta durante la consulta y sólo la lista de cartas se desplaza; la barra permanece visible. Se comprobaron cuatro tamaños de pantalla y se inspeccionaron las capturas.

## Taberna, música y distribución

Se incorporó una apariencia cálida de madera y latón, música instrumental original con activación manual, pausa y volumen independiente. El audio se programa en fragmentos cortos y deja de programarse al ocultar la pestaña. La reserva aparece debajo del oro pagado; un aliado llevado al ataque marca la fase Ataque. Se verificaron inicio y pausa musical, orden de las zonas, cuatro tamaños de pantalla y las 44 pruebas del motor.

## Fondos, combate y consultas · 8 de septiembre

Se usan las dos imágenes entregadas como fondos de inicio y mesa. Se restauró mulligan después de repartir y Volver a ocho una vez antes de comenzar, conservando el bloqueo de importación. El nuevo panel de ataque asigna aliados a rivales, suma su fuerza para daño directo, impide repetir un aliado en el turno y envía un aviso con sonido/animación y cantidad efectiva botada. Bloqueos y prevenciones se resuelven manualmente antes de este botón.

Pasaron 46 pruebas del motor y cuatro recorridos de interfaz (dos jugadores, seis jugadores y móvil), incluyendo el aviso al rival, el sonido, la consulta de sólo dos cartas y la privacidad del resto. La música utiliza un reproductor de YouTube a volumen inicial 15; la reproducción requiere disponibilidad externa y puede exigir interacción por las restricciones del navegador. Se corrigió la pausa mientras la API de YouTube todavía carga.

## Respuestas de combate y consulta · 8 de septiembre

El ataque queda pendiente para que cada defensor elija bloqueadores, ajuste daño por atacante o cancele antes de resolver. Puede cerrar el diálogo para jugar efectos y volver con Responder. Las bajas son manuales. Se añadieron filtro por coste, revelado público hasta encontrar Aliado, agrupación de oros pagados y pantalla de derrota con sonido original.

Pasaron 48 pruebas del motor. Cuatro recorridos de navegador cubrieron dos y seis jugadores, escritorio y móvil con movimiento reducido, respuesta al ataque, consultas privadas, revelado a jugadores y espectador, agrupación y derrota. Una comprobación adicional verificó la selección real de un bloqueador y el filtro por coste. Compilación, TypeScript y revisión estática pasaron. Estas comprobaciones no sustituyen pruebas en todos los dispositivos ni automatizan los textos de las cartas.

## Fotos y reverso

Probado en navegador: subir foto, girar, recortar, editar una carta, guardar biblioteca y recuperar su imagen tras recargar. Prueba del motor para preservar imagen al editar texto y ocultarla al rival. Compilación y TypeScript correctos. El recorte es manual y no transcribe habilidades. La captura por cámara depende del dispositivo.
