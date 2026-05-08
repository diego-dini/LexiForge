type TranslationRequest = {
  sourceLanguage?: string;
  targetLanguage?: string;
  text?: string;
};

/**
 * Extracts the source language, target language, and quoted dialogue from the
 * prompt format used by the calling app.
 */
export function extractTranslationData(
  prompt: string,
): TranslationRequest {
  const languageMatch = prompt.match(
    /from\s+(.+?)\s+to\s+(.+?)(?:\.|\n)/i,
  );

  const text =
    prompt.match(/"([\s\S]*)"\s*$/)?.[1]?.trim() ??
    prompt.split("immersive:")[1]?.trim().replace(/^\\?"+|\\?"+$/g, "") ??
    prompt.trim();

  return {
    sourceLanguage: languageMatch?.[1]?.trim(),
    targetLanguage: languageMatch?.[2]?.trim(),
    text,
  };
}
