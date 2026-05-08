import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, locales } from "../constants";
import { dom } from "../dom";

/** Populates the source and target language selectors. */
export function loadLanguagePresets(): void {
  dom.sourceLanguageSelect.textContent = "";
  dom.targetLanguageSelect.textContent = "";

  for (const locale of locales) {
    const sourceOption = document.createElement("option");
    sourceOption.value = locale;
    sourceOption.textContent = locale;
    dom.sourceLanguageSelect.append(sourceOption);

    const targetOption = document.createElement("option");
    targetOption.value = locale;
    targetOption.textContent = locale;
    dom.targetLanguageSelect.append(targetOption);
  }

  dom.sourceLanguageSelect.value = DEFAULT_SOURCE_LANGUAGE;
  dom.targetLanguageSelect.value = DEFAULT_TARGET_LANGUAGE;
}
