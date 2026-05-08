import { DEFAULT_TARGET_LANGUAGE } from "../constants";
import { dom } from "../dom";
import { state } from "../state";
import { parseGlossaryInput } from "./glossary";
import { findFirstString, renderPromptTemplate } from "../utils/prompt-template";

/** Updates the translation-page prompt preview. */
export async function updatePromptPreview(): Promise<void> {
  const requestId = ++state.promptPreviewRequestId;
  const data = new FormData(dom.form);
  const sourceLanguage = String(data.get("sourceLanguage") || "unknown");
  const targetLanguage = String(data.get("targetLanguage") || DEFAULT_TARGET_LANGUAGE);
  const text =
    dom.inputType.value === "json"
      ? await getFirstJsonTextForPreview()
      : String(data.get("text") || "");
  const glossary = parseGlossaryInput(false);
  const template =
    dom.promptModel.value === "custom"
      ? dom.customPromptModel.value
      : state.promptModels[dom.promptModel.value] || state.promptModels.default || "";

  // Ignore stale async preview updates when the user changes files quickly.
  if (requestId !== state.promptPreviewRequestId) {
    return;
  }

  dom.promptPreview.textContent = renderPromptTemplate({
    template,
    sourceLanguage,
    targetLanguage,
    glossary,
    text,
  });
}

/** Reads the first meaningful string from the selected JSON file for preview. */
async function getFirstJsonTextForPreview(): Promise<string> {
  const file = dom.jsonFile.files?.[0];

  if (!file) {
    return "";
  }

  try {
    return findFirstString(JSON.parse(await file.text()) as unknown) ?? "";
  } catch {
    return "";
  }
}
