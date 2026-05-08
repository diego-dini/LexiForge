import { mkdir } from "node:fs/promises";
import { DEFAULT_TRANSLATION_PROMPT } from "../preparePrompt";

export const DEFAULT_PROMPT_MODEL = "default";

const PROMPT_MODELS_DIR = new URL("../../../prompt-models/", import.meta.url);
const PROMPT_MODELS_FILE = new URL(
  "prompt-models.json",
  PROMPT_MODELS_DIR,
);

export const BUILT_IN_PROMPT_MODELS: Record<string, string> = {
  [DEFAULT_PROMPT_MODEL]: DEFAULT_TRANSLATION_PROMPT,
};

export type PromptModelValidation = {
  errors: string[];
  warnings: string[];
};

export async function getPromptModels(): Promise<Record<string, string>> {
  return {
    ...BUILT_IN_PROMPT_MODELS,
    ...(await readSavedPromptModels()),
  };
}

/**
 * Returns only models that users are allowed to see and manage.
 *
 * The translation flow can still resolve `default` through `getPromptModels`,
 * but the UI/API surface should never expose it as editable state.
 */
export async function getVisiblePromptModels(): Promise<Record<string, string>> {
  return readSavedPromptModels();
}

/**
 * Resolves the template used by the translation flow.
 *
 * `custom` is a transient prompt supplied with the request body. All other
 * names are looked up from the built-in default plus the saved JSON file.
 */
export async function getPromptTemplate(
  promptModel: string,
  customPromptModel?: string,
) {
  if (promptModel === "custom" && customPromptModel?.trim()) {
    return customPromptModel.trim();
  }

  const promptModels = await getPromptModels();

  return promptModels[promptModel] ?? DEFAULT_TRANSLATION_PROMPT;
}

/**
 * Creates or replaces a saved prompt model after enforcing all invariants:
 * normalized names, reserved names, required placeholders, and overwrite rules.
 */
export async function savePromptModel({
  name,
  template,
  overwrite = false,
}: {
  name: string;
  template: string;
  overwrite?: boolean;
}) {
  const normalizedName = normalizePromptModelName(name);
  const normalizedTemplate = template.trim();

  if (!normalizedName) {
    throw new Error("Prompt model name is required.");
  }

  if (normalizedName === "custom") {
    throw new Error("Use another name. custom is reserved.");
  }

  if (normalizedName === DEFAULT_PROMPT_MODEL) {
    throw new Error("The default prompt model is internal and cannot be edited.");
  }

  if (!normalizedTemplate) {
    throw new Error("Prompt model template is required.");
  }

  const validation = validatePromptTemplate(normalizedTemplate);

  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(" "));
  }

  const promptModels = await getPromptModels();

  if (!overwrite && promptModels[normalizedName] !== undefined) {
    return {
      saved: false,
      exists: true,
      promptModels,
    };
  }

  const savedPromptModels = await readSavedPromptModels();
  savedPromptModels[normalizedName] = normalizedTemplate;
  await writeSavedPromptModels(savedPromptModels);

  return {
    saved: true,
    exists: false,
    promptModels: await getVisiblePromptModels(),
  };
}

/**
 * Validates prompt placeholders.
 *
 * Missing `{text}` and `{targetLanguage}` are errors because the translator
 * cannot know what to translate or which language to target. Source language
 * and glossary are softer requirements, so they are warnings.
 */
export function validatePromptTemplate(
  template: string,
): PromptModelValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template.includes("{text}")) {
    errors.push("Prompt model must include {text}.");
  }

  if (!template.includes("{targetLanguage}")) {
    errors.push("Prompt model must include {targetLanguage}.");
  }

  if (
    !template.includes("{sourceLanguage}") &&
    !template.includes("{originLanguage}")
  ) {
    warnings.push(
      "Prompt model does not include {originLanguage} or {sourceLanguage}.",
    );
  }

  if (!template.includes("{glossary}")) {
    warnings.push("Prompt model does not include {glossary}.");
  }

  return { errors, warnings };
}

/**
 * Converts a user-facing name into the stable key stored in JSON and used by
 * API routes. The frontend mirrors this so the UI can preview the final key.
 */
export function normalizePromptModelName(name: string) {
  return name
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

/**
 * Deletes a saved prompt model. Built-in/internal models are blocked even if a
 * direct API caller tries to address them by name.
 */
export async function deletePromptModel(name: string) {
  const normalizedName = normalizePromptModelName(name);

  if (!normalizedName) {
    throw new Error("Prompt model name is required.");
  }

  if (normalizedName === DEFAULT_PROMPT_MODEL) {
    throw new Error("The default prompt model is internal and cannot be deleted.");
  }

  const savedPromptModels = await readSavedPromptModels();

  if (savedPromptModels[normalizedName] === undefined) {
    throw new Error("Only saved prompt models can be deleted.");
  }

  delete savedPromptModels[normalizedName];
  await writeSavedPromptModels(savedPromptModels);

  return {
    deleted: true,
    promptModels: await getVisiblePromptModels(),
  };
}

/**
 * Returns saved models with metadata for management screens.
 *
 * At the moment every visible model is saved/deletable because built-ins are
 * hidden from the management API.
 */
export async function getPromptModelDetails() {
  const savedPromptModels = await readSavedPromptModels();

  return Object.fromEntries(
    Object.entries(savedPromptModels).map(([name, template]) => [
      name,
      {
        template,
        saved: true,
      },
    ]),
  );
}

/**
 * Reads `prompt-models/prompt-models.json` defensively.
 *
 * Invalid shapes fail loudly. Invalid names are normalized, and `default` is
 * ignored so the file cannot override the internal fallback prompt.
 */
async function readSavedPromptModels() {
  const file = Bun.file(PROMPT_MODELS_FILE);

  if (!(await file.exists())) {
    return {};
  }

  const parsed = JSON.parse(await file.text()) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Saved prompt models file must be a JSON object.");
  }

  const promptModels: Record<string, string> = {};

  for (const [name, template] of Object.entries(parsed)) {
    const normalizedName = normalizePromptModelName(name);

    if (
      typeof template === "string" &&
      normalizedName &&
      normalizedName !== DEFAULT_PROMPT_MODEL &&
      template.trim()
    ) {
      promptModels[normalizedName] = template;
    }
  }

  return promptModels;
}

// Persist using a stable, human-readable JSON format.
async function writeSavedPromptModels(promptModels: Record<string, string>) {
  await mkdir(PROMPT_MODELS_DIR, { recursive: true });
  await Bun.write(
    PROMPT_MODELS_FILE,
    `${JSON.stringify(promptModels, null, 2)}\n`,
  );
}
