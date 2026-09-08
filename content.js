// content.js — corre en el mundo ISOLATED, inyectado en la página de la reunión.
// Dibuja el panel flotante, reconoce tu voz (micrófono), traduce texto en ambas
// direcciones y le pide al mundo MAIN (injected-main.js) que reproduzca el audio
// traducido cuando el modo bidireccional está activo.

let settings = null;
let recognition = null;
let running = false;
let panel, captionsEl, statusEl, startBtn;

init();

function init() {
  // Construir el panel PRIMERO, sin esperar nada async: así el botón "Iniciar"
  // siempre aparece y siempre responde, aunque algo falle al cargar ajustes.
  buildPanel();

  loadSettings()
    .then((s) => {
      settings = s;
    })
    .catch((e) => setStatus("⚠️ Error cargando configuración: " + e.message));

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "RT_INCOMING_TRANSCRIPT") {
      handleIncomingTranscript(msg.text);
    } else if (msg.type === "RT_ERROR") {
      setStatus("⚠️ " + msg.message);
    }
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.__rt !== true) return;
    if (event.data.type === "RT_TTS_DONE") {
      setStatus(running ? "Escuchando…" : "Detenido");
    }
  });
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        myLang: "es",
        otherLang: "en",
        deepgramKey: "",
        ttsModel: "aura-2-thalia-en",
        showCaptions: true,
        speakToMe: true,
        bidirectional: false
      },
      resolve
    );
  });
}

// ---------- UI ----------

function buildPanel() {
  panel = document.createElement("div");
  panel.id = "rt-translator-panel";
  panel.innerHTML = `
    <div id="rt-header">
      <span>🌐 Traductor</span>
      <button id="rt-toggle">Iniciar</button>
    </div>
    <div id="rt-status">Detenido</div>
    <div id="rt-captions"></div>
  `;
  document.documentElement.appendChild(panel);

  const style = document.createElement("style");
  style.textContent = `
    #rt-translator-panel {
      position: fixed; bottom: 16px; right: 16px; width: 320px; max-height: 260px;
      background: rgba(20,20,20,0.92); color: #fff; font-family: sans-serif;
      font-size: 13px; border-radius: 10px; z-index: 2147483647; padding: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4); display: flex; flex-direction: column;
    }
    #rt-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-weight:bold; }
    #rt-header button { background:#3b82f6; border:none; color:#fff; padding:4px 10px; border-radius:6px; cursor:pointer; }
    #rt-status { opacity:0.75; margin-bottom:6px; }
    #rt-captions { overflow-y:auto; flex:1; line-height:1.4; }
    #rt-captions p { margin:0 0 6px 0; }
    #rt-captions .them { color:#93c5fd; }
    #rt-captions .me { color:#86efac; }
  `;
  document.documentElement.appendChild(style);

  captionsEl = panel.querySelector("#rt-captions");
  statusEl = panel.querySelector("#rt-status");
  startBtn = panel.querySelector("#rt-toggle");
  startBtn.addEventListener("click", () => (running ? stopAll() : startAll()));
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function addCaption(cls, text) {
  if (!settings.showCaptions || !captionsEl) return;
  const p = document.createElement("p");
  p.className = cls;
  p.textContent = text;
  captionsEl.appendChild(p);
  captionsEl.scrollTop = captionsEl.scrollHeight;
}

// ---------- Arrancar / detener ----------

async function startAll() {
  settings = await loadSettings();
  if (!settings.deepgramKey) {
    setStatus("⚠️ Falta la clave de Deepgram (ábrela desde el ícono de la extensión).");
    return;
  }

  running = true;
  startBtn.textContent = "Detener";
  setStatus("Escuchando…");

  // 1) Pide al background que empiece a transcribir lo que dice la OTRA persona.
  chrome.runtime.sendMessage({
    type: "RT_START_INCOMING",
    sourceLang: settings.otherLang,
    apiKey: settings.deepgramKey
  });

  // 2) Activa (o no) el reemplazo de tu micrófono en el mundo MAIN.
  window.postMessage({ __rt: true, type: "RT_ENABLE", enabled: !!settings.bidirectional }, "*");

  // 3) Reconocimiento de TU voz (micrófono), para traducirla hacia el otro idioma.
  startMyRecognition();
}

function stopAll() {
  running = false;
  startBtn.textContent = "Iniciar";
  setStatus("Detenido");

  chrome.runtime.sendMessage({ type: "RT_STOP_INCOMING" });
  window.postMessage({ __rt: true, type: "RT_ENABLE", enabled: false }, "*");

  if (recognition) {
    recognition.onend = null;
    recognition.stop();
    recognition = null;
  }
}

// ---------- Dirección 1: lo que dice la otra persona -> tu idioma ----------

async function handleIncomingTranscript(foreignText) {
  const translated = await translateText(foreignText, settings.otherLang, settings.myLang);
  addCaption("them", `Ellos: ${translated}`);

  if (settings.speakToMe) {
    speakLocally(translated, settings.myLang);
  }
}

function speakLocally(text, langCode) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = rtLangSpeech(langCode);
  window.speechSynthesis.speak(utter);
}

// ---------- Dirección 2: tu voz -> idioma de la otra persona ----------

function startMyRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setStatus("⚠️ Este navegador no soporta reconocimiento de voz (usa Chrome/Edge).");
    return;
  }

  recognition = new SR();
  recognition.lang = rtLangSpeech(settings.myLang);
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = async (event) => {
    const last = event.results[event.results.length - 1];
    if (!last.isFinal) return;
    const myText = last[0].transcript.trim();
    if (!myText) return;

    const translated = await translateText(myText, settings.myLang, settings.otherLang);
    addCaption("me", `Tú: ${translated}`);

    if (settings.bidirectional) {
      const blob = await ttsDeepgram(translated, settings.otherLang, settings.deepgramKey, settings.ttsModel);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.postMessage({ __rt: true, type: "RT_PLAY_TTS", url }, "*");
      }
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== "no-speech") setStatus("⚠️ Reconocimiento de voz: " + e.error);
  };

  recognition.onend = () => {
    if (running) recognition.start(); // Chrome corta el reconocimiento cada cierto tiempo; lo reiniciamos.
  };

  recognition.start();
}

// ---------- APIs externas ----------

async function translateText(text, sourceCode, targetCode) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetCode}`;
    const res = await fetch(url);
    const data = await res.json();
    return data?.responseData?.translatedText || text;
  } catch (e) {
    return text; // si falla la traducción, mostramos el texto original en vez de nada
  }
}

async function ttsDeepgram(text, targetLangCode, apiKey, ttsModel) {
  try {
    // El "modelo" de voz de Deepgram depende del idioma (p.ej. aura-2-thalia-en,
    // aura-2-selena-es). Revisa developers.deepgram.com/docs/tts-models si el
    // idioma de destino no está entre los que soporta Aura-2 todavía.
    const res = await fetch(`https://api.deepgram.com/v1/speak?model=${encodeURIComponent(ttsModel)}`, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      setStatus("⚠️ Error generando voz traducida (revisa el modelo TTS configurado).");
      return null;
    }
    return await res.blob();
  } catch (e) {
    return null;
  }
}
