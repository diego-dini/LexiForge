import { dom } from "./dom";
import {
  addGlossaryEntry,
  closeGlossaryOverlay,
  downloadGlossary,
  loadGlossaryFromSelectedFile,
  openGlossaryOverlay,
  setGlossaryChangedHandler,
} from "./features/glossary";
import { loadLanguagePresets } from "./features/languages";
import { installAiModel, loadOllamaModels, updateSelectedOllamaModelNotice } from "./features/ollama-models";
import {
  deletePromptModelFromEditor,
  loadPromptModels,
  loadSelectedPromptModelIntoEditor,
  savePromptModel,
  startNewPromptModel,
  updateCustomPromptVisibility,
  updateEditorPromptModelName,
  updateEditorPromptPreview,
} from "./features/prompt-models";
import { updatePromptPreview } from "./features/prompt-preview";
import { handleTranslateSubmit, updateInputTypeVisibility } from "./features/translation";
import { downloadReadyJsonFiles } from "./ui/download-json";
import { closeMessageDialog } from "./ui/message-dialog";
import { showPage } from "./ui/pages";

/** Wires all DOM events used by the frontend. */
function registerEventListeners(): void {
  for (const navButton of dom.navButtons) {
    navButton.addEventListener("click", () => {
      showPage(navButton.dataset.pageTarget);
    });
  }

  dom.promptModel.addEventListener("change", () => {
    updateCustomPromptVisibility();
    void updatePromptPreview();
  });

  dom.modelSelect.addEventListener("change", () => void updateSelectedOllamaModelNotice());

  dom.inputType.addEventListener("change", () => {
    updateInputTypeVisibility();
    void updatePromptPreview();
  });

  dom.customPromptModel.addEventListener("input", () => void updatePromptPreview());
  dom.glossaryInput.addEventListener("input", () => void updatePromptPreview());
  dom.jsonFile.addEventListener("change", () => void updatePromptPreview());
  dom.loadGlossaryButton.addEventListener("click", () => dom.glossaryFileInput.click());
  dom.glossaryFileInput.addEventListener("change", () => void loadGlossaryFromSelectedFile());
  dom.downloadGlossaryButton.addEventListener("click", downloadGlossary);
  dom.openGlossaryEntryButton.addEventListener("click", openGlossaryOverlay);

  dom.promptModelForm.addEventListener("submit", (event) => void savePromptModel(event));
  dom.editorPromptModel.addEventListener("change", loadSelectedPromptModelIntoEditor);
  dom.editorPromptModelName.addEventListener("input", updateEditorPromptModelName);
  dom.editorPromptModelTemplate.addEventListener("input", updateEditorPromptPreview);
  dom.newPromptModelButton.addEventListener("click", startNewPromptModel);
  dom.deleteEditorPromptModelButton.addEventListener("click", () => void deletePromptModelFromEditor());

  dom.installAiModelButton.addEventListener("click", () => void installAiModel());

  dom.messageDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    closeMessageDialog(true);
  });
  dom.messageDialogCancelButton.addEventListener("click", () => closeMessageDialog(false));
  dom.messageDialogCloseButton.addEventListener("click", () => closeMessageDialog(false));
  dom.messageOverlay.addEventListener("click", (event) => {
    if (event.target === dom.messageOverlay) {
      closeMessageDialog(false);
    }
  });

  dom.closeGlossaryEntryButton.addEventListener("click", closeGlossaryOverlay);
  dom.cancelGlossaryEntryButton.addEventListener("click", closeGlossaryOverlay);
  dom.glossaryOverlay.addEventListener("click", (event) => {
    if (event.target === dom.glossaryOverlay) {
      closeGlossaryOverlay();
    }
  });
  dom.glossaryEntryForm.addEventListener("submit", addGlossaryEntry);

  dom.form.addEventListener("input", () => void updatePromptPreview());
  dom.form.addEventListener("change", () => void updatePromptPreview());
  dom.form.addEventListener("submit", (event) => void handleTranslateSubmit(event as SubmitEvent));

  dom.downloadJsonButton.addEventListener("click", downloadReadyJsonFiles);

  window.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  window.addEventListener("drop", handleJsonFileDrop);
}

/** Handles dropping JSON files anywhere in the window. */
function handleJsonFileDrop(event: DragEvent): void {
  event.preventDefault();

  const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
    file.name.toLowerCase().endsWith(".json"),
  );

  if (files.length === 0) {
    return;
  }

  const transfer = new DataTransfer();

  for (const file of files) {
    transfer.items.add(file);
  }

  dom.jsonFile.files = transfer.files;
  dom.inputType.value = "json";
  updateInputTypeVisibility();
  void updatePromptPreview();
  dom.statusElement.textContent = `${files.length} JSON file${files.length === 1 ? "" : "s"} ready.`;
}

/** Initializes the translation UI. */
function init(): void {
  setGlossaryChangedHandler(() => updatePromptPreview());
  registerEventListeners();
  updateCustomPromptVisibility();
  updateInputTypeVisibility();
  loadLanguagePresets();
  void loadPromptModels();
  void loadOllamaModels();
}

init();
