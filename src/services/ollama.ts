import { extractTranslationData } from "../extractTranslationData";
import { preparePrompt } from "../preparePrompt";
import { debugLog } from "../logger";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";

const FALLBACK_MODEL = "translategemma:4b";
const MODEL_CACHE_TTL_MS = Number(process.env.MODEL_CACHE_TTL_MS ?? 60_000);

// Model names are cached because resolveModel can run for every intercepted
// generation request. Without this, every translation would call /api/tags.
let cachedModels: string[] | null = null;
let cachedModelsAt = 0;

// Keeps concurrent cache misses from triggering multiple /api/tags requests.
let modelsRequest: Promise<string[]> | null = null;

/**
 * Small client for the Ollama HTTP API.
 *
 * The interceptor receives requests from the translation client, normalizes the
 * prompt, and forwards only the fields this project needs to Ollama.
 */
type OllamaTag = {
  name: string;
};

type OllamaTagsResponse = {
  models: OllamaTag[];
};

/**
 * Calls the real Ollama server.
 *
 * All public functions in this file should go through this helper so host
 * configuration, request formatting, and future error handling stay in one
 * place.
 */
async function ollamaFetch(path: string, options?: RequestInit) {
  const response = await fetch(`${OLLAMA_HOST}${path}`, options);

  return response.json();
}

/**
 * Returns the installed models from Ollama.
 *
 * This function intentionally does not use the cache. Routes that proxy
 * /api/tags should return the real current Ollama state.
 */
export async function getTags(): Promise<OllamaTagsResponse> {
  debugLog("[ollama:getTags]");

  return ollamaFetch("/api/tags") as any as OllamaTagsResponse;
}

/**
 * Returns cached model names for internal model resolution.
 *
 * The cache keeps the interceptor responsive while still refreshing
 * periodically, which is useful when models are installed or removed while the
 * app is running.
 */
async function getAvailableModels() {
  const now = Date.now();

  if (cachedModels && now - cachedModelsAt < MODEL_CACHE_TTL_MS) {
    return cachedModels;
  }

  if (modelsRequest) {
    return modelsRequest;
  }

  modelsRequest = getTags()
    .then((tags) => {
      cachedModels = tags.models.map((model) => model.name);
      cachedModelsAt = Date.now();

      return cachedModels;
    })
    .finally(() => {
      modelsRequest = null;
    });

  return modelsRequest;
}

/**
 * Proxies Ollama's /api/ps endpoint.
 *
 * The calling app can use this to discover which models are currently loaded.
 */
export async function getRunningModels() {
  debugLog("[ollama:getRunningModels]");

  return ollamaFetch("/api/ps");
}

/**
 * Proxies Ollama's /api/show endpoint.
 *
 * The body is passed through unchanged because the caller controls which model
 * metadata it wants to inspect.
 */
export async function showModel(body: unknown) {
  debugLog("[ollama:showModel]", body);

  return ollamaFetch("/api/show", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

type GenerateRequestParams = {
  model: string;
  prompt: string;
  temperature?: number;
};

export type OllamaGenerateBody = {
  model?: string;
  promptModel?: string;
  customPromptModel?: string;
  glossary?: Record<string, string>;
  prompt?: string;
  temperature?: number;
};

/**
 * Sends a normalized non-streaming generation request to Ollama.
 *
 * This is the low-level generate function. It expects a final prompt that is
 * already ready for the model.
 */
export async function generate({
  model,
  prompt,
  temperature = 0.4,
}: GenerateRequestParams) {
  const body = {
    model,
    prompt,
    temperature,
    stream: false,
  };

  debugLog("[ollama:generate]");
  debugLog(JSON.stringify(body, null, 2));

  const response = await ollamaFetch("/api/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });

  debugLog("[ollama:response]");
  debugLog(JSON.stringify(response, null, 2));

  return response;
}

/**
 * Converts the intercepted generate body into this project's translation flow.
 *
 * The original prompt is parsed for language and text data, then rendered
 * through the selected prompt model before calling Ollama.
 */
export async function generateTranslation(body: OllamaGenerateBody) {
  const extracted = extractTranslationData(body.prompt ?? "");

  const prompt = await preparePrompt({
    promptModel: body.promptModel,
    customPromptModel: body.customPromptModel,
    glossary: body.glossary,
    sourceLanguage: extracted.sourceLanguage ?? "English",
    targetLanguage: extracted.targetLanguage ?? "Portuguese",
    text: extracted.text ?? "",
  });

  return generate({
    model: await resolveModel(body.model),
    prompt,
    temperature: body.temperature,
  });
}

/**
 * Uses the requested model when it exists, otherwise falls back to the default.
 *
 * Internal model checks use the cached model list to avoid querying Ollama for
 * every request.
 */
export async function resolveModel(model?: string) {
  if (!model) {
    return FALLBACK_MODEL;
  }

  const models = await getAvailableModels();
  const exists = models.includes(model);

  if (!exists) {
    debugLog(`[ollama:model-fallback] ${model} -> ${FALLBACK_MODEL}`);

    return FALLBACK_MODEL;
  }

  return model;
}
