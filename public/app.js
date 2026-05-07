const form = document.querySelector("#translateForm");
const result = document.querySelector("#result");
const status = document.querySelector("#status");
const submitButton = document.querySelector("#submitButton");
const downloadJsonButton = document.querySelector("#downloadJsonButton");
const inputType = document.querySelector("#inputType");
const textInputWrap = document.querySelector("#textInputWrap");
const jsonInputWrap = document.querySelector("#jsonInputWrap");
const textInput = document.querySelector('textarea[name="text"]');
const jsonFile = document.querySelector("#jsonFile");
const promptModel = document.querySelector("#promptModel");
const customPromptWrap = document.querySelector("#customPromptWrap");
const customPromptModel = document.querySelector("#customPromptModel");
const glossaryInput = document.querySelector("#glossaryInput");
const glossaryFileInput = document.querySelector("#glossaryFileInput");
const loadGlossaryButton = document.querySelector("#loadGlossaryButton");
const downloadGlossaryButton = document.querySelector("#downloadGlossaryButton");
const openGlossaryEntryButton = document.querySelector("#openGlossaryEntryButton");
const glossaryOverlay = document.querySelector("#glossaryOverlay");
const glossaryEntryForm = document.querySelector("#glossaryEntryForm");
const glossarySourceInput = document.querySelector("#glossarySourceInput");
const glossaryTargetInput = document.querySelector("#glossaryTargetInput");
const closeGlossaryEntryButton = document.querySelector("#closeGlossaryEntryButton");
const cancelGlossaryEntryButton = document.querySelector("#cancelGlossaryEntryButton");
const promptPreview = document.querySelector("#promptPreview");
const modelSelect = document.querySelector("#model");
const sourceLanguageSelect = document.querySelector("#sourceLanguage");
const targetLanguageSelect = document.querySelector("#targetLanguage");

const locales = [
  "unknown",
  "English",
  "Portuguese",
  "Brazilian Portuguese",
  "European Portuguese",
  "Japanese",
  "Spanish",
  "Latin American Spanish",
  "French",
  "German",
  "Italian",
  "Korean",
  "Simplified Chinese",
  "Traditional Chinese",
  "Russian",
  "Polish",
  "Dutch",
  "Turkish",
  "Arabic",
  "Hindi",
  "Thai",
  "Vietnamese",
  "Indonesian",
];

let promptModels = {};
let lastTranslatedJsonFiles = [];
let promptPreviewRequestId = 0;

function updateCustomPromptVisibility() {
  const isCustom = promptModel.value === "custom";

  customPromptWrap.hidden = !isCustom;
  customPromptWrap.classList.toggle("is-hidden", !isCustom);
  customPromptModel.disabled = !isCustom;
}

function updateInputTypeVisibility() {
  const isJson = inputType.value === "json";

  textInputWrap.hidden = isJson;
  textInputWrap.classList.toggle("is-hidden", isJson);
  textInput.disabled = isJson;
  textInput.required = !isJson;

  jsonInputWrap.hidden = !isJson;
  jsonInputWrap.classList.toggle("is-hidden", !isJson);
  jsonFile.disabled = !isJson;
  jsonFile.required = isJson;
}

async function updatePromptPreview() {
  const requestId = ++promptPreviewRequestId;
  const data = new FormData(form);
  const sourceLanguage = String(data.get("sourceLanguage") || "unknown");
  const targetLanguage = String(
    data.get("targetLanguage") || "Brazilian Portuguese",
  );
  const text =
    inputType.value === "json"
      ? await getFirstJsonTextForPreview()
      : String(data.get("text") || "");
  const glossary = parseGlossaryInput(false);
  const template =
    promptModel.value === "custom"
      ? customPromptModel.value
      : promptModels[promptModel.value] || promptModels.default || "";

  if (requestId !== promptPreviewRequestId) {
    return;
  }

  promptPreview.textContent = template
    .replaceAll("{sourceLanguage}", sourceLanguage)
    .replaceAll("{targetLanguage}", targetLanguage)
    .replaceAll("{glossary}", formatGlossary(glossary, text))
    .replaceAll("{text}", text);
}

