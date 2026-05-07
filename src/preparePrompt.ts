export type PreparePromptParams = {
  promptModel?: string;
  customPromptModel?: string;
  glossary?: Record<string, string>;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
};

const DEFAULT_PROMPT_MODEL = "default";

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

export const FFXIV_SHORT_TRANSLATION_PROMPT = `
Translate the following Final Fantasy XIV dialogue from {sourceLanguage} to {targetLanguage}.

Preserve tone, personality, lore, terminology, and immersion. Adapt idioms and expressions naturally for native {targetLanguage} speakers while keeping consistency with Final Fantasy XIV localization style.

Avoid literal translation when it harms meaning or flow.

{glossary}

Return only the translated text.

Text:
"{text}"
`.trim();

export const FFXIV_LONG_TRANSLATION_PROMPT = `
As an expert translator and cultural localization specialist with deep knowledge of video game localization, your task is to translate dialogues from the game Final Fantasy XIV from {sourceLanguage} to {targetLanguage}.

Preserve tone, humor, emotional nuance, lore, terminology, and character identity. Adapt idioms, wordplay, and cultural references naturally for native {targetLanguage} speakers while maintaining the Final Fantasy XIV universe and localization style.

Maintain consistency with established Final Fantasy XIV terminology, spell names, and narrative conventions. Avoid literal translations that weaken meaning, immersion, or flow.

Ensure the text reads naturally in {targetLanguage}, respecting formal and informal speech patterns appropriate to the character and context.

{glossary}

Return only the translated text without explanations, comments, or quotation marks.

Text:
"{text}"
`.trim();

export const PROMPT_MODELS: Record<string, string> = {
  [DEFAULT_PROMPT_MODEL]: DEFAULT_TRANSLATION_PROMPT,
  "ffxiv-short": FFXIV_SHORT_TRANSLATION_PROMPT,
  "ffxiv-long": FFXIV_LONG_TRANSLATION_PROMPT,
};

export function preparePrompt({
  sourceLanguage,
  targetLanguage,
  text,
  promptModel = DEFAULT_PROMPT_MODEL,
  customPromptModel,
  glossary,
}: PreparePromptParams) {
  const template = getPromptTemplate(promptModel, customPromptModel);
  const glossaryText = formatGlossary(glossary, text);

  return template
    .replaceAll("{sourceLanguage}", sourceLanguage)
    .replaceAll("{targetLanguage}", targetLanguage)
    .replaceAll("{glossary}", glossaryText)
    .replaceAll("{text}", text);
}

function getPromptTemplate(
  promptModel: string,
  customPromptModel?: string,
) {
  if (promptModel === "custom" && customPromptModel?.trim()) {
    return customPromptModel.trim();
  }

  return PROMPT_MODELS[promptModel] ?? DEFAULT_TRANSLATION_PROMPT;
}

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
