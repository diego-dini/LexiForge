import {
  generateTranslation,
  type OllamaGenerateBody,
} from "./ollama";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonTranslationOptions = {
  model?: string;
  promptModel?: string;
  customPromptModel?: string;
  glossary?: Record<string, string>;
  sourceLanguage: string;
  targetLanguage: string;
};

export type JsonTranslationResult = {
  translated: JsonValue;
  translatedEntries: number;
  totalEntries: number;
};

export type JsonTranslationStreamEvent =
  | {
      type: "started";
      path: string;
      translatedEntries: number;
      totalEntries: number;
    }
  | {
      type: "progress";
      path: string;
      translated: string;
      translatedEntries: number;
      totalEntries: number;
    }
  | {
      type: "done";
      translated: JsonValue;
      translatedEntries: number;
      totalEntries: number;
    };

type GenerateTranslationResponse = {
  response?: unknown;
};

/**
 * Translates every string value in a JSON document while preserving the
 * original object/array structure and non-string values.
 */
export async function translateJsonEntries(
  value: JsonValue,
  options: JsonTranslationOptions,
): Promise<JsonTranslationResult> {
  let translatedEntries = 0;
  const totalEntries = countTranslatableEntries(value);

  async function visit(current: JsonValue): Promise<JsonValue> {
    if (typeof current === "string") {
      if (!current.trim()) {
        return current;
      }

      translatedEntries += 1;

      return translateString(current, options);
    }

    if (Array.isArray(current)) {
      const translatedItems: JsonValue[] = [];

      for (const item of current) {
        translatedItems.push(await visit(item));
      }

      return translatedItems;
    }

    if (current && typeof current === "object") {
      const translatedObject: { [key: string]: JsonValue } = {};

      for (const [key, item] of Object.entries(current)) {
        translatedObject[key] = await visit(item);
      }

      return translatedObject;
    }

    return current;
  }

  return {
    translated: await visit(value),
    translatedEntries,
    totalEntries,
  };
}

/**
 * Streaming variant used by the HTTP route. It yields one progress event after
 * each translated JSON string, then a final event with the full translated JSON.
 */
export async function* translateJsonEntriesStream(
  value: JsonValue,
  options: JsonTranslationOptions,
): AsyncGenerator<JsonTranslationStreamEvent> {
  let translatedEntries = 0;
  const totalEntries = countTranslatableEntries(value);

  async function* visit(
    current: JsonValue,
    path: string,
  ): AsyncGenerator<JsonTranslationStreamEvent, JsonValue> {
    if (typeof current === "string") {
      if (!current.trim()) {
        return current;
      }

      yield {
        type: "started",
        path,
        translatedEntries,
        totalEntries,
      };

      const translated = await translateString(current, options);
      translatedEntries += 1;

      yield {
        type: "progress",
        path,
        translated,
        translatedEntries,
        totalEntries,
      };

      return translated;
    }

    if (Array.isArray(current)) {
      const translatedItems: JsonValue[] = [];

      for (const [index, item] of current.entries()) {
        translatedItems.push(
          yield* visit(item, path ? `${path}.${index}` : String(index)),
        );
      }

      return translatedItems;
    }

    if (current && typeof current === "object") {
      const translatedObject: { [key: string]: JsonValue } = {};

      for (const [key, item] of Object.entries(current)) {
        translatedObject[key] = yield* visit(
          item,
          path ? `${path}.${key}` : key,
        );
      }

      return translatedObject;
    }

    return current;
  }

  const translated = yield* visit(value, "");

  yield {
    type: "done",
    translated,
    translatedEntries,
    totalEntries,
  };
}

function countTranslatableEntries(value: JsonValue): number {
  if (typeof value === "string") {
    return value.trim() ? 1 : 0;
  }

  if (Array.isArray(value)) {
    let total = 0;

    for (const item of value) {
      total += countTranslatableEntries(item);
    }

    return total;
  }

  if (value && typeof value === "object") {
    let total = 0;

    for (const item of Object.values(value)) {
      total += countTranslatableEntries(item);
    }

    return total;
  }

  return 0;
}

function buildTranslationPrompt(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
) {
  return [
    `Translate the following text from ${sourceLanguage} to ${targetLanguage}.`,
    "",
    `"${text}"`,
  ].join("\n");
}

async function translateString(
  text: string,
  options: JsonTranslationOptions,
) {
  const body: OllamaGenerateBody = {
    model: options.model,
    promptModel: options.promptModel,
    customPromptModel: options.customPromptModel,
    glossary: options.glossary,
    prompt: buildTranslationPrompt(
      text,
      options.sourceLanguage,
      options.targetLanguage,
    ),
    temperature: 0.3,
  };

  const response =
    (await generateTranslation(body)) as GenerateTranslationResponse;

  if (typeof response.response !== "string") {
    throw new Error("Ollama response did not include a text response.");
  }

  return response.response;
}