async function loadPromptModels() {
  try {
    const response = await fetch("/api/prompt-models");
    promptModels = await response.json();
  } catch {
    promptModels = {};
  }

  updatePromptPreview();
}

async function loadOllamaModels() {
  try {
    const response = await fetch("/api/tags");
    const json = await response.json();
    const models = Array.isArray(json.models) ? json.models : [];

    modelSelect.textContent = "";

    for (const model of models) {
      if (!model.name) {
        continue;
      }

      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      modelSelect.append(option);
    }

    if (modelSelect.options.length === 0) {
      throw new Error("No models returned");
    }
  } catch {
    modelSelect.textContent = "";

    const option = document.createElement("option");
    option.value = "translategemma:4b";
    option.textContent = "translategemma:4b";
    modelSelect.append(option);
  }
}

function loadLanguagePresets() {
  sourceLanguageSelect.textContent = "";
  targetLanguageSelect.textContent = "";

  for (const locale of locales) {
    const sourceOption = document.createElement("option");
    sourceOption.value = locale;
    sourceOption.textContent = locale;
    sourceLanguageSelect.append(sourceOption);

    const targetOption = document.createElement("option");
    targetOption.value = locale;
    targetOption.textContent = locale;
    targetLanguageSelect.append(targetOption);
  }

  sourceLanguageSelect.value = "unknown";
  targetLanguageSelect.value = "Brazilian Portuguese";
}

function buildPrompt(sourceLanguage, targetLanguage, text) {
  return [
    "Translate the following text from " +
      sourceLanguage +
      " to " +
      targetLanguage +
      ".",
    "",
    '"' + text + '"',
  ].join("\n");
}

promptModel.addEventListener("change", () => {
  updateCustomPromptVisibility();
  updatePromptPreview();
});

inputType.addEventListener("change", () => {
  updateInputTypeVisibility();
  updatePromptPreview();
});

customPromptModel.addEventListener("input", updatePromptPreview);
glossaryInput.addEventListener("input", updatePromptPreview);
jsonFile.addEventListener("change", updatePromptPreview);
loadGlossaryButton.addEventListener("click", () => glossaryFileInput.click());
glossaryFileInput.addEventListener("change", loadGlossaryFromSelectedFile);
downloadGlossaryButton.addEventListener("click", downloadGlossary);
openGlossaryEntryButton.addEventListener("click", openGlossaryOverlay);
closeGlossaryEntryButton.addEventListener("click", closeGlossaryOverlay);
cancelGlossaryEntryButton.addEventListener("click", closeGlossaryOverlay);
glossaryOverlay.addEventListener("click", (event) => {
  if (event.target === glossaryOverlay) {
    closeGlossaryOverlay();
  }
});
glossaryEntryForm.addEventListener("submit", addGlossaryEntry);
form.addEventListener("input", updatePromptPreview);
form.addEventListener("change", updatePromptPreview);
updateCustomPromptVisibility();
updateInputTypeVisibility();
loadLanguagePresets();
loadPromptModels();
loadOllamaModels();

window.addEventListener("dragover", (event) => {
  event.preventDefault();
});

