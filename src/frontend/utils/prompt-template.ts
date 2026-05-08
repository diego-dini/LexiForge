import type { Glossary, PromptValidationResult, RenderPromptTemplateOptions } from "../types";

/**
 * Replaces frontend prompt placeholders using the same conventions as the backend.
 * Keep this behavior aligned with your server-side `preparePrompt.ts`.
 */
export function renderPromptTemplate({
  template,
  sourceLanguage,
  targetLanguage,
  glossary,
  text,
}: RenderPromptTemplateOptions): string {
  const glossaryText = formatGlossary(glossary, text);

  return template
    .replaceAll("{sourceLanguage}", sourceLanguage)
    .replaceAll("{originLanguage}", sourceLanguage)
    .replaceAll("{targetLanguage}", targetLanguage)
    .replaceAll("{glossary}", glossaryText)
    .replaceAll("{text}", text);
}

/**
 * Validates placeholders before saving a prompt model.
 * Errors block saving; warnings are recommendations only.
 */
export function validatePromptTemplate(template: string): PromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template.includes("{text}")) {
    errors.push("Missing required key {text}.");
  }

  if (!template.includes("{targetLanguage}")) {
    errors.push("Missing required key {targetLanguage}.");
  }

  if (
    !template.includes("{sourceLanguage}") &&
    !template.includes("{originLanguage}")
  ) {
    warnings.push("Recommended key missing: {originLanguage}.");
  }

  if (!template.includes("{glossary}")) {
    warnings.push("Recommended key missing: {glossary}.");
  }

  return { errors, warnings };
}

/** Converts a readable model name into the persisted/API key format. */
export function normalizePromptModelName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/** Converts persisted model keys into labels suitable for selectors. */
export function displayPromptModelName(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Builds the simple fallback prompt sent to the backend. */
export function buildPrompt(sourceLanguage: string, targetLanguage: string, text: string): string {
  return [
    `Translate the following text from ${sourceLanguage} to ${targetLanguage}.`,
    "",
    `"${text}"`,
  ].join("\n");
}

/**
 * Only includes glossary terms that actually appear in the text.
 * This keeps prompts smaller and avoids unrelated glossary noise.
 */
export function formatGlossary(glossary: Glossary | undefined, text: string): string {
  const entries = Object.entries(glossary || {}).filter(
    ([source, target]) =>
      source.trim() &&
      target.trim() &&
      text.toLocaleLowerCase().includes(source.trim().toLocaleLowerCase()),
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

/** Recursively finds the first non-empty string inside a JSON-like value. */
export function findFirstString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim() ? value : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstString(item);

      if (found !== undefined) {
        return found;
      }
    }
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = findFirstString(item);

      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}
