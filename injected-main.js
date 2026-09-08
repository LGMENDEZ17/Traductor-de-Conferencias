// injected-main.js — corre en el contexto "MAIN" (el mismo mundo JS que Meet/Teams/Zoom).
//
// Esto es necesario porque un content script normal (mundo "ISOLATED") NO puede
// interceptar las llamadas que la propia página hace a getUserMedia: cada mundo
// tiene su propio objeto `navigator`, así que hay que sobreescribirlo aquí.
//
// Idea central: en vez de "cambiar" el track que ya se le entregó a la reunión,
// devolvemos un track que sale de un AudioContext.MediaStreamDestination fijo.
// Ese track NUNCA cambia — lo que cambia es qué se conecta a él por dentro
// (tu micrófono real, o el audio de la voz traducida). Así evitamos tener que
// tocar la conexión WebRTC de la reunión, que no controlamos.

(() => {
  const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  let enabled = false; // se activa/desactiva desde el popup ("modo bidireccional")
  let ctx = null;
  let dest = null;
  let micGainNode = null;
  let ttsAudioEl = null;

  function ensureGraph(realMicStream) {
    if (ctx) return;
    ctx = new AudioContext();
    dest = ctx.createMediaStreamDestination();

    const micSource = ctx.createMediaStreamSource(realMicStream);
    micGainNode = ctx.createGain();
    micGainNode.gain.value = 1; // por defecto, tu voz real pasa normal
    micSource.connect(micGainNode).connect(dest);

    ttsAudioEl = document.createElement("audio");
    ttsAudioEl.style.display = "none";
    document.documentElement.appendChild(ttsAudioEl);
  }

  navigator.mediaDevices.getUserMedia = async function (constraints) {
    const realStream = await realGetUserMedia(constraints);

    if (!enabled || !constraints || !constraints.audio) {
      return realStream; // sin cambios si la función está apagada o no piden audio
    }

    ensureGraph(realStream);

    const outTracks = [...dest.stream.getAudioTracks()];
    realStream.getVideoTracks().forEach((t) => outTracks.push(t));
    return new MediaStream(outTracks);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.__rt !== true) return;
    const msg = event.data;

    if (msg.type === "RT_ENABLE") {
      enabled = !!msg.enabled;
    } else if (msg.type === "RT_PLAY_TTS" && ctx && ttsAudioEl) {
      playTranslatedAudio(msg.url);
    }
  });

  function playTranslatedAudio(blobUrl) {
    // Silencia tu voz real mientras se reproduce la traducción sintetizada,
    // y la conecta al mismo destino que recibe la reunión.
    micGainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.05);

    ttsAudioEl.src = blobUrl;
    // createMediaElementSource solo puede llamarse una vez por elemento,
    // así que reutilizamos el mismo <audio> y su nodo fuente.
    if (!ttsAudioEl._rtSource) {
      ttsAudioEl._rtSource = ctx.createMediaElementSource(ttsAudioEl);
      ttsAudioEl._rtSource.connect(dest);
    }
    ttsAudioEl.currentTime = 0;
    ttsAudioEl.play();

    ttsAudioEl.onended = () => {
      micGainNode.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
      window.postMessage({ __rt: true, type: "RT_TTS_DONE" }, "*");
      URL.revokeObjectURL(blobUrl);
    };
  }
})();
