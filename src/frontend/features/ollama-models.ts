import { DEFAULT_OLLAMA_MODEL } from "../constants";
import { dom } from "../dom";
import { state } from "../state";
import type {
  OllamaExistsResponse,
  OllamaModelsResponse,
  OllamaPullResponse,
  PromptModelsResponse,
} from "../types";
import { showCustomConfirm, showCustomMessage, showCustomPrompt } from "../ui/message-dialog";

/** Loads installed Ollama models into the translation page selector. */
export async function loadOllamaModels(): Promise<void> {
  try {
    const response = await fetch("/ollama/api/tags");
    const json = (await response.json()) as OllamaModelsResponse;
    const models = Array.isArray(json.models) ? json.models : [];

    dom.modelSelect.textContent = "";

    for (const model of models) {
      if (!model.name) {
        continue;
      }

      const option = document.createElement("option");
      option.value = model.name;
      option.textContent = model.name;
      dom.modelSelect.append(option);
    }

    if (dom.modelSelect.options.length === 0) {
      throw new Error("No models returned");
    }

    await updateSelectedOllamaModelNotice();
  } catch {
    dom.modelSelect.textContent = "";

    const option = document.createElement("option");
    option.value = DEFAULT_OLLAMA_MODEL;
    option.textContent = DEFAULT_OLLAMA_MODEL;
    dom.modelSelect.append(option);
    await updateSelectedOllamaModelNotice();
  }
}

/** Checks if the selected Ollama model exists and updates the warning notice. */
export async function updateSelectedOllamaModelNotice(): Promise<void> {
  const model = dom.modelSelect.value.trim();

  if (!model) {
    showMissingOllamaModelNotice("Select an Ollama model.");
    return;
  }

  try {
    state.selectedOllamaModelExists = await aiModelExists(model);

    if (!state.selectedOllamaModelExists) {
      showMissingOllamaModelNotice(
        `Ollama model "${model}" is not installed. Install it in AI Models before translating.`,
      );
      return;
    }

    hideMissingOllamaModelNotice();
  } catch (error) {
    state.selectedOllamaModelExists = false;
    showMissingOllamaModelNotice(
      error instanceof Error ? error.message : "Failed to check Ollama model.",
    );
  }
}

function showMissingOllamaModelNotice(message: string): void {
  dom.modelMissingNotice.textContent = message;
  dom.modelMissingNotice.hidden = false;
  dom.modelMissingNotice.classList.remove("is-hidden");
}

function hideMissingOllamaModelNotice(): void {
  dom.modelMissingNotice.textContent = "";
  dom.modelMissingNotice.hidden = true;
  dom.modelMissingNotice.classList.add("is-hidden");
}

/** Loads installed models into the AI Models management page. */
export async function loadAiModels(): Promise<void> {
  dom.aiModelsStatus.textContent = "Loading AI models...";

  try {
    const response = await fetch("/ollama/api/tags");
    const json = (await response.json()) as OllamaModelsResponse;

    if (!response.ok) {
      throw new Error(json.error || "Failed to load AI models.");
    }

    state.aiModels = Array.isArray(json.models) ? json.models : [];
    renderAiModelList();
    dom.aiModelsStatus.textContent = `${state.aiModels.length} model${state.aiModels.length === 1 ? "" : "s"} installed.`;
  } catch (error) {
    dom.aiModelList.textContent = "";
    dom.aiModelsStatus.textContent =
      error instanceof Error ? error.message : "Failed to load AI models.";
  }
}

/** Renders the install/delete model list. */
function renderAiModelList(): void {
  dom.aiModelList.textContent = "";

  for (const model of state.aiModels) {
    const name = model.name || "";

    if (!name) {
      continue;
    }

    const row = document.createElement("div");
    row.className = "model-list-row";

    const info = document.createElement("div");
    const title = document.createElement("div");
    const meta = document.createElement("div");

    title.className = "model-list-name";
    title.textContent = name;
    meta.className = "model-list-meta";
    meta.textContent = `Size: ${formatBytes(model.size)}`;

    info.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "actions compact-actions";

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => void deleteAiModel(name));
    actions.append(deleteButton);

    row.append(info, actions);
    dom.aiModelList.append(row);
  }
}