window.addEventListener("drop", (event) => {
  event.preventDefault();

  const files = [...event.dataTransfer.files].filter((file) =>
    file.name.toLowerCase().endsWith(".json"),
  );

  if (files.length === 0) {
    return;
  }

  const transfer = new DataTransfer();

  for (const file of files) {
    transfer.items.add(file);
  }

  jsonFile.files = transfer.files;
  inputType.value = "json";
  updateInputTypeVisibility();
  updatePromptPreview();
  status.textContent = `${files.length} JSON file${files.length === 1 ? "" : "s"} ready.`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const sourceLanguage = String(data.get("sourceLanguage") || "unknown");
  const targetLanguage = String(
    data.get("targetLanguage") || "Brazilian Portuguese",
  );
  const text = String(data.get("text") || "");
  const selectedPromptModel = String(data.get("promptModel") || "default");
  const selectedCustomPromptModel = String(data.get("customPromptModel") || "");
  const glossary = parseGlossaryInput(true);
  const model = String(data.get("model") || "translategemma:4b");

  submitButton.disabled = true;
  downloadJsonButton.hidden = true;
  downloadJsonButton.classList.add("is-hidden");
  lastTranslatedJsonFiles = [];
  status.textContent =
    inputType.value === "json" ? "Translating JSON..." : "Translating...";
  result.textContent = "";

  try {
    const response =
      inputType.value === "json"
        ? null
        : await translateText({
            model,
            promptModel: selectedPromptModel,
            customPromptModel: selectedCustomPromptModel,
            glossary,
            sourceLanguage,
            targetLanguage,
            text,
          });

    if (inputType.value === "json") {
      const files = [...jsonFile.files];

      if (files.length === 0) {
        throw new Error("Select at least one JSON file.");
      }

      for (const [index, file] of files.entries()) {
        status.textContent = `File ${index + 1}/${files.length}: ${file.name}`;

        const response = await translateJson({
          file,
          model,
          promptModel: selectedPromptModel,
          customPromptModel: selectedCustomPromptModel,
          glossary,
          sourceLanguage,
          targetLanguage,
        });

        await readJsonTranslationStream(response, file.name);
      }

      downloadJsonButton.hidden = false;
      downloadJsonButton.classList.remove("is-hidden");
      status.textContent = `Done. Translated ${lastTranslatedJsonFiles.length} JSON file${lastTranslatedJsonFiles.length === 1 ? "" : "s"}.`;
    } else {
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Translation request failed");
      }

      result.textContent = json.response ?? JSON.stringify(json, null, 2);
      status.textContent = "Done";
    }
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : String(error);
    status.textContent = "Error";
  } finally {
    submitButton.disabled = false;
  }
});

downloadJsonButton.addEventListener("click", () => {
  for (const translatedFile of lastTranslatedJsonFiles) {
    const blob = new Blob([translatedFile.content], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = translatedFile.name;
    anchor.click();

    URL.revokeObjectURL(url);
  }
});

function buildTranslationBody({
  model,
  promptModel,
  customPromptModel,
  glossary,
  sourceLanguage,
  targetLanguage,
  text,
}) {
  const body = {
    model,
    promptModel,
    prompt: buildPrompt(sourceLanguage, targetLanguage, text),
    temperature: 0.3,
  };

  if (glossary) {
    body.glossary = glossary;
  }

  if (promptModel === "custom") {
    body.customPromptModel = customPromptModel;
  }

  return body;
}

function translateText(options) {
  return fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildTranslationBody(options)),
  });
}

function translateJson({
  file,
  model,
  promptModel,
  customPromptModel,
  glossary,
  sourceLanguage,
  targetLanguage,
}) {
  const jsonData = new FormData();

  jsonData.set("file", file);
  jsonData.set("model", model);
  jsonData.set("promptModel", promptModel);
  jsonData.set("sourceLanguage", sourceLanguage);
  jsonData.set("targetLanguage", targetLanguage);

  if (glossary) {
    jsonData.set("glossary", JSON.stringify(glossary));
  }

  if (promptModel === "custom") {
    jsonData.set("customPromptModel", customPromptModel);
  }

  return fetch("/api/translate-json", {
    method: "POST",
    body: jsonData,
  });
}

async function readJsonTranslationStream(response, fileName) {
  if (!response.ok || !response.body) {
    const json = await response.json();

    throw new Error(json.error || "JSON request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      handleJsonTranslationEvent(JSON.parse(line), fileName);
    }
  }

  if (buffer.trim()) {
    handleJsonTranslationEvent(JSON.parse(buffer), fileName);
  }
}

function parseGlossaryInput(throwOnInvalid) {
  const value = glossaryInput.value.trim();

  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Glossary must be a JSON object.");
    }

    const glossary = {};

    for (const [source, target] of Object.entries(parsed)) {
      if (typeof target === "string") {
        glossary[source] = target;
      }
    }

    return Object.keys(glossary).length > 0 ? glossary : undefined;
  } catch (error) {
    if (throwOnInvalid) {
      throw error;
    }

    return undefined;
  }
}

