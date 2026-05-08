import { fallbackPromptModels } from "../constants";
import { dom } from "../dom";
import { state } from "../state";
import type { PostPromptModelOptions, PromptModelDetails, PromptModels, PromptModelsResponse } from "../types";
import { parseGlossaryInput } from "./glossary";
import { updatePromptPreview } from "./prompt-preview";
import { showCustomConfirm } from "../ui/message-dialog";
import {
  displayPromptModelName,
  normalizePromptModelName,
  renderPromptTemplate,
  validatePromptTemplate,
} from "../utils/prompt-template";

/** Shows/hides the custom prompt textarea based on the selected prompt model. */
export function updateCustomPromptVisibility(): void {
  const isCustom = dom.promptModel.value === "custom";

  dom.customPromptWrap.hidden = !isCustom;
  dom.customPromptWrap.classList.toggle("is-hidden", !isCustom);
  dom.customPromptModel.disabled = !isCustom;
}

/** Finds the next available unsaved prompt-model draft name. */
function getNextNewPromptModelName(): string {
  let max = 0;

  for (const name of [
    ...Object.keys(state.promptModels),
    dom.editorPromptModelName.value,
  ]) {
    const match = normalizePromptModelName(name).match(/^new_model_(\d+)$/);

    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }

  return `new-model-${max + 1}`;
}

/** Loads saved prompt models from the backend. */
export async function loadPromptModels(): Promise<void> {
  const selectedPromptModel = dom.promptModel.value || "default";

  try {
    const response = await fetch("/api/promp");
    if (!response.ok) {
      throw new Error("Prompt models request failed");
    }

    state.promptModels = (await response.json()) as PromptModels;
  } catch {
    state.promptModels = fallbackPromptModels;
  }

  renderPromptModelOptions(selectedPromptModel);
  await loadPromptModelDetails();
  void updatePromptPreview();
}

/** Loads metadata for prompt models, such as whether they can be deleted. */
async function loadPromptModelDetails(): Promise<void> {
  try {
    const response = await fetch("/api/promp/details");

    if (!response.ok) {
      throw new Error("Prompt model details request failed");
    }

    state.promptModelDetails = (await response.json()) as PromptModelDetails;
  } catch {
    state.promptModelDetails = Object.fromEntries(
      Object.entries(state.promptModels).map(([name, template]) => [
        name,
        { template, saved: false },
      ]),
    );
  }

  renderEditorPromptModelOptions(dom.editorPromptModel.value || dom.promptModel.value);
}

/** Renders the translation page prompt selector. */
function renderPromptModelOptions(selectedPromptModel: string): void {
  dom.promptModel.textContent = "";

  for (const name of Object.keys(state.promptModels)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = displayPromptModelName(name);
    dom.promptModel.append(option);
  }

  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "custom";
  dom.promptModel.append(customOption);

  if (state.promptModels[selectedPromptModel] || selectedPromptModel === "custom") {
    dom.promptModel.value = selectedPromptModel;
  } else {
    dom.promptModel.value = "custom";
  }

  updateCustomPromptVisibility();
}

/** Renders the prompt editor model selector. */
function renderEditorPromptModelOptions(selectedPromptModel: string): void {
  dom.editorPromptModel.textContent = "";

  for (const name of Object.keys(state.promptModels)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = displayPromptModelName(name);
    dom.editorPromptModel.append(option);
  }

  if (state.promptModels[selectedPromptModel]) {
    dom.editorPromptModel.value = selectedPromptModel;
  } else {
    dom.editorPromptModel.value = Object.keys(state.promptModels)[0] || "";
  }

  loadSelectedPromptModelIntoEditor();
}

