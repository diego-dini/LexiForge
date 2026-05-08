import type {
  AiModel,
  PromptModelDetails,
  PromptModels,
  PromptValidationResult,
  TranslatedJsonFile,
} from "./types";

/**
 * Shared mutable UI state.
 *
 * Keeping state in one object avoids scattered module globals and makes it clear
 * which values are intentionally shared across features.
 */
export const state: {
  promptModels: PromptModels;
  promptModelDetails: PromptModelDetails;
  aiModels: AiModel[];
  selectedOllamaModelExists: boolean;
  editorPromptValidationState: PromptValidationResult;
  lastTranslatedJsonFiles: TranslatedJsonFile[];
  promptPreviewRequestId: number;
  messageDialogResolve: ((confirmed: boolean | null) => void) | null;
} = {
  promptModels: {},
  promptModelDetails: {},
  aiModels: [],
  selectedOllamaModelExists: true,
  editorPromptValidationState: { errors: [], warnings: [] },
  lastTranslatedJsonFiles: [],
  promptPreviewRequestId: 0,
  messageDialogResolve: null,
};
