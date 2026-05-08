/**
 * Shared application types.
 *
 * Keep this file free of runtime code. It can be imported anywhere without
 * creating side effects in the browser bundle.
 */

export type Glossary = Record<string, string>;
export type PromptModels = Record<string, string>;
export type MessageDialogMode = "prompt" | "confirm" | "message";

export type PromptValidationResult = {
  errors: string[];
  warnings: string[];
};

export type PromptModelDetail = {
  template: string;
  saved: boolean;
};

export type PromptModelDetails = Record<string, PromptModelDetail>;

export type AiModel = {
  name?: string;
  size?: number;
};

export type TranslatedJsonFile = {
  name: string;
  content: string;
};

export type MessageDialogOptions = {
  title: string;
  message: string;
  value?: string;
  confirmText?: string;
};

export type OpenMessageDialogOptions = Required<MessageDialogOptions> & {
  mode: MessageDialogMode;
};

export type RenderPromptTemplateOptions = {
  template: string;
  sourceLanguage: string;
  targetLanguage: string;
  glossary?: Glossary;
  text: string;
};

export type TranslationOptions = {
  model: string;
  promptModel: string;
  customPromptModel: string;
  glossary?: Glossary;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
};

export type TranslationBody = {
  model: string;
  promptModel: string;
  prompt: string;
  temperature: number;
  glossary?: Glossary;
  customPromptModel?: string;
};

export type TranslateJsonOptions = Omit<TranslationOptions, "text"> & {
  file: File;
};

export type PostPromptModelOptions = {
  name: string;
  template: string;
  overwrite: boolean;
};

export type JsonTranslationEvent =
  | { type: "ping" }
  | { type: "status"; message?: string }
  | {
      type: "started";
      translatedEntries: number;
      totalEntries: number;
      path: string;
    }
  | {
      type: "progress";
      translatedEntries: number;
      totalEntries: number;
      path: string;
      translated: string;
    }
  | {
      type: "done";
      translatedEntries: number;
      totalEntries: number;
      translated: unknown;
    }
  | { type: "error"; error?: string };

export type JsonErrorResponse = {
  error?: string;
};

export type PromptModelsResponse = JsonErrorResponse & {
  promptModels?: PromptModels;
};

export type OllamaModelsResponse = JsonErrorResponse & {
  models?: AiModel[];
};

export type OllamaPullResponse = JsonErrorResponse & {
  installed?: boolean;
  message?: string;
};

export type OllamaExistsResponse = JsonErrorResponse & {
  exists?: boolean;
};

export type TranslationResponse = JsonErrorResponse & {
  response?: string;
};
