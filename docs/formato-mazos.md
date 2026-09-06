# Dictar un mazo a ChatGPT para Mesa Imperio

Copia este texto y después dicta tus cartas:

---

Quiero crear un archivo JSON importable en la aplicación Mesa Imperio de Mitos y Leyendas. Te dictaré mi mazo en uno o varios mensajes.

Espera a que diga «terminé» antes de generar el archivo definitivo. Conserva un inventario por nombre y número de copias. Si digo «otra copia», aumenta el número; si repito «esta es la segunda copia» después de haber indicado dos copias en total, acláralo para no contarla dos veces.

Cada carta usa exactamente estos campos:

- `name`: nombre de la carta, texto.
- `type`: uno de `Aliado`, `Arma`, `Tótem`, `Talismán` u `Oro`.
- `effect`: habilidad completa como texto, incluyendo Furia, Exhumar, Única y otras palabras clave.
- `race`: raza dictada del Aliado; cadena vacía si no se indica. No inventes la raza. Para cartas sin raza indicada, explica aparte que falta el dato.
- `cost`: coste numérico entero; para los Oros usa 0.
- `strength`: fuerza base numérica entera; para cartas que no son Aliados usa 0. No sumes aquí bonificaciones de armas u otras cartas.

Entrega un objeto con esta estructura:

```json
{
  "version": 1,
  "name": "Nombre de mi mazo",
  "cards": [
    {
      "name": "Nombre del Oro inicial",
      "type": "Oro",
      "effect": "Oro Inicial. Texto de su habilidad.",
      "race": "",
      "cost": 0,
      "strength": 0
    }
  ]
}
```

Este ejemplo muestra una sola carta para explicar el formato; no es un mazo completo.

Reglas de entrega:

1. El mazo completo debe tener 50 objetos en `cards`, contando el Oro inicial. Expande las copias: tres Karna son tres objetos completos, no un objeto con `quantity`.
2. Pon primero el Oro inicial elegido. Si tiene habilidad, incluye literalmente `Oro Inicial` dentro de `effect` para que la aplicación lo identifique.
3. No añadas cartas de relleno, no elimines cartas y no ajustes copias para llegar a 50 sin preguntarme.
4. No reescribas un efecto dudoso suponiendo lo que debería decir. Pregúntame por diferencias como «muestra/juega», «una/esta carta», cantidades, zonas, objetivos y duraciones. Conserva los nombres tal como los dicto salvo que yo confirme una corrección.
5. No incluyas comentarios, comas finales, instrucciones de programa ni campos de partida como id, zone, token, attachedTo, statuses o modifiers.
6. Al terminar, comprueba que el JSON es válido y muestra el conteo por tipo de carta y las copias repetidas. Si falta información, entrega por separado la lista de dudas; no la mezcles con el efecto de la carta.
7. Dame un archivo `.json` descargable si es posible; si no, un bloque de código JSON que pueda copiar sin texto adicional dentro.
8. No afirmes que el mazo es legal para un formato o que sus textos están actualizados: esta tarea transcribe mi dictado. Una comprobación oficial sería otra tarea.

Mis cartas son:

[Ahora voy a dictarlas.]

---

## Importarlo

Abre **Mis mazos**, importa el archivo o pega su contenido, y pulsa **Guardar en mis mazos**. Dentro de una sala, antes de repartir la mano, pulsa **Usar este mazo en la sala**. Para llevarlo a otro equipo utiliza **Exportar JSON completo**.
