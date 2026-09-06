# Verificación de la versión

- Compilación de producción y TypeScript comprobados.
- Pruebas del motor: preparación, privacidad, sesión, mulligan normal, excepcional y de la casa, robo una vez y por fase, excepción documentada, Oro inicial de Vigilia, ataques, armas, daño directo confirmado, invalidación de confirmaciones y exportación completa.
- Prueba HTTP con seis clientes: sala llena, privacidad, mazo completo propio, rechazo de origen externo, guardado y recuperación tras reiniciar, página y recursos compilados.
- Revisión estática del código propio sin errores. Se conserva el catálogo generado sin modificar sus avisos preexistentes.
- Sin prueba visual/interactiva de navegador ni validación en contexto WebMCP.
- El alojamiento de Render, Docker y un túnel público no se han ejecutado. La configuración se entrega preparada para revisión y despliegue por el propietario.
- La aplicación automatiza las reglas básicas indicadas en README; no es un motor completo de todas las habilidades.

## Ampliación de habilidades y espectadores

Se añadieron pruebas de privacidad del espectador y consultas, consentimiento para efectos ajenos, rechazo de solicitudes obsoletas, selección múltiple y barajado, orden del tope/fondo, fuerza y estados temporales, transformación, control y propiedad de cartas, y límites de usos. El flujo HTTP prueba también entrada del espectador con sala llena y rechazo de escritura/exportación privada.

No se ha realizado QA visual/interactiva en navegador. Las cartas dictadas se validan como datos JSON; sus textos no se han cotejado contra un catálogo oficial. Los mazos personales se entregan fuera del repositorio público.
