export type PreparePromptParams = {
  promptModel?: string;
  customPromptModel?: string;
  glossary?: Record<string, string>;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
};

export const DEFAULT_TRANSLATION_PROMPT = `
Translate the following text from {sourceLanguage} to {targetLanguage}.

Preserve the original meaning, tone, and intent. Adapt idioms and expressions
naturally for native {targetLanguage} speakers, but do not add new information.

Return only the translated text without explanations, comments, or quotation
marks.

{glossary}

Text:
"{text}"
`.trim();

/**
 * Builds the final prompt sent to Ollama.
 *
 * Prompt models are templates. They can come from the internal default, the
 * saved prompt-model JSON file, or a one-off `customPromptModel` request body.
 */
export async function preparePrompt({
  sourceLanguage,
  targetLanguage,
  text,
  promptModel = "default",
  customPromptModel,
  glossary,
}: PreparePromptParams) {
  const { getPromptTemplate } = await import("./services/promptModels");
  const template = await getPromptTemplate(promptModel, customPromptModel);
  const glossaryText = formatGlossary(glossary, text);

  return template
    .replaceAll("{sourceLanguage}", sourceLanguage)
    // `originLanguage` is kept as a friendlier alias used in the editor UI.
    .replaceAll("{originLanguage}", sourceLanguage)
    .replaceAll("{targetLanguage}", targetLanguage)
    .replaceAll("{glossary}", glossaryText)
    .replaceAll("{text}", text);
}

/**
 * Emits only glossary entries that are relevant to the current text so prompts
 * stay small and focused.
 */
function formatGlossary(
  glossary: Record<string, string> | undefined,
  text: string,
) {
  const entries = Object.entries(glossary ?? {}).filter(
    ([source, target]) =>
      source.trim() &&
      target.trim() &&
      textIncludesGlossaryTerm(text, source),
  );

  if (entries.length === 0) {
    return "";
  }

  return [
    "Glossary:",
    ...entries.map(([source, target]) => `- ${source}: ${target}`),
    "",
    "Use the glossary translations exactly when those terms appear.",
  ].join("\n");
}

function textIncludesGlossaryTerm(text: string, term: string) {
  return text
    .toLocaleLowerCase()
    .includes(term.trim().toLocaleLowerCase());
}
