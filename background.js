// background.js — service worker (MV3)
//
// Este archivo NO hace transcripción ni audio directamente (un service worker
// no puede usar AudioContext/getUserMedia). Su trabajo es:
//   1. Recibir la orden de "iniciar" desde content.js (tab de la reunión).
//   2. Pedir un streamId de la pestaña con chrome.tabCapture.
//   3. Crear (si no existe) el "offscreen document" y pasarle ese streamId.
//   4. Reenviar los mensajes entre offscreen.js <-> content.js de la pestaña correcta.

const OFFSCREEN_PATH = "offscreen.html";
let activeTabId = null; // pestaña de la reunión que está capturando en este momento

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });
  if (existing.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["USER_MEDIA"],
    justification:
      "Capturar el audio entrante de la reunión (tabCapture) y transmitirlo a la API de reconocimiento de voz."
  });
}

async function closeOffscreenDocumentIfAny() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"]
  });
  if (existing.length > 0) {
    await chrome.offscreen.closeDocument();
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse);
  return true; // respuesta asíncrona
});

async function handleMessage(msg, sender) {
  switch (msg.type) {
    case "RT_START_INCOMING": {
      // Viene desde content.js de la pestaña de la reunión.
      const tabId = sender.tab && sender.tab.id;
      if (!tabId) return { ok: false, error: "Sin tabId" };

      activeTabId = tabId;

      let streamId;
      try {
        streamId = await chrome.tabCapture.getMediaStreamId({
          targetTabId: tabId
        });
      } catch (e) {
        return { ok: false, error: "No se pudo capturar la pestaña: " + e.message };
      }

      await ensureOffscreenDocument();

      chrome.runtime.sendMessage({
        type: "OFFSCREEN_START",
        streamId,
        tabId,
        sourceLang: msg.sourceLang, // idioma que habla la OTRA persona
        apiKey: msg.apiKey
      });

      return { ok: true };
    }

    case "RT_STOP_INCOMING": {
      chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
      await closeOffscreenDocumentIfAny();
      activeTabId = null;
      return { ok: true };
    }

    case "OFFSCREEN_TRANSCRIPT": {
      // Viene desde offscreen.js -> reenviar al content script de la pestaña de reunión
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          type: "RT_INCOMING_TRANSCRIPT",
          text: msg.text
        });
      }
      return { ok: true };
    }

    case "OFFSCREEN_ERROR": {
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, {
          type: "RT_ERROR",
          message: msg.message
        });
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: "Mensaje no reconocido: " + msg.type };
  }
}
