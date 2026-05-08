import { DEFAULT_OLLAMA_MODEL, DEFAULT_TARGET_LANGUAGE } from "../constants";
import { dom } from "../dom";
import { state } from "../state";
import type { TranslationBody, TranslationOptions, TranslationResponse, TranslateJsonOptions } from "../types";
import { parseGlossaryInput } from "./glossary";
import { readJsonTranslationStream } from "./json-stream";
import { updateSelectedOllamaModelNotice } from "./ollama-models";
import { buildPrompt } from "../utils/prompt-template";
import { updateDownloadJsonButton } from "../ui/download-json";

/** Shows/hides text input versus JSON-file input. */
export function updateInputTypeVisibility(): void {
  const isJson = dom.inputType.value === "json";

  dom.textInputWrap.hidden = isJson;
  dom.textInputWrap.classList.toggle("is-hidden", isJson);
  dom.textInput.disabled = isJson;
  dom.textInput.required = !isJson;

  dom.jsonInputWrap.hidden = !isJson;
  dom.jsonInputWrap.classList.toggle("is-hidden", !isJson);
  dom.jsonFile.disabled = !isJson;
  dom.jsonFile.required = isJson;
}

/** Handles the main translation form submit. */
export async function handleTranslateSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();

  const data = new FormData(dom.form);
  const sourceLanguage = String(data.get("sourceLanguage") || "unknown");
  const targetLanguage = String(data.get("targetLanguage") || DEFAULT_TARGET_LANGUAGE);
  const text = String(data.get("text") || "");
  const selectedPromptModel = String(data.get("promptModel") || "default");
  const selectedCustomPromptModel = String(data.get("customPromptModel") || "");
  const glossary = parseGlossaryInput(true);
  const model = String(data.get("model") || DEFAULT_OLLAMA_MODEL);
  await updateSelectedOllamaModelNotice();

  if (!state.selectedOllamaModelExists) {
    dom.statusElement.textContent = "Model missing";
    dom.result.textContent = `Install the selected Ollama model before translating: ${model}`;
    return;
  }

  dom.submitButton.disabled = true;
  state.lastTranslatedJsonFiles = [];
  updateDownloadJsonButton();
  dom.statusElement.textContent =
    dom.inputType.value === "json" ? "Translating JSON..." : "Translating...";
  dom.result.textContent = "";

  try {
    const response =
      dom.inputType.value === "json"
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

    if (dom.inputType.value === "json") {
      await translateSelectedJsonFiles({
        model,
        promptModel: selectedPromptModel,
        customPromptModel: selectedCustomPromptModel,
        glossary,
        sourceLanguage,
        targetLanguage,
      });
    } else {
      await renderTextTranslationResponse(response);
    }
  } catch (error) {
    dom.result.textContent = error instanceof Error ? error.message : String(error);
    dom.statusElement.textContent = "Error";
  } finally {
    dom.submitButton.disabled = false;
  }
}

/** Sends all selected JSON files to the streaming translation endpoint. */
async function translateSelectedJsonFiles(options: Omit<TranslateJsonOptions, "file">): Promise<void> {
  const files = Array.from(dom.jsonFile.files ?? []);

  if (files.length === 0) {
    throw new Error("Select at least one JSON file.");
  }

  for (const [index, file] of files.entries()) {
    dom.statusElement.textContent = `File ${index + 1}/${files.length}: ${file.name}`;

    const response = await translateJson({
      ...options,
      file,
    });

    await readJsonTranslationStream(response, file.name);
  }

  dom.statusElement.textContent = `Done. Translated ${state.lastTranslatedJsonFiles.length} JSON file${state.lastTranslatedJsonFiles.length === 1 ? "" : "s"}.`;
}

/** Renders the normal text translation response. */
async function renderTextTranslationResponse(response: Response | null): Promise<void> {
  if (!response) {
    throw new Error("Translation response missing.");
  }

  const json = (await response.json()) as TranslationResponse;

  if (!response.ok) {
    throw new Error(json.error || "Translation request failed");
  }

  dom.result.textContent = json.response ?? JSON.stringify(json, null, 2);
  dom.statusElement.textContent = "Done";
}

/** Builds the JSON body sent to the Ollama proxy endpoint. */
function buildTranslationBody({
  model,
  promptModel,
  customPromptModel,
  glossary,
  sourceLanguage,
  targetLanguage,
  text,
}: TranslationOptions): TranslationBody {
  const body: TranslationBody = {
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

/** Sends a normal text translation request. */
function translateText(options: TranslationOptions): Promise<Response> {
  return fetch("/ollama/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildTranslationBody(options)),
  });
}

/** Sends one JSON file to the streaming translation endpoint. */
function translateJson({
  file,
  model,
  promptModel,
  customPromptModel,
  glossary,
  sourceLanguage,
  targetLanguage,
}: TranslateJsonOptions): Promise<Response> {
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

  return fetch("/ollama/api/translate-json", {
    method: "POST",
    body: jsonData,
  });
}
