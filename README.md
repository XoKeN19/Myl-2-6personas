# Mesa Imperio · Mitos y Leyendas

Mesa digital no oficial para 2 a 6 amigos. Cartas de texto, salas compartidas, mazos JSON, manos privadas y reglas básicas asistidas.

## Iniciar en tu PC

Necesitas Node.js 22 o superior. Desde la carpeta del proyecto:

```powershell
npm ci
npm run build
npm start
```

Abre [la mesa local](http://localhost:3001). En la descarga ZIP compilada basta con `npm start` o doble clic en `INICIAR.cmd`. Mantén el servidor abierto mientras juegan.

## Guardar y compartir mazos

**Mis mazos** está disponible desde el inicio y dentro de una sala.

1. Ponle un nombre al mazo. Crea una plantilla de 50 cartas, añade cartas con el formulario o pega un JSON.
2. **Guardar en mis mazos** conserva la lista en este navegador, para esta dirección del sitio. Guardar otra lista con el mismo nombre la reemplaza.
3. **Exportar JSON completo** descarga todas las definiciones del mazo. **Copiar JSON** permite pegarlas en un mensaje o archivo.
4. Para jugar, entra a una sala, abre Mis mazos, carga la lista guardada y pulsa **Usar este mazo en la sala**, antes de preparar la mano.
5. **Recuperar mazo completo de la sala** obtiene las 50 definiciones originales, incluyendo cartas en Castillo, sin revelar el orden actual. Los cambios de fuerza durante la partida no modifican la fuerza base del mazo; editar una carta inicialmente sin definir sí completa su definición.

Puedes enviar un archivo `.json` a un amigo para que lo importe. Conserva una copia descargada: los mazos locales no viajan automáticamente entre navegadores, dispositivos o una dirección localhost y una URL pública. No hay cuentas ni biblioteca en la nube.

Formato compatible: una lista de cartas, o `{ "version": 1, "name": "Mi mazo", "cards": [...] }`. Cada carta tiene `name`, `type`, `effect`, `race`, `cost` y `strength`. Tipos: Aliado, Arma, Tótem, Talismán u Oro. Se requieren 50 cartas y un Oro sin habilidad o con Oro Inicial para importar en una sala. El mazo no se certifica como legal por raza, edición o banlist.

## Preparación y reglas

- Cada jugador empieza con un Oro inicial y 49 cartas sin definir si no importa un mazo. Preparar mano reparte 8.
- Mulligan normal: devuelve la mano, baraja y roba una carta menos.
- Mulligan excepcional oficial: una vez, si hay uno o ningún Oro; publica los nombres de la mano y conserva su cantidad.
- **Volver a ocho**: regla de la casa solicitada para esta mesa. Devuelve y baraja la mano, roba 8 y sólo puede usarse una vez antes de comenzar. No es el mulligan oficial.
- Las fases avanzan en orden. Desde Vigilia se puede pasar a Final sin atacar.
- El robo normal sólo se permite al final del turno del jugador activo, una vez; no se roba en el primer turno de la partida. No se puede terminar con más de 8 cartas en mano.
- **Robar por efecto** requiere escribir el motivo en la casilla de efecto excepcional; queda en la bitácora y no consume el robo normal.
- Al terminar el turno se agrupan automáticamente los aliados y oros del siguiente jugador. El Oro de Vigilia se limita a uno y debe colocarse antes de otro permanente.
- Ataques y bloqueos se declaran en sus fases. Los aliados deben haber pasado por Agrupación; para Furia u otra excepción escribe su motivo.
- En Asignación de daño, ambos jugadores confirman los efectos y fuerzas. El atacante pulsa **Aplicar daño y destrucciones**: mueve las bajas y sus armas al Cementerio y bota del Castillo defensor el daño calculado, una sola vez por defensor y turno. Modificar cartas invalida las confirmaciones.
- Usa **Todas las mesas** o el nombre del rival para ver sus zonas públicas, cartas y efectos. Las manos rivales y el contenido del Castillo permanecen ocultos.

La aplicación no interpreta el texto de habilidades. Costes y pagos, prioridades de Talismanes, prevención, inmunidades, restricciones de agrupación, transferencia de control y otras excepciones siguen siendo manuales. Para efectos que modifiquen la fuerza, escribe el total actual antes de confirmar. El daño automático es opcional; no lo confirmes si una excepción cambia su resultado. Las salas de más de dos jugadores son una variante de la casa con turnos por orden de entrada y objetivo por atacante.

Documentos oficiales consultados el 6 de septiembre de 2026:

- [DAR Imperio, abril 2026](https://drive.google.com/file/d/1nKsn1ZtcgVa-bCDhKuKiPVhp8urNU6wZ/view)
- [Formato vigente, erratas y documentos](https://blog.myl.cl/como-jugar-imperio/)
- [Banlist](https://blog.myl.cl/banlists-actualizadas/)
- [FAQ por edición](https://blog.myl.cl/faq-preguntas-frecuentes/)

## GitHub y dónde publicar

Repositorio: [XoKeN19/Myl-2-6personas](https://github.com/XoKeN19/Myl-2-6personas).

GitHub guarda el código. La URL del repositorio sirve para descargarlo, pero no abre una partida. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) aloja sitios estáticos; esta mesa necesita un servidor Node para sincronizar jugadores.

### Prueba sin contratar alojamiento: puerto de VS Code

Ejecuta `npm start`, abre la vista Puertos de VS Code y reenvía **3001**. Para que entren tus amigos, usa la visibilidad Pública. Abre la URL HTTPS del túnel y crea la sala desde esa dirección; comparte el enlace de la sala.

Si aparece «Origen no permitido», reinicia el servidor indicando el origen HTTPS exacto del túnel, sin barra final:

```powershell
$env:PUBLIC_ORIGIN="https://TU-ENLACE.devtunnels.ms"
npm start
```

El PC y el túnel deben permanecer encendidos. [Instrucciones de Microsoft](https://code.visualstudio.com/docs/debugtest/port-forwarding).

### URL permanente: GitHub + Render

Se incluye `render.yaml` para conectar este repositorio a Render como Blueprint. Su configuración solicita un servicio Node y un disco persistente de 1 GB. **Esta configuración usa recursos de pago**; revisa el importe en Render antes de desplegar. No se ha contratado ni desplegado un servicio desde este proyecto.

1. En Render, elige New → Blueprint y conecta este repositorio de GitHub.
2. Revisa la configuración y coste. El archivo incluye compilación, arranque y almacenamiento.
3. `PUBLIC_ORIGIN` puede quedar vacío inicialmente. Si el servicio rechaza el origen del navegador, configúralo con la URL HTTPS exacta asignada por Render y reinicia el servicio.
4. Abre la URL del servicio, crea una sala y comparte su enlace.

Las partidas viven en `/var/data/mesa-imperio` en el disco configurado. Los mazos de la biblioteca se guardan en cada navegador y se comparten por JSON. En servicios con disco efímero, las salas pueden perderse al reiniciar; no los uses como almacenamiento permanente.

Referencias: [servicios web](https://render.com/docs/web-services), [discos persistentes](https://render.com/docs/disks), [Blueprint](https://render.com/docs/blueprint-spec).

También se incluye un Dockerfile para proveedores que ejecuten contenedores. Monta un volumen persistente en `/app/data`, configura `PUBLIC_ORIGIN` y publica el puerto 3001. Docker y Render no fueron desplegados en esta entrega.

## Guardado de partidas

Las salas se escriben en `data/rooms.json` en local; al reiniciar se recuperan. Conserva la pestaña o su sesión para retomar tu asiento. No hay recuperación de asientos si se pierde la sesión. `data/`, credenciales, archivos de entorno y mazos personales están excluidos del repositorio. El servidor soporta `PORT`, `API_PORT`, `DATA_DIR` y `PUBLIC_ORIGIN`.

## Desarrollo y verificaciones

```powershell
npm run api
```

En otra terminal:

```powershell
npm run dev
```

Desarrollo: http://localhost:3000. Producción local: http://localhost:3001.

```powershell
npx tsc --noEmit
npm run build
npm test
```

El proyecto incluye Node 22 para evitar un fallo de cierre de Node 24 en Windows durante la compilación. GitHub Actions compila y ejecuta pruebas en cada cambio de main o solicitud de cambios. El catálogo de componentes generado conserva sus avisos de revisión estática; el código propio se comprueba por separado.
