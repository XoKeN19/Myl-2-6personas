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
- Al repartir ocho se bloquean la recarga del mazo, los mulligan y Volver a ocho. Es la configuración de la casa solicitada; los movimientos por efectos siguen siendo libres.
- **Transformar esta carta** permite elegir tipo, fuerza, efecto (vacío para quitarlo), protecciones y duración. Gema del grifo propone Aliado de fuerza 4, Indestructible e Indesterrable hasta tu próximo turno. Los jugadores comprueban las condiciones antes de aplicarlo.
- **Opciones de partida** permite configurar minutos por turno o para toda la partida y guardar el reloj para que arranque al comenzar. El tiempo total no se reinicia al pasar turno. Los sonidos incluyen alarma, ataque, Cementerio, Destierro y barajado.
- Las fases son una guía visible y cualquier jugador puede elegirlas libremente. La mesa no bloquea una jugada por la fase actual.
- Robar y pasar turno son libres. Los jugadores resuelven costes, límites de mano, daño y agrupación manualmente.
- Arrastra cartas a las zonas o pulsa una carta para abrir sus acciones, coste, fuerza y efecto. Arrastrar un arma sobre un aliado permite equiparla.
- Jugar desde la mano sugiere Vigilia. Mover al ataque abre Guerra de Talismanes como atajo de la casa; pueden corregir la fase. La secuencia oficial distingue declaración de ataque, bloqueo y guerra.
- Pulsa Castillo para robar primera o última, barajar, mirar, buscar y colocar cartas arriba o abajo. Las opciones de cantidades están plegadas.
- Las manos rivales muestran reversos. Solicitar una consulta abre una ventana de aceptación al propietario; sólo el solicitante obtiene acceso. Un espectador no recibe ese contenido privado.
- El temporizador compartido se puede iniciar, pausar y reiniciar. Llegar a cero no fuerza acciones. El sonido es opcional mediante el icono del altavoz.
- Las animaciones de movimiento, robo y barajado usan el motor 2D del navegador, sin renderizado continuo. Respetan la preferencia de movimiento reducido.
- Las mesas se acomodan dentro de la ventana y cada zona tiene desplazamiento propio. Haz clic en el nombre de una zona para abrir todas sus cartas en una ventana flotante. Las manos rivales y el contenido del Castillo permanecen ocultos.

La aplicación detecta palabras frecuentes del texto —Robar, Castillo, Cementerio, Desterrar y Barajar— y ofrece atajos al abrir una carta. No decide si se cumplen sus condiciones. Costes, pagos, prioridades, prevención y daño siguen bajo control de los jugadores. Las salas de más de dos jugadores son una variante de la casa con turnos por orden de entrada.

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

## Habilidades: consultas, cartas mostradas y acciones por efecto

Abre **Resolver un efecto**. Indica el nombre de la carta o habilidad, selecciona el jugador, la zona y las cartas. Para tus propias cartas, la acción se aplica directamente. Para las de otro jugador, se envía una solicitud que éste debe autorizar.

- **Buscar en mi Castillo** permite seleccionar cartas sin mostrar el orden real del mazo; **Mirar primeras N** muestra únicamente ese tope, en orden, de forma privada.
- Para mirar una mano o buscar en el Castillo rival, pide permiso y espera a que ese jugador autorice la consulta. No se comparte con espectadores ni con otros jugadores. El permiso se puede retirar y se cierra al cambiar de turno.
- **Mostrar a todos** hace visibles las cartas seleccionadas en mano o Castillo, incluidas para espectadores. **Dejar de mostrar** las oculta; los jugadores pueden recordar lo que ya vieron. Moverlas o barajar las oculta nuevamente.
- **Devolver al Castillo y barajar** funciona con cartas seleccionadas del Cementerio, Mano u otras zonas. Puedes seleccionar varias, o todas. La selección no se duplica.
- **Poner en el tope/fondo** permite ordenar las cartas con las flechas antes de confirmar.
- **Mover/jugar por efecto** permite ejecutar búsqueda, Exhumar, jugar desde Cementerio o Castillo y efectos fuera de las fases normales. El motivo queda registrado. El pago de costes y las condiciones del texto siguen siendo responsabilidad de los jugadores.
- **Transformar** cambia tipo, fuerza base y texto de juego conservando la definición del mazo. Puedes transformar Oricalón en Arma y luego usar **Equipar por efecto**. Al salir del juego recupera su forma original.
- **Modificar fuerza** suma o resta a una o varias cartas. Puede durar permanentemente, hasta el fin del turno actual o hasta el próximo turno de su controlador. Los modificadores temporales expiran automáticamente y se usan en el cálculo de combate.
- **Aplicar estado** permite marcar Furia, Indestructible, Indesterrable, Imbloqueable, sin habilidad, impedimento de ataque/bloqueo y protección. Los primeros cinco controles de combate correspondientes actúan sobre las acciones básicas; sin habilidad y protegido son recordatorios para resolver el texto manualmente. Los estados no se deducen del texto de las cartas.
- **Elegir bloqueador / Retador** permite proponer el bloqueador para un ataque; el dueño de la carta debe aprobarlo si es ajena. **Cancelar ataque** retira la asignación de combate dejando al Aliado en Ataque.
- **Cambiar controlador** permite, por ejemplo, que el dueño de un Oro en Cementerio lo ponga en la Reserva del otro jugador por Antonio Pincheira. La carta conserva a su propietario y vuelve a la zona de éste al salir del juego.
- Puedes registrar usos de una habilidad con límite por turno (por ejemplo, tres para Dampir), y generar o gastar Oro temporal. Los contadores se reinician al cambiar de turno; no se activan solos por leer una carta.

Las bonificaciones de Armas, aumentos globales, costes adicionales, prevención y reglas persistentes no se interpretan automáticamente. Selecciona las cartas, aplica los modificadores/estados y registra los acuerdos. No se ejecuta un programa contenido en el JSON de cartas.

Ejemplos: para Karna, busca en tu Castillo, selecciona el Aliado y muévelo a Mano; para Signo amarillo, mira cuatro, mueve las elegidas y ordena el resto; para Wotishir o Purificar Alma, selecciona las cartas por jugador y pide aprobación al rival; para Xi, usa Mover/jugar por efecto o Equipar por efecto desde Mano/Cementerio.

Si ya resolvieron un daño especial manualmente, ambos confirman y el atacante usa **Cerrar combate ya resuelto manualmente**, indicando el motivo. Esto evita aplicar el daño básico una segunda vez.

## Modo espectador

Desde el inicio, introduce el código y pulsa **Entrar como espectador**. También puedes compartir **Invitar espectador** desde la sala. Se puede entrar con la partida comenzada y con los seis asientos ocupados. Los espectadores no ocupan asientos de jugador.

La vista se actualiza aproximadamente cada segundo. Muestra zonas públicas, cartas reveladas, turnos y bitácora. No muestra manos ocultas, orden del Castillo, consultas privadas, credenciales ni mazos completos de los jugadores, y el servidor rechaza sus acciones de juego. El contador indica accesos de espectadores registrados, no presencia exacta en línea.

Para pedirle a ChatGPT un archivo de mazo, usa [el formato de dictado](docs/formato-mazos.md).

El estado No puede jugarse sirve para restricciones como Chakram. Para efectos hasta tu próximo turno, el selector permite elegir el jugador cuyo siguiente turno termina la duración, incluso si la carta afectada pertenece al rival.
