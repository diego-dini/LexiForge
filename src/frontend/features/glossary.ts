import { dom } from "../dom";
import type { Glossary } from "../types";

let onGlossaryChanged: () => void | Promise<void> = () => undefined;

/** Registers the callback used to refresh prompt previews after glossary edits. */
export function setGlossaryChangedHandler(handler: () => void | Promise<void>): void {
  onGlossaryChanged = handler;
}

/** Parses the manual glossary textarea into a clean object. */
export function parseGlossaryInput(throwOnInvalid: boolean): Glossary | undefined {
  const value = dom.glossaryInput.value.trim();

  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Glossary must be a JSON object.");
    }

    const glossary: Glossary = {};

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

/** Loads a glossary JSON file selected by the user into the textarea. */
export async function loadGlossaryFromSelectedFile(): Promise<void> {
  const file = dom.glossaryFileInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    const glossary = normalizeGlossary(parsed);

    dom.glossaryInput.value = JSON.stringify(glossary, null, 2);
    dom.glossaryFileInput.value = "";
    await onGlossaryChanged();
    dom.statusElement.textContent = `Glossary loaded: ${Object.keys(glossary).length} entries.`;
  } catch (error) {
    dom.statusElement.textContent = "Error";
    dom.result.textContent =
      error instanceof Error ? error.message : "Invalid glossary file.";
  }
}

/** Downloads the current glossary textarea content as `glossary.json`. */
export function downloadGlossary(): void {
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

/** Opens the small modal used to add one glossary entry at a time. */
export function openGlossaryOverlay(): void {
  dom.glossaryOverlay.hidden = false;
  dom.glossaryOverlay.classList.remove("is-hidden");
  dom.glossarySourceInput.value = "";
  dom.glossaryTargetInput.value = "";
  dom.glossarySourceInput.focus();
}

/** Closes the glossary-entry modal. */
export function closeGlossaryOverlay(): void {
  dom.glossaryOverlay.hidden = true;
  dom.glossaryOverlay.classList.add("is-hidden");
}

/** Adds a source/target glossary pair from the modal into the textarea JSON. */
export function addGlossaryEntry(event: Event): void {
  event.preventDefault();

  const source = dom.glossarySourceInput.value.trim();
  const target = dom.glossaryTargetInput.value.trim();

  if (!source || !target) {
    return;
  }

  const glossary = parseGlossaryInput(false) || {};
  glossary[source] = target;
  dom.glossaryInput.value = JSON.stringify(glossary, null, 2);

  closeGlossaryOverlay();
  void onGlossaryChanged();
  dom.statusElement.textContent = `Glossary entry added: ${source}`;
}

/** Normalizes external glossary JSON into `Record<string, string>`. */
export function normalizeGlossary(value: unknown): Glossary {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Glossary file must be a JSON object.");
  }

  const glossary: Glossary = {};

  for (const [source, target] of Object.entries(value as Record<string, unknown>)) {
    if (typeof target === "string" && source.trim() && target.trim()) {
      glossary[source] = target;
    }
  }

  return glossary;
}