/** Entry point for the install model button. */
export async function installAiModel(): Promise<void> {
  dom.installAiModelButton.disabled = true;

  try {
    await promptAndInstallAiModel();
  } catch (error) {
    dom.aiModelsStatus.textContent =
      error instanceof Error ? error.message : "Failed to install model.";
  } finally {
    dom.installAiModelButton.disabled = false;
  }
}

/** Prompts for a model name, validates it, then asks the backend to pull it. */
async function promptAndInstallAiModel(initialModel = ""): Promise<void> {
  const model = await showCustomPrompt({
    title: "Install AI Model",
    message: "Enter the Ollama model name to install.",
    value: initialModel,
    confirmText: "Install",
  });

  if (model === null) {
    return;
  }

  const normalizedModel = model.trim();

  if (!normalizedModel) {
    dom.aiModelsStatus.textContent = "Model name is required.";
    return promptAndInstallAiModel(normalizedModel);
  }

  dom.aiModelsStatus.textContent = `Checking ${normalizedModel}...`;

  if (await aiModelExists(normalizedModel)) {
    dom.aiModelsStatus.textContent = `Model already installed: ${normalizedModel}`;
    return promptAndInstallAiModel(normalizedModel);
  }

  dom.aiModelsStatus.textContent = `Installing ${normalizedModel}...`;

  const response = await fetch("/ollama/api/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: normalizedModel }),
  });
  const json = (await response.json()) as OllamaPullResponse;

  if (!response.ok) {
    throw new Error(json.error || "Failed to install model.");
  }

  if (!json.installed) {
    const notFoundMessage =
      json.message ||
      "Model was not found in Ollama. Check the model name and tag.";
    await loadAiModels();
    dom.aiModelsStatus.textContent = notFoundMessage;
    await showCustomMessage({
      title: "AI Model Not Found",
      message: `${notFoundMessage} Model: ${normalizedModel}`,
      confirmText: "Try another name",
    });
    return promptAndInstallAiModel(normalizedModel);
  }

  dom.aiModelsStatus.textContent = `Installed model: ${normalizedModel}`;
  await loadAiModels();
  await loadOllamaModels();
}

/** Deletes an installed Ollama model after confirmation. */
async function deleteAiModel(name: string): Promise<void> {
  if (!(await aiModelExists(name))) {
    dom.aiModelsStatus.textContent = `Model is not installed: ${name}`;
    await loadAiModels();
    return;
  }

  const confirmed = await showCustomConfirm({
    title: "Delete AI Model",
    message: `Delete AI model "${name}"?`,
    confirmText: "Delete",
  });

  if (!confirmed) {
    return;
  }

  dom.aiModelsStatus.textContent = `Deleting ${name}...`;

  try {
    const response = await fetch(
      `/ollama/api/models/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    );
    const json = (await response.json()) as PromptModelsResponse;

    if (!response.ok) {
      throw new Error(json.error || "Failed to delete AI model.");
    }

    dom.aiModelsStatus.textContent = `Deleted AI model: ${name}`;
    await loadAiModels();
    await loadOllamaModels();
  } catch (error) {
    dom.aiModelsStatus.textContent =
      error instanceof Error ? error.message : "Failed to delete AI model.";
  }
}

/** Checks if a model is installed through the backend proxy. */
export async function aiModelExists(name: string): Promise<boolean> {
  const response = await fetch(
    `/ollama/api/models/${encodeURIComponent(name)}/exists`,
  );
  const json = (await response.json()) as OllamaExistsResponse;

  if (!response.ok) {
    throw new Error(json.error || "Failed to check model.");
  }

  return Boolean(json.exists);
}

/** Formats model byte sizes for display. */
function formatBytes(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