/** Saves or overwrites a prompt model from the editor page. */
export async function savePromptModel(event: Event): Promise<void> {
  event.preventDefault();

  const normalizedName = normalizePromptModelName(dom.editorPromptModelName.value);

  if (!normalizedName) {
    dom.promptEditorStatus.textContent = "Prompt model name is required.";
    return;
  }

  if (normalizedName === "default") {
    dom.promptEditorStatus.textContent =
      "The default prompt model is internal and cannot be edited.";
    return;
  }

  const template = dom.editorPromptModelTemplate.value;
  const validation = validatePromptTemplate(template);

  if (!template.trim()) {
    dom.promptEditorStatus.textContent = "Prompt model template is required.";
    return;
  }

  if (validation.errors.length > 0) {
    updateEditorPromptValidation();
    dom.promptEditorStatus.textContent =
      "Fix the required prompt keys before saving.";
    return;
  }

  let overwrite = false;

  if (state.promptModels[normalizedName] !== undefined) {
    overwrite = await showCustomConfirm({
      title: "Replace Prompt Model",
      message: `Prompt model "${displayPromptModelName(normalizedName)}" already exists. Replace it?`,
      confirmText: "Replace",
    });

    if (!overwrite) {
      dom.promptEditorStatus.textContent = "Save canceled.";
      return;
    }
  }

  dom.savePromptModelButton.disabled = true;
  dom.promptEditorStatus.textContent = "Saving prompt model...";

  try {
    let response = await postPromptModel({
      name: normalizedName,
      template,
      overwrite,
    });
    let json = (await response.json()) as PromptModelsResponse;

    if (response.status === 409) {
      overwrite = await showCustomConfirm({
        title: "Replace Prompt Model",
        message: `Prompt model "${displayPromptModelName(normalizedName)}" already exists. Replace it?`,
        confirmText: "Replace",
      });

      if (!overwrite) {
        dom.promptEditorStatus.textContent = "Save canceled.";
        return;
      }

      response = await postPromptModel({
        name: normalizedName,
        template,
        overwrite: true,
      });
      json = (await response.json()) as PromptModelsResponse;
    }

    if (!response.ok) {
      throw new Error(json.error || "Failed to save prompt model.");
    }

    state.promptModels = json.promptModels || state.promptModels;
    await loadPromptModels();
    renderPromptModelOptions(normalizedName);
    renderEditorPromptModelOptions(normalizedName);
    void updatePromptPreview();
    dom.editorPromptModelName.value = displayPromptModelName(normalizedName);
    dom.promptEditorStatus.textContent = `Prompt model saved: ${displayPromptModelName(normalizedName)}`;
  } catch (error) {
    dom.promptEditorStatus.textContent =
      error instanceof Error ? error.message : "Failed to save prompt model.";
  } finally {
    updateEditorPromptValidation();
  }
}

/** Copies a selected saved model into the editor fields. */
export function loadSelectedPromptModelIntoEditor(): void {
  const name = dom.editorPromptModel.value;

  dom.editorPromptModelName.value = displayPromptModelName(name);
  dom.editorPromptModelTemplate.value = state.promptModels[name] || "";
  dom.promptEditorStatus.textContent = "";
  syncEditorPromptModelOption();
  updateEditorDeleteButton();
  updateEditorPromptPreview();
}

/** Starts a new unsaved prompt-model draft. */
export function startNewPromptModel(): void {
  dom.editorPromptModelName.value = getNextNewPromptModelName();
  dom.editorPromptModelTemplate.value = "";
  dom.promptEditorStatus.textContent = "";
  syncEditorPromptModelOption();
  updateEditorDeleteButton();
  updateEditorPromptPreview();
  dom.editorPromptModelName.focus();
}

/** Keeps the editor selector visually aligned with the editable name field. */
export function updateEditorPromptModelName(): void {
  syncEditorPromptModelOption();
  updateEditorDeleteButton();
}

/** Adds/removes the temporary selector option for an unsaved draft. */
function syncEditorPromptModelOption(): void {
  const normalizedName = normalizePromptModelName(dom.editorPromptModelName.value);
  const temporaryOptionValue = "__editing_prompt_model__";

  for (const option of Array.from(dom.editorPromptModel.options)) {
    if (option.value === temporaryOptionValue) {
      option.remove();
    }
  }

  if (!normalizedName) {
    return;
  }

  const existingOption = Array.from(dom.editorPromptModel.options).find(
    (item) => item.value === normalizedName,
  );

  if (existingOption) {
    dom.editorPromptModel.value = normalizedName;
    return;
  }

  const option = document.createElement("option");
  option.value = temporaryOptionValue;
  option.textContent = displayPromptModelName(normalizedName);
  dom.editorPromptModel.append(option);
  dom.editorPromptModel.value = temporaryOptionValue;
}

