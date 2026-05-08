import type { PromptModels } from "./types";

/** Languages displayed in the source/target language selectors. */
export const locales = [
  "unknown",
  "English",
  "Portuguese",
  "Brazilian Portuguese",
  "European Portuguese",
  "Japanese",
  "Spanish",
  "Latin American Spanish",
  "French",
  "German",
  "Italian",
  "Korean",
  "Simplified Chinese",
  "Traditional Chinese",
  "Russian",
  "Polish",
  "Dutch",
  "Turkish",
  "Arabic",
  "Hindi",
  "Thai",
  "Vietnamese",
  "Indonesian",
] as const;

/**
 * Used when the prompt API is unavailable.
 * Add local emergency templates here if you want the UI to keep working offline.
 */
export const fallbackPromptModels: PromptModels = {};

export const DEFAULT_OLLAMA_MODEL = "translategemma:4b";
export const DEFAULT_TARGET_LANGUAGE = "Brazilian Portuguese";
export const DEFAULT_SOURCE_LANGUAGE = "English";
