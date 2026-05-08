import { dom } from "../dom";
import { state } from "../state";
import type { JsonTranslationEvent, PromptModelsResponse } from "../types";
import { updateDownloadJsonButton } from "../ui/download-json";

/** Reads the newline-delimited JSON stream returned by `/translate-json`. */
export async function readJsonTranslationStream(response: Response, fileName: string): Promise<void> {
  if (!response.ok || !response.body) {
    const json = (await response.json()) as PromptModelsResponse;

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
      handleJsonTranslationEvent(JSON.parse(line) as JsonTranslationEvent, fileName);
    }
  }

  if (buffer.trim()) {
    handleJsonTranslationEvent(JSON.parse(buffer) as JsonTranslationEvent, fileName);
  }
}

/** Applies one stream event to the UI and local completed-files state. */
function handleJsonTranslationEvent(event: JsonTranslationEvent, fileName: string): void {
  if (event.type === "ping") {
    return;
  }

  if (event.type === "status") {
    dom.statusElement.textContent = event.message || "Working...";
    return;
  }

  if (event.type === "started") {
    dom.statusElement.textContent = `${fileName}: working ${event.translatedEntries + 1}/${event.totalEntries}: ${event.path}`;
    return;
  }

  if (event.type === "progress") {
    dom.statusElement.textContent = `${fileName}: translated ${event.translatedEntries}/${event.totalEntries}: ${event.path}`;
    dom.result.textContent += `${fileName} | ${event.path}: ${event.translated}\n`;
    return;
  }

  if (event.type === "done") {
    const content = JSON.stringify(event.translated, null, 2);

    state.lastTranslatedJsonFiles.push({
      name: fileName || "translated.json",
      content,
    });
    updateDownloadJsonButton();
    dom.result.textContent += `${fileName}: done ${event.translatedEntries}/${event.totalEntries}\n`;
    return;
  }

  if (event.type === "error") {
    throw new Error(event.error || "JSON translation failed");
  }
}
