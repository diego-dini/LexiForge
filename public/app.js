const form = document.querySelector("#translateForm");
const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll("[data-page-target]");
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
const savePromptModelButton = document.querySelector("#savePromptModelButton");
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
const promptModelForm = document.querySelector("#promptModelForm");
const editorPromptModel = document.querySelector("#editorPromptModel");
const editorPromptModelName = document.querySelector("#editorPromptModelName");
const editorPromptModelTemplate = document.querySelector(
  "#editorPromptModelTemplate",
);
const newPromptModelButton = document.querySelector("#newPromptModelButton");
const deleteEditorPromptModelButton = document.querySelector(
  "#deleteEditorPromptModelButton",
);
const promptEditorStatus = document.querySelector("#promptEditorStatus");
const editorPromptValidation = document.querySelector(
  "#editorPromptValidation",
);
const editorPromptPreview = document.querySelector("#editorPromptPreview");
const promptModelFileList = document.querySelector("#promptModelFileList");
const promptFilesStatus = document.querySelector("#promptFilesStatus");

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
let promptModelDetails = {};
let editorPromptValidationState = { errors: [], warnings: [] };
let lastTranslatedJsonFiles = [];
let promptPreviewRequestId = 0;

const fallbackPromptModels = {
};

// The translated JSON stream can finish files one at a time. Keep the download
// action available as soon as at least one translated file is ready.
function updateDownloadJsonButton() {
  const readyCount = lastTranslatedJsonFiles.length;
  const hasReadyFiles = readyCount > 0;

  downloadJsonButton.hidden = !hasReadyFiles;
  downloadJsonButton.classList.toggle("is-hidden", !hasReadyFiles);
  downloadJsonButton.textContent =
    readyCount === 1
      ? "Download 1 ready JSON"
      : `Download ${readyCount} ready JSONs`;
}

function updateCustomPromptVisibility() {
  const isCustom = promptModel.value === "custom";

  customPromptWrap.hidden = !isCustom;
  customPromptWrap.classList.toggle("is-hidden", !isCustom);
  customPromptModel.disabled = !isCustom;
}

// Toggle between normal text translation and file-based JSON translation.
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

// Renders the prompt exactly as the backend will after placeholder replacement.
// This gives users fast feedback before they submit a translation request.
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

  promptPreview.textContent = renderPromptTemplate({
    template,
    sourceLanguage,
    targetLanguage,
    glossary,
    text,
  });
}

// Shared placeholder replacement for both the translation page and prompt
// editor preview. Keep this in sync with `preparePrompt.ts`.
function renderPromptTemplate({
  template,
  sourceLanguage,
  targetLanguage,
  glossary,
  text,
}) {
  const glossaryText = formatGlossary(glossary, text);

  return template
    .replaceAll("{sourceLanguage}", sourceLanguage)
    .replaceAll("{originLanguage}", sourceLanguage)
    .replaceAll("{targetLanguage}", targetLanguage)
    .replaceAll("{glossary}", glossaryText)
    .replaceAll("{text}", text);
}

// Mirrors backend validation so the editor can block invalid saves immediately.
function validatePromptTemplate(template) {
  const errors = [];
  const warnings = [];

  if (!template.includes("{text}")) {
    errors.push("Missing required key {text}.");
  }

  if (!template.includes("{targetLanguage}")) {
    errors.push("Missing required key {targetLanguage}.");
  }

  if (
    !template.includes("{sourceLanguage}") &&
    !template.includes("{originLanguage}")
  ) {
    warnings.push("Recommended key missing: {originLanguage}.");
  }

  if (!template.includes("{glossary}")) {
    warnings.push("Recommended key missing: {glossary}.");
  }

  return { errors, warnings };
}

