// offscreen.js
//
// Corre dentro del "offscreen document" (una página invisible que Chrome permite
// para tareas que necesitan APIs de audio/DOM que un service worker no tiene).
//
// Tarea: tomar el audio de la pestaña de la reunión (lo que tú ESCUCHAS, es decir
// la voz de la otra persona) y transmitirlo en vivo a Deepgram para transcribirlo.
// El texto transcrito (en el idioma de la otra persona) se manda de vuelta al
// background, que lo reenvía al content script para traducirlo y mostrarlo/leerlo.
//
// ⚠️ Verifica siempre la documentación vigente de Deepgram (streaming quickstart)
// por si cambian el esquema de autenticación por WebSocket o los parámetros.
// https://developers.deepgram.com/docs/live-streaming-audio

let audioContext = null;
let processorNode = null;
let sourceNode = null;
let mediaStream = null;
let socket = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "OFFSCREEN_START") {
    startCapture(msg).catch((e) => reportError(e.message));
  } else if (msg.type === "OFFSCREEN_STOP") {
    stopCapture();
  }
});

async function startCapture({ streamId, sourceLang, apiKey }) {
  stopCapture(); // por si quedó algo de una sesión anterior

  if (!apiKey) {
    reportError("Falta la clave de API de Deepgram (configúrala en el popup de la extensión).");
    return;
  }

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId
      }
    }
  });

  // Importante: para que sigas ESCUCHANDO la reunión con normalidad, hay que
  // volver a reproducir el audio capturado (tabCapture "silencia" la pestaña
  // por defecto una vez que alguien la captura).
  audioContext = new AudioContext();
  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  sourceNode.connect(audioContext.destination); // te lo vuelve a poner en los parlantes

  const sampleRate = audioContext.sampleRate;

  const wsUrl =
    `wss://api.deepgram.com/v1/listen?language=${encodeURIComponent(sourceLang)}` +
    `&model=nova-2&encoding=linear16&sample_rate=${sampleRate}` +
    `&smart_format=true&interim_results=false&punctuate=true`;

  // Autenticación por WebSocket: Deepgram documenta el uso de un subprotocolo
  // ["token", API_KEY] para clientes de navegador (que no pueden mandar headers
  // personalizados). Si Deepgram cambia esto, este es el único lugar a ajustar.
  socket = new WebSocket(wsUrl, ["token", apiKey]);
  socket.binaryType = "arraybuffer";

  socket.onerror = () => reportError("Error de conexión con Deepgram (revisa tu clave de API).");

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const alt = data?.channel?.alternatives?.[0];
      const transcript = alt?.transcript;
      if (transcript && transcript.trim() && data.is_final) {
        chrome.runtime.sendMessage({ type: "OFFSCREEN_TRANSCRIPT", text: transcript });
      }
    } catch (e) {
      // ignorar mensajes que no son JSON de transcripción (p.ej. metadata)
    }
  };

  socket.onopen = () => {
    // Procesa el audio en bloques y lo envía como PCM 16-bit al socket.
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);

    processorNode.onaudioprocess = (e) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = floatTo16BitPCM(float32);
      socket.send(int16.buffer);
    };
  };
}

function floatTo16BitPCM(float32Array) {
  const out = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function stopCapture() {
  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (socket) {
    try {
      socket.close();
    } catch (e) {}
    socket = null;
  }
}

function reportError(message) {
  chrome.runtime.sendMessage({ type: "OFFSCREEN_ERROR", message });
}
