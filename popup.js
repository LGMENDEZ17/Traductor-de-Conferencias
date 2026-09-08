const DEFAULTS = {
  myLang: "es",
  otherLang: "en",
  deepgramKey: "",
  ttsModel: "aura-2-thalia-en",
  showCaptions: true,
  speakToMe: true,
  bidirectional: false
};

function showPopupError(msg) {
  let el = document.getElementById("rt-error");
  if (!el) {
    el = document.createElement("p");
    el.id = "rt-error";
    el.style.cssText =
      "color:#dc2626;font-weight:bold;background:#fee2e2;padding:6px;border-radius:6px;margin-top:8px;";
    document.body.appendChild(el);
  }
  el.textContent = "⚠️ " + msg;
}

const myLangEl = document.getElementById("myLang");
const otherLangEl = document.getElementById("otherLang");

// 1) Registrar el botón Guardar YA, antes de tocar chrome.storage, para que
//    funcione aunque algo falle más abajo al cargar la configuración guardada.
document.getElementById("save").addEventListener("click", () => {
  try {
    const settings = {
      myLang: myLangEl.value,
      otherLang: otherLangEl.value,
      deepgramKey: document.getElementById("deepgramKey").value.trim(),
      ttsModel: document.getElementById("ttsModel").value.trim() || DEFAULTS.ttsModel,
      showCaptions: document.getElementById("showCaptions").checked,
      speakToMe: document.getElementById("speakToMe").checked,
      bidirectional: document.getElementById("bidirectional").checked
    };
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        showPopupError("No se pudo guardar: " + chrome.runtime.lastError.message);
        return;
      }
      const msg = document.getElementById("savedMsg");
      msg.style.display = "block";
      setTimeout(() => (msg.style.display = "none"), 1200);
    });
  } catch (e) {
    showPopupError("Error al guardar: " + e.message);
  }
});

// 2) Llenar el formulario con los idiomas disponibles y, si existe, la
//    configuración ya guardada. Si algo aquí falla, el botón Guardar de
//    arriba sigue funcionando igual.
try {
  RT_LANGS.forEach((l) => {
    myLangEl.add(new Option(l.label, l.code));
    otherLangEl.add(new Option(l.label, l.code));
  });

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    if (chrome.runtime.lastError) {
      showPopupError("No se pudo cargar la configuración: " + chrome.runtime.lastError.message);
      return;
    }
    myLangEl.value = settings.myLang;
    otherLangEl.value = settings.otherLang;
    document.getElementById("deepgramKey").value = settings.deepgramKey;
    document.getElementById("ttsModel").value = settings.ttsModel;
    document.getElementById("showCaptions").checked = settings.showCaptions;
    document.getElementById("speakToMe").checked = settings.speakToMe;
    document.getElementById("bidirectional").checked = settings.bidirectional;
  });
} catch (e) {
  showPopupError("Error inicializando el popup: " + e.message);
}
