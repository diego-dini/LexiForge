/**
 * Typed DOM access helpers.
 *
 * They fail early if the expected HTML structure is missing. This makes errors
 * easier to diagnose during development instead of failing later as `null`.
 */
function qs<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing DOM element: ${selector}`);
  }

  return element;
}

function qsa<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}

/** All DOM elements used by the frontend. */
export const dom = {
  form: qs<HTMLFormElement>("#translateForm"),
  pages: qsa<HTMLElement>(".page"),
  navButtons: qsa<HTMLElement>("[data-page-target]"),
  result: qs<HTMLElement>("#result"),
  statusElement: qs<HTMLElement>("#status"),
  submitButton: qs<HTMLButtonElement>("#submitButton"),
  downloadJsonButton: qs<HTMLButtonElement>("#downloadJsonButton"),
  inputType: qs<HTMLSelectElement>("#inputType"),
  textInputWrap: qs<HTMLElement>("#textInputWrap"),
  jsonInputWrap: qs<HTMLElement>("#jsonInputWrap"),
  textInput: qs<HTMLTextAreaElement>('textarea[name="text"]'),
  jsonFile: qs<HTMLInputElement>("#jsonFile"),
  promptModel: qs<HTMLSelectElement>("#promptModel"),
  customPromptWrap: qs<HTMLElement>("#customPromptWrap"),
  customPromptModel: qs<HTMLTextAreaElement>("#customPromptModel"),
  glossaryInput: qs<HTMLTextAreaElement>("#glossaryInput"),
  glossaryFileInput: qs<HTMLInputElement>("#glossaryFileInput"),
  loadGlossaryButton: qs<HTMLButtonElement>("#loadGlossaryButton"),
  downloadGlossaryButton: qs<HTMLButtonElement>("#downloadGlossaryButton"),
  openGlossaryEntryButton: qs<HTMLButtonElement>("#openGlossaryEntryButton"),
  savePromptModelButton: qs<HTMLButtonElement>("#savePromptModelButton"),
  glossaryOverlay: qs<HTMLElement>("#glossaryOverlay"),
  glossaryEntryForm: qs<HTMLFormElement>("#glossaryEntryForm"),
  glossarySourceInput: qs<HTMLInputElement>("#glossarySourceInput"),
  glossaryTargetInput: qs<HTMLInputElement>("#glossaryTargetInput"),
  closeGlossaryEntryButton: qs<HTMLButtonElement>("#closeGlossaryEntryButton"),
  cancelGlossaryEntryButton: qs<HTMLButtonElement>("#cancelGlossaryEntryButton"),
  promptPreview: qs<HTMLElement>("#promptPreview"),
  modelSelect: qs<HTMLSelectElement>("#model"),
  modelMissingNotice: qs<HTMLElement>("#modelMissingNotice"),
  sourceLanguageSelect: qs<HTMLSelectElement>("#sourceLanguage"),
  targetLanguageSelect: qs<HTMLSelectElement>("#targetLanguage"),
  promptModelForm: qs<HTMLFormElement>("#promptModelForm"),
  editorPromptModel: qs<HTMLSelectElement>("#editorPromptModel"),
  editorPromptModelName: qs<HTMLInputElement>("#editorPromptModelName"),
  editorPromptModelTemplate: qs<HTMLTextAreaElement>("#editorPromptModelTemplate"),
  newPromptModelButton: qs<HTMLButtonElement>("#newPromptModelButton"),
  deleteEditorPromptModelButton: qs<HTMLButtonElement>("#deleteEditorPromptModelButton"),
  promptEditorStatus: qs<HTMLElement>("#promptEditorStatus"),
  editorPromptValidation: qs<HTMLElement>("#editorPromptValidation"),
  editorPromptPreview: qs<HTMLElement>("#editorPromptPreview"),
  installAiModelButton: qs<HTMLButtonElement>("#installAiModelButton"),
  aiModelList: qs<HTMLElement>("#aiModelList"),
  aiModelsStatus: qs<HTMLElement>("#aiModelsStatus"),
  messageOverlay: qs<HTMLElement>("#messageOverlay"),
  messageDialogForm: qs<HTMLFormElement>("#messageDialogForm"),
  messageDialogTitle: qs<HTMLElement>("#messageDialogTitle"),
  messageDialogText: qs<HTMLElement>("#messageDialogText"),
  messageDialogInputWrap: qs<HTMLElement>("#messageDialogInputWrap"),
  messageDialogInput: qs<HTMLInputElement>("#messageDialogInput"),
  messageDialogConfirmButton: qs<HTMLButtonElement>("#messageDialogConfirmButton"),
  messageDialogCancelButton: qs<HTMLButtonElement>("#messageDialogCancelButton"),
  messageDialogCloseButton: qs<HTMLButtonElement>("#messageDialogCloseButton"),
};
