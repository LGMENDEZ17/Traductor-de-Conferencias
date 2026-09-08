// Lista de idiomas soportados.
// - code: código ISO-639-1 de dos letras, usado para traducción (MyMemory) y Deepgram.
// - speech: código BCP-47 usado por SpeechRecognition / speechSynthesis / Deepgram TTS.
// - label: nombre visible en la interfaz.
//
// Puedes agregar más idiomas aquí; solo asegúrate de que "code" coincida con lo
// que espera la API de traducción y que "speech" sea un código BCP-47 válido.
const RT_LANGS = [
  { code: "es", speech: "es-CO", label: "Español" },
  { code: "en", speech: "en-US", label: "Inglés" },
  { code: "pt", speech: "pt-BR", label: "Portugués" },
  { code: "fr", speech: "fr-FR", label: "Francés" },
  { code: "de", speech: "de-DE", label: "Alemán" },
  { code: "it", speech: "it-IT", label: "Italiano" },
  { code: "zh", speech: "zh-CN", label: "Chino (mandarín)" },
  { code: "ja", speech: "ja-JP", label: "Japonés" },
  { code: "ko", speech: "ko-KR", label: "Coreano" },
  { code: "ar", speech: "ar-SA", label: "Árabe" },
  { code: "ru", speech: "ru-RU", label: "Ruso" }
];

function rtLangSpeech(code) {
  const found = RT_LANGS.find((l) => l.code === code);
  return found ? found.speech : code;
}
