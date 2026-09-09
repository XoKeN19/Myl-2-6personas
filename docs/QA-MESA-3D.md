# Verificación de mesa cenital — 9 de septiembre de 2026

Babylon.js 9.25.0, cámara ortográfica vertical. Se preserva el servidor existente.

Verificaciones realizadas sobre la compilación de producción, con Chromium y WebGL mediante SwiftShader:

1. Arrastrar un Aliado de Defensa a Ataque actualiza el servidor; soltar un Arma sobre el Aliado la equipa. Doble clic paga un Oro y roba del Castillo.
2. Dos sesiones independientes ven el movimiento público; las manos rivales no contienen nombres ni imágenes en la respuesta. Los menús de Mano y Castillo abren correctamente. Una foto de prueba con rótulos ARRIBA/ABAJO se ve derecha y permite ampliar la imagen.
3. Vista a 1600×1000, 1280×720 y 390×844, sin desbordamiento horizontal de la página. Sala de seis jugadores y cambios repetidos de enfoque sin errores de ejecución.
4. Con WebGL deshabilitado aparece recuperación a la vista clásica, sin perder la sala.

Además: 49 pruebas de servidor/reglas aprobadas, TypeScript sin errores, compilación completa y análisis estático de los nuevos archivos 3D aprobado. La compilación advierte del tamaño del módulo gráfico; se carga de forma diferida al abrir la partida.

Límites: las pruebas gráficas utilizan renderizado por software y no acreditan rendimiento en todas las GPU. En móvil o con seis jugadores conviene enfocar una mesa y ampliar cartas para leer habilidades. El juego conserva la resolución manual de efectos y daños; no se ha incorporado Colyseus ni un motor de físicas.
