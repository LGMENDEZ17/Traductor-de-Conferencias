# Traductor de Reuniones en Tiempo Real

Extensión de Chrome/Edge que traduce en vivo lo que se dice en reuniones de
**Google Meet, Microsoft Teams y Zoom (versión web)**, en las dos direcciones:

- Lo que dice la otra persona → se traduce a tu idioma (subtítulos + voz para ti).
- Lo que dices tú → se traduce al idioma de la otra persona y puede reemplazar
  tu micrófono, para que la otra persona te escuche traducido (modo bidireccional).

## 1. Instalar la extensión (modo desarrollador)

1. Descomprime esta carpeta en tu computador.
2. Abre `chrome://extensions` (o `edge://extensions`).
3. Activa "Modo de desarrollador" (arriba a la derecha).
4. Clic en "Cargar descomprimida" y selecciona esta carpeta.
5. Verás el ícono 🌐 en la barra de extensiones.

## 2. Consigue una clave de API de Deepgram (gratis)

Se usa para transcribir la voz de la otra persona y para generar tu voz
traducida. Deepgram regala **$200 de crédito** al crear la cuenta, sin pedir
tarjeta — de sobra para probar esta herramienta durante bastante tiempo.

1. Crea una cuenta en https://deepgram.com
2. Ve a la consola → "API Keys" → crea una clave.
3. Pégala en el popup de la extensión (ícono 🌐 → "Clave de API de Deepgram").

## 3. Configura los idiomas y guarda

Abre el popup, elige "Tu idioma" y "Idioma de la otra persona", y guarda.
Si vas a usar el modo bidireccional, revisa que el campo "Modelo de voz TTS"
tenga una voz válida para el idioma de la otra persona (por defecto viene
`aura-2-thalia-en` para inglés; para español prueba con una voz `-es`, revisa
el catálogo actual en developers.deepgram.com/docs/tts-models).

## 4. Úsala en la reunión

1. Entra a la reunión **desde el navegador** (no la app de escritorio) —
   en Zoom usa el enlace "Unirse desde el navegador" en vez de abrir la app.
2. Verás un panel flotante abajo a la derecha. Clic en "Iniciar".
3. Autoriza el uso del micrófono si el navegador lo pide.

## Los 3 niveles, y cómo activarlos

| Nivel | Qué hace | Cómo activarlo |
|---|---|---|
| 1. Subtítulos | Ves traducido lo que dice el otro | Activado por defecto ("Mostrar subtítulos") |
| 2. Voz para ti | Tu compu te lee la traducción en voz alta | Activado por defecto ("Leerme en voz alta") |
| 3. Bidireccional | El otro también te escucha traducido | Casilla "Modo bidireccional" en el popup (**apagada por defecto**) |

## Limitaciones importantes (léelas antes de usarlo en algo importante)

- **Solo funciona en la versión web (navegador)** de Meet/Teams/Zoom. Las apps
  de escritorio no pasan por `getUserMedia`, así que el modo bidireccional no
  las puede interceptar.
- **Hay latencia**: transcribir + traducir + sintetizar voz toma unos
  segundos. No es instantáneo como hablar directo — esto es normal incluso en
  las herramientas nativas de Meet/Teams/Zoom (varias siguen etiquetando su
  traducción de voz como "beta").
- **La voz sintetizada no es la tuya**: se oye como una voz de Deepgram, no
  con tu tono. Es el mismo compromiso que hacen las herramientas comerciales
  de este tipo.
- **Aura-2 (TTS) no cubre todos los idiomas todavía** (por ahora: inglés,
  español, holandés, francés, alemán, italiano, japonés — Deepgram sigue
  agregando más). Si tu idioma de destino no está en la lista, usa solo los
  niveles 1 y 2 por ahora.
- **Revisa los Términos de Servicio** de la plataforma que uses (sobre todo
  Zoom) respecto a herramientas de terceros que procesan el audio de la
  llamada — recomendable úsalo en reuniones propias o donde tengas permiso.
- Prueba el modo bidireccional en una **llamada de prueba contigo mismo o con
  alguien de confianza** antes de depender de él en una reunión real, por si
  el micrófono queda mudo por algún error.

## Cómo pedir mejoras

Este es un v0.1 funcional pero perfectible. Ideas para siguientes pasos:
- Detección automática de silencio (VAD) más fina para cortar mejor las frases.
- Selector de voces por nombre en vez de escribir el ID del modelo a mano.
- Guardar el historial de subtítulos de la reunión.
- Empaquetarlo y subirlo a tu repositorio de GitHub para llevar control de versiones.
