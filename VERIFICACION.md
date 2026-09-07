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