async function loadGlossaryFromSelectedFile() {
  const file = glossaryFileInput.files[0];

  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const glossary = normalizeGlossary(parsed);

    glossaryInput.value = JSON.stringify(glossary, null, 2);
    glossaryFileInput.value = "";
    updatePromptPreview();
    status.textContent = `Glossary loaded: ${Object.keys(glossary).length} entries.`;
  } catch (error) {
    status.textContent = "Error";
    result.textContent =
      error instanceof Error ? error.message : "Invalid glossary file.";
  }
}

function downloadGlossary() {
  const glossary = parseGlossaryInput(true) || {};
  const blob = new Blob([JSON.stringify(glossary, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "glossary.json";
  anchor.click();

  URL.revokeObjectURL(url);
}

function openGlossaryOverlay() {
  glossaryOverlay.hidden = false;
  glossaryOverlay.classList.remove("is-hidden");
  glossarySourceInput.value = "";
  glossaryTargetInput.value = "";
  glossarySourceInput.focus();
}

function closeGlossaryOverlay() {
  glossaryOverlay.hidden = true;
  glossaryOverlay.classList.add("is-hidden");
}

function addGlossaryEntry(event) {
  event.preventDefault();

  const source = glossarySourceInput.value.trim();
  const target = glossaryTargetInput.value.trim();

  if (!source || !target) {
    return;
  }

  const glossary = parseGlossaryInput(false) || {};
  glossary[source] = target;
  glossaryInput.value = JSON.stringify(glossary, null, 2);

  closeGlossaryOverlay();
  updatePromptPreview();
  status.textContent = `Glossary entry added: ${source}`;
}

function normalizeGlossary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Glossary file must be a JSON object.");
  }

  const glossary = {};

  for (const [source, target] of Object.entries(value)) {
    if (typeof target === "string" && source.trim() && target.trim()) {
      glossary[source] = target;
    }
  }

  return glossary;
}

function formatGlossary(glossary, text) {
  const entries = Object.entries(glossary || {}).filter(
    ([source, target]) =>
      source.trim() &&
      target.trim() &&
      text.toLocaleLowerCase().includes(source.trim().toLocaleLowerCase()),
  );

  if (entries.length === 0) {
    return "";
  }

  return [
    "Glossary:",
    ...entries.map(([source, target]) => `- ${source}: ${target}`),
    "",
    "Use the glossary translations exactly when those terms appear.",
  ].join("\n");
}

async function getFirstJsonTextForPreview() {
  const file = jsonFile.files[0];

  if (!file) {
    return "";
  }

  try {
    return findFirstString(JSON.parse(await file.text())) ?? "";
  } catch {
    return "";
  }
}

function findFirstString(value) {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstString(item);

      if (found !== undefined) {
        return found;
      }
    }
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = findFirstString(item);

      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}

function handleJsonTranslationEvent(event, fileName) {
  if (event.type === "ping") {
    return;
  }

  if (event.type === "status") {
    status.textContent = event.message || "Working...";
    return;
  }

  if (event.type === "started") {
    status.textContent = `${fileName}: working ${event.translatedEntries + 1}/${event.totalEntries}: ${event.path}`;
    return;
  }

  if (event.type === "progress") {
    status.textContent = `${fileName}: translated ${event.translatedEntries}/${event.totalEntries}: ${event.path}`;
    result.textContent += `${fileName} | ${event.path}: ${event.translated}\n`;
    return;
  }

  if (event.type === "done") {
    const content = JSON.stringify(event.translated, null, 2);

    lastTranslatedJsonFiles.push({
      name: fileName || "translated.json",
      content,
    });
    result.textContent += `${fileName}: done ${event.translatedEntries}/${event.totalEntries}\n`;
    return;
  }

  if (event.type === "error") {
    throw new Error(event.error || "JSON translation failed");
  }
}