/** Enables delete only when the current name maps to a saved model. */
function updateEditorDeleteButton(): void {
  const name = normalizePromptModelName(dom.editorPromptModelName.value);
  const detail = state.promptModelDetails[name];

  dom.deleteEditorPromptModelButton.disabled = !detail?.saved;
}

/** Updates the prompt preview shown in the prompt editor page. */
export function updateEditorPromptPreview(): void {
  const template = dom.editorPromptModelTemplate.value;
  const text =
    dom.textInput.value.trim() ||
    "A gleaming blade rests beside the old map.";
  const glossary = parseGlossaryInput(false) || {
    blade: "lamina",
    map: "mapa",
  };

  dom.editorPromptPreview.textContent = renderPromptTemplate({
    template,
    sourceLanguage: dom.sourceLanguageSelect.value || "English",
    targetLanguage: dom.targetLanguageSelect.value || "Brazilian Portuguese",
    glossary,
    text,
  });
  updateEditorPromptValidation();
}

/** Renders prompt validation messages and locks the save button on errors. */
function updateEditorPromptValidation(): void {
  state.editorPromptValidationState = validatePromptTemplate(
    dom.editorPromptModelTemplate.value,
  );
  dom.editorPromptValidation.textContent = "";

  for (const error of state.editorPromptValidationState.errors) {
    const message = document.createElement("div");
    message.className = "validation-message error";
    message.textContent = error;
    dom.editorPromptValidation.append(message);
  }

  for (const warning of state.editorPromptValidationState.warnings) {
    const message = document.createElement("div");
    message.className = "validation-message warning";
    message.textContent = warning;
    dom.editorPromptValidation.append(message);
  }

  dom.savePromptModelButton.disabled =
    state.editorPromptValidationState.errors.length > 0;
}

/** Deletes the current saved prompt model from the editor page. */
export async function deletePromptModelFromEditor(): Promise<void> {
  const name = normalizePromptModelName(dom.editorPromptModelName.value);

  if (!name) {
    dom.promptEditorStatus.textContent = "Select a saved prompt model to delete.";
    return;
  }

  const deleted = await deletePromptModel(name, dom.promptEditorStatus);

  if (deleted) {
    startNewPromptModel();
  }
}

/** Shared delete helper used by prompt model management UIs. */
async function deletePromptModel(
  name: string,
  statusElement: HTMLElement = dom.promptEditorStatus,
): Promise<boolean> {
  const confirmed = await showCustomConfirm({
    title: "Delete Prompt Model",
    message: `Delete prompt model "${displayPromptModelName(name)}"?`,
    confirmText: "Delete",
  });

  if (!confirmed) {
    return false;
  }

  statusElement.textContent = "Deleting prompt model...";

  try {
    const response = await fetch(
      `/api/promp/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    const json = (await response.json()) as PromptModelsResponse;

    if (!response.ok) {
      throw new Error(json.error || "Failed to delete prompt model.");
    }

    state.promptModels = json.promptModels || state.promptModels;
    await loadPromptModels();
    statusElement.textContent = `Prompt model deleted: ${displayPromptModelName(name)}`;
    return true;
  } catch (error) {
    statusElement.textContent =
      error instanceof Error ? error.message : "Failed to delete prompt model.";
    return false;
  }
}

/** Returns the template currently active on the translation page. */
export function getActivePromptTemplate(): string {
  if (dom.promptModel.value === "custom") {
    return dom.customPromptModel.value;
  }

  return state.promptModels[dom.promptModel.value] || "";
}

/** Creates or updates a prompt model through the backend API. */
function postPromptModel({
  name,
  template,
  overwrite,
}: PostPromptModelOptions): Promise<Response> {
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