// Converts a display name to the persisted/API key. Backend normalization is
// still authoritative; this frontend copy is for responsive UI behavior.
function normalizePromptModelName(name) {
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

// Stored keys use underscores, but users should read natural names in controls.
function displayPromptModelName(name) {
  return name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

// Finds the next available `new-model-n` name using existing saved models and
// the current draft name.
function getNextNewPromptModelName() {
  let max = 0;

  for (const name of [
    ...Object.keys(promptModels),
    editorPromptModelName.value,
  ]) {
    const match = normalizePromptModelName(name).match(/^new_model_(\d+)$/);

    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }

  return `new-model-${max + 1}`;
}

// Saved prompt models are fetched from `/api/promp`. The internal `default`
// model is intentionally absent from this response.
async function loadPromptModels() {
  const selectedPromptModel = promptModel.value || "default";

  try {
    const response = await fetch("/api/promp");
    if (!response.ok) {
      throw new Error("Prompt models request failed");
    }

    promptModels = await response.json();
  } catch {
    promptModels = fallbackPromptModels;
  }

  renderPromptModelOptions(selectedPromptModel);
  await loadPromptModelDetails();
  updatePromptPreview();
}

// Details include whether a model can be deleted. Since built-ins are hidden,
// all returned models are currently user-managed saved models.
async function loadPromptModelDetails() {
  try {
    const response = await fetch("/api/promp/details");

    if (!response.ok) {
      throw new Error("Prompt model details request failed");
    }

    promptModelDetails = await response.json();
  } catch {
    promptModelDetails = Object.fromEntries(
      Object.entries(promptModels).map(([name, template]) => [
        name,
        { template, saved: false },
      ]),
    );
  }

  renderEditorPromptModelOptions(editorPromptModel.value || promptModel.value);
  renderPromptModelFileList();
}

// Populate the translation page prompt selector with visible saved models plus
// the transient `custom` option.
function renderPromptModelOptions(selectedPromptModel) {
  promptModel.textContent = "";

  for (const name of Object.keys(promptModels)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = displayPromptModelName(name);
    promptModel.append(option);
  }

  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "custom";
  promptModel.append(customOption);

  if (promptModels[selectedPromptModel] || selectedPromptModel === "custom") {
    promptModel.value = selectedPromptModel;
  } else {
    promptModel.value = "custom";
  }

  updateCustomPromptVisibility();
}

// Populate the editor selector. Option values are normalized keys; option text
// is human-readable.
function renderEditorPromptModelOptions(selectedPromptModel) {
  editorPromptModel.textContent = "";

  for (const name of Object.keys(promptModels)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = displayPromptModelName(name);
    editorPromptModel.append(option);
  }

  if (promptModels[selectedPromptModel]) {
    editorPromptModel.value = selectedPromptModel;
  } else {
    editorPromptModel.value = Object.keys(promptModels)[0] || "";
  }

  loadSelectedPromptModelIntoEditor();
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

for (const navButton of navButtons) {
  navButton.addEventListener("click", () => {
    showPage(navButton.dataset.pageTarget);
  });
}

function showPage(pageId) {
  for (const page of pages) {
    const isActive = page.id === pageId;

    page.hidden = !isActive;
    page.classList.toggle("is-active", isActive);
  }

  for (const navButton of navButtons) {
    navButton.classList.toggle(
      "is-active",
      navButton.dataset.pageTarget === pageId,
    );
  }

  if (pageId === "promptEditorPage" || pageId === "promptFilesPage") {
    loadPromptModels();
  }
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
promptModelForm.addEventListener("submit", savePromptModel);
editorPromptModel.addEventListener("change", loadSelectedPromptModelIntoEditor);
editorPromptModelName.addEventListener("input", updateEditorPromptModelName);
editorPromptModelTemplate.addEventListener("input", updateEditorPromptPreview);
newPromptModelButton.addEventListener("click", startNewPromptModel);
deleteEditorPromptModelButton.addEventListener("click", deletePromptModelFromEditor);
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
  lastTranslatedJsonFiles = [];
  updateDownloadJsonButton();
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

    setTimeout(() => URL.revokeObjectURL(url), 0);
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

async function savePromptModel(event) {
  event.preventDefault();

  const normalizedName = normalizePromptModelName(editorPromptModelName.value);

  if (!normalizedName) {
    promptEditorStatus.textContent = "Prompt model name is required.";
    return;
  }

  if (normalizedName === "default") {
    promptEditorStatus.textContent =
      "The default prompt model is internal and cannot be edited.";
    return;
  }

  const template = editorPromptModelTemplate.value;
  const validation = validatePromptTemplate(template);

  if (!template.trim()) {
    promptEditorStatus.textContent = "Prompt model template is required.";
    return;
  }

  if (validation.errors.length > 0) {
    updateEditorPromptValidation();
    promptEditorStatus.textContent =
      "Fix the required prompt keys before saving.";
    return;
  }

  let overwrite = false;

  if (promptModels[normalizedName] !== undefined) {
    overwrite = confirm(
      `Prompt model "${displayPromptModelName(normalizedName)}" already exists. Replace it?`,
    );

    if (!overwrite) {
      promptEditorStatus.textContent = "Save canceled.";
      return;
    }
  }

  savePromptModelButton.disabled = true;
  promptEditorStatus.textContent = "Saving prompt model...";

  try {
    let response = await postPromptModel({
      name: normalizedName,
      template,
      overwrite,
    });
    let json = await response.json();

    if (response.status === 409) {
      overwrite = confirm(
        `Prompt model "${displayPromptModelName(normalizedName)}" already exists. Replace it?`,
      );

      if (!overwrite) {
        promptEditorStatus.textContent = "Save canceled.";
        return;
      }

      response = await postPromptModel({
        name: normalizedName,
        template,
        overwrite: true,
      });
      json = await response.json();
    }

    if (!response.ok) {
      throw new Error(json.error || "Failed to save prompt model.");
    }

    promptModels = json.promptModels || promptModels;
    await loadPromptModels();
    renderPromptModelOptions(normalizedName);
    renderEditorPromptModelOptions(normalizedName);
    updatePromptPreview();
    editorPromptModelName.value = displayPromptModelName(normalizedName);
    promptEditorStatus.textContent = `Prompt model saved: ${displayPromptModelName(normalizedName)}`;
  } catch (error) {
    promptEditorStatus.textContent =
      error instanceof Error ? error.message : "Failed to save prompt model.";
  } finally {
    updateEditorPromptValidation();
  }
}

// Loading a saved model copies its persisted key into the editor as a readable
// label, while the textarea receives the actual template.
function loadSelectedPromptModelIntoEditor() {
  const name = editorPromptModel.value;

  editorPromptModelName.value = displayPromptModelName(name);
  editorPromptModelTemplate.value = promptModels[name] || "";
  promptEditorStatus.textContent = "";
  syncEditorPromptModelOption();
  updateEditorDeleteButton();
  updateEditorPromptPreview();
}

// Start a draft model without persisting anything yet. The selector shows a
// single temporary option until the model is saved.
function startNewPromptModel() {
  editorPromptModelName.value = getNextNewPromptModelName();
  editorPromptModelTemplate.value = "";
  promptEditorStatus.textContent = "";
  syncEditorPromptModelOption();
  updateEditorDeleteButton();
  updateEditorPromptPreview();
  editorPromptModelName.focus();
}

// Keep the selector visually aligned with the editable `Save as` field without
// creating a new real option for every typed character.
function updateEditorPromptModelName() {
  syncEditorPromptModelOption();
  updateEditorDeleteButton();
}

// The temporary option represents an unsaved draft. It is removed and recreated
// as needed so the select never accumulates stale draft names.
function syncEditorPromptModelOption() {
  const normalizedName = normalizePromptModelName(editorPromptModelName.value);
  const temporaryOptionValue = "__editing_prompt_model__";

  for (const option of [...editorPromptModel.options]) {
    if (option.value === temporaryOptionValue) {
      option.remove();
    }
  }

  if (!normalizedName) {
    return;
  }

  const existingOption = [...editorPromptModel.options].find(
    (item) => item.value === normalizedName,
  );

  if (existingOption) {
    editorPromptModel.value = normalizedName;
    return;
  }

  const option = document.createElement("option");
  option.value = temporaryOptionValue;
  option.textContent = displayPromptModelName(normalizedName);
  editorPromptModel.append(option);
  editorPromptModel.value = temporaryOptionValue;
}

// Delete is only enabled when the normalized draft name maps to a saved model.
function updateEditorDeleteButton() {
  const name = normalizePromptModelName(editorPromptModelName.value);
  const detail = promptModelDetails[name];

  deleteEditorPromptModelButton.disabled = !detail?.saved;
}

// Uses sample text/glossary when the translation page is empty, so prompt
// authors can still see a meaningful preview.
function updateEditorPromptPreview() {
  const template = editorPromptModelTemplate.value;
  const text =
    textInput.value.trim() ||
    "A gleaming blade rests beside the old map.";
  const glossary = parseGlossaryInput(false) || {
    blade: "lamina",
    map: "mapa",
  };

  editorPromptPreview.textContent = renderPromptTemplate({
    template,
    sourceLanguage: sourceLanguageSelect.value || "English",
    targetLanguage: targetLanguageSelect.value || "Brazilian Portuguese",
    glossary,
    text,
  });
  updateEditorPromptValidation();
}

// Render validation as colored messages and enforce the save-button lockout for
// required placeholders.
function updateEditorPromptValidation() {
  editorPromptValidationState = validatePromptTemplate(
    editorPromptModelTemplate.value,
  );
  editorPromptValidation.textContent = "";

  for (const error of editorPromptValidationState.errors) {
    const message = document.createElement("div");
    message.className = "validation-message error";
    message.textContent = error;
    editorPromptValidation.append(message);
  }

  for (const warning of editorPromptValidationState.warnings) {
    const message = document.createElement("div");
    message.className = "validation-message warning";
    message.textContent = warning;
    editorPromptValidation.append(message);
  }

  savePromptModelButton.disabled =
    editorPromptValidationState.errors.length > 0;
}

// Delete from the editor page, then reset to a fresh draft on success.
async function deletePromptModelFromEditor() {
  const name = normalizePromptModelName(editorPromptModelName.value);

  if (!name) {
    promptEditorStatus.textContent = "Select a saved prompt model to delete.";
    return;
  }

  const deleted = await deletePromptModel(name, promptEditorStatus);

  if (deleted) {
    startNewPromptModel();
  }
}

// Build the download/delete management list from `/api/promp/details`.
function renderPromptModelFileList() {
  promptModelFileList.textContent = "";

  for (const [name, detail] of Object.entries(promptModelDetails)) {
    const row = document.createElement("div");
    row.className = "model-list-row";

    const info = document.createElement("div");
    const title = document.createElement("div");
    const meta = document.createElement("div");

    title.className = "model-list-name";
    title.textContent = displayPromptModelName(name);
    meta.className = "model-list-meta";
    meta.textContent = detail.saved ? "Saved model" : "Built-in model";

    info.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "actions compact-actions";

    const downloadButton = document.createElement("button");
    downloadButton.className = "secondary";
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.addEventListener("click", () =>
      downloadPromptModel(name, detail.template),
    );
    actions.append(downloadButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = !detail.saved;
    deleteButton.addEventListener("click", () => deletePromptModel(name));
    actions.append(deleteButton);

    row.append(info, actions);
    promptModelFileList.append(row);
  }
}

// Downloads one prompt model as a standalone JSON object.
function downloadPromptModel(name, template) {
  const content = JSON.stringify({ [name]: template }, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `${name}.prompt-model.json`;
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Shared delete helper used by the editor page and the management page.
async function deletePromptModel(name, statusElement = promptFilesStatus) {
  if (!confirm(`Delete prompt model "${displayPromptModelName(name)}"?`)) {
    return false;
  }

  statusElement.textContent = "Deleting prompt model...";

  try {
    const response = await fetch(
      `/api/promp/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Failed to delete prompt model.");
    }

    promptModels = json.promptModels || promptModels;
    await loadPromptModels();
    statusElement.textContent = `Prompt model deleted: ${displayPromptModelName(name)}`;
    return true;
  } catch (error) {
    statusElement.textContent =
      error instanceof Error ? error.message : "Failed to delete prompt model.";
    return false;
  }
}

function getActivePromptTemplate() {
  if (promptModel.value === "custom") {
    return customPromptModel.value;
  }

  return promptModels[promptModel.value] || "";
}

function postPromptModel({ name, template, overwrite }) {
  const normalizedName = normalizePromptModelName(name);

  if (overwrite) {
    return fetch(`/api/promp/${encodeURIComponent(normalizedName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template }),
    });
  }

  return fetch("/api/promp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: normalizedName, template }),
  });
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
    updateDownloadJsonButton();
    result.textContent += `${fileName}: done ${event.translatedEntries}/${event.totalEntries}\n`;
    return;
  }

  if (event.type === "error") {
    throw new Error(event.error || "JSON translation failed");
  }
}
