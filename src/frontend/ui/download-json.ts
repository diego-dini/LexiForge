import { dom } from "../dom";
import { state } from "../state";

/**
 * The JSON stream can finish files one at a time.
 * This keeps the download action visible as soon as at least one file is ready.
 */
export function updateDownloadJsonButton(): void {
  const readyCount = state.lastTranslatedJsonFiles.length;
  const hasReadyFiles = readyCount > 0;

  dom.downloadJsonButton.hidden = !hasReadyFiles;
  dom.downloadJsonButton.classList.toggle("is-hidden", !hasReadyFiles);
  dom.downloadJsonButton.textContent =
    readyCount === 1
      ? "Download 1 ready JSON"
      : `Download ${readyCount} ready JSONs`;
}

/** Downloads every JSON file already completed by the translation stream. */
export function downloadReadyJsonFiles(): void {
  for (const translatedFile of state.lastTranslatedJsonFiles) {
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
}
