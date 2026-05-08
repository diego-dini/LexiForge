import { Hono } from "hono";
import { logRequestError, debugLog } from "../logger";
import {
  deleteModel,
  generateTranslation,
  getRunningModels,
  getTags,
  modelExists,
  pullModel,
  type OllamaGenerateBody,
  showModel,
} from "../services/ollama";
import { translateJsonEntriesStream } from "../services/jsonTranslator";

/**
 * Routes that proxy or orchestrate Ollama-backed work.
 *
 * The public prefix is mounted as `/ollama/api` in `index.ts` so AI model and
 * generation operations are separated from LexiForge's own app APIs.
 */
export const ollamaRoutes = new Hono();

ollamaRoutes.get("/tags", async (c) => {
  debugLog("[route:/ollama/api/tags]");

  return c.json(await getTags());
});

ollamaRoutes.get("/ps", async (c) => {
  debugLog("[route:/ollama/api/ps]");

  return c.json(await getRunningModels());
});

ollamaRoutes.post("/show", async (c) => {
  const body = await c.req.json();

  try {
    debugLog("[route:/ollama/api/show]");
    debugLog(JSON.stringify(body, null, 2));

    return c.json(await showModel(body));
  } catch (error) {
    logRequestError(c, error, body);

    return c.json({ error: "Internal server error" }, 500);
  }
});

ollamaRoutes.get("/models/:model/exists", async (c) => {
  const model = c.req.param("model").trim();

  try {
    if (!model) {
      return c.json({ error: "Model name is required." }, 400);
    }

    return c.json({ model, exists: await modelExists(model) });
  } catch (error) {
    logRequestError(c, error, { model });

    return c.json({ error: "Failed to check model." }, 500);
  }
});

ollamaRoutes.post("/pull", async (c) => {
  const body = await c.req.json<{ model?: string }>();
  const model = String(body.model ?? "").trim();

  try {
    if (!model) {
      return c.json({ error: "Model name is required." }, 400);
    }

    if (await modelExists(model)) {
      return c.json({ error: "Model is already installed.", exists: true }, 409);
    }

    const result = await pullModel(model);
    const installed = await modelExists(model);

    if (!installed) {
      return c.json({
        message: "Model was not found in Ollama. Check the model name and tag.",
        installed,
        exists: false,
        model,
        result,
      });
    }

    return c.json({ installed, model, result });
  } catch (error) {
    logRequestError(c, error, body);

    return c.json({ error: "Failed to install model." }, 500);
  }
});

ollamaRoutes.delete("/models/:model", async (c) => {
  const model = c.req.param("model");

  try {
    if (!(await modelExists(model))) {
      return c.json({ error: "Model is not installed.", exists: false }, 404);
    }

    return c.json(await deleteModel(model));
  } catch (error) {
    logRequestError(c, error, { model });

    return c.json({ error: "Failed to delete model." }, 500);
  }
});

ollamaRoutes.post("/generate", async (c) => {
  const body = await c.req.json<OllamaGenerateBody>();

  try {
    debugLog("[ollama:incoming]");
    debugLog(JSON.stringify(body, null, 2));

    const response = await generateTranslation(body);

    debugLog(response);

    return c.json(response);
  } catch (error) {
    logRequestError(c, error, body);

    return c.json({ error: "Internal server error" }, 500);
  }
});

ollamaRoutes.post("/translate-json", async (c) => {
  const formData = await c.req.raw.formData();
  const file = formData.get("file");
  const requestInfo = {
    file:
      file instanceof File
        ? { name: file.name, size: file.size, type: file.type }
        : null,
    model: String(formData.get("model") ?? ""),
    promptModel: String(formData.get("promptModel") ?? "default"),
    sourceLanguage: String(formData.get("sourceLanguage") ?? "unknown"),
    targetLanguage: String(
      formData.get("targetLanguage") ?? "Brazilian Portuguese",
    ),
  };

  try {
    if (!(file instanceof File)) {
      return c.json({ error: "Missing JSON file field named file." }, 400);
    }

    const parsedJson = JSON.parse(await file.text());
    const options = {
      model: requestInfo.model || undefined,
      promptModel: requestInfo.promptModel,
      customPromptModel: String(formData.get("customPromptModel") ?? ""),
      glossary: parseGlossary(String(formData.get("glossary") ?? "")),
      sourceLanguage: requestInfo.sourceLanguage,
      targetLanguage: requestInfo.targetLanguage,
    };
    const encoder = new TextEncoder();
    const encodeEvent = (event: unknown) =>
      encoder.encode(`${JSON.stringify(event)}\n`);

    return new Response(
      new ReadableStream({
        async start(controller) {
          const iterator = translateJsonEntriesStream(parsedJson, options);

          try {
            controller.enqueue(
              encodeEvent({
                type: "status",
                message: "JSON translation started.",
              }),
            );

            while (true) {
              const next = iterator.next();
              let result = await Promise.race([
                next,
                wait(5_000).then(() => null),
              ]);

              while (result === null) {
                controller.enqueue(
                  encodeEvent({
                    type: "ping",
                    at: new Date().toISOString(),
                  }),
                );

                result = await Promise.race([
                  next,
                  wait(5_000).then(() => null),
                ]);
              }

              if (result.done) {
                break;
              }

              controller.enqueue(encodeEvent(result.value));
            }

            controller.close();
          } catch (error) {
            controller.enqueue(
              encodeEvent({
                type: "error",
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to translate JSON file.",
              }),
            );

            controller.close();
          } finally {
            await iterator.return(undefined);
          }
        },
      }),
      {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      },
    );
  } catch (error) {
    logRequestError(c, error, requestInfo);

    return c.json({ error: "Failed to translate JSON file." }, 500);
  }
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGlossary(value: string): Record<string, string> | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Glossary must be a JSON object.");
  }

  const glossary: Record<string, string> = {};

  for (const [source, target] of Object.entries(parsed)) {
    if (typeof target === "string") {
      glossary[source] = target;
    }
  }

  return Object.keys(glossary).length > 0 ? glossary : undefined;
}
