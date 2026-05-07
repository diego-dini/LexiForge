import { Hono } from "hono";
import {
  generateTranslation,
  getRunningModels,
  getTags,
  type OllamaGenerateBody,
  showModel,
} from "./services/ollama";
import { debugLog, logRequestError } from "./logger";
import { PROMPT_MODELS } from "./preparePrompt";
import { translateJsonEntriesStream } from "./services/jsonTranslator";

const app = new Hono();
const idleTimeout = Number(Bun.env.IDLE_TIMEOUT_SECONDS ?? 120);

function servePublicFile(fileName: string, contentType: string) {
  const file = Bun.file(new URL(`../public/${fileName}`, import.meta.url));

  return new Response(file, {
    headers: {
      "Content-Type": contentType,
    },
  });
}

// Fallback error handler for routes that fail before reading their body, such
// as invalid JSON parsing or unexpected framework errors.
app.onError((error, c) => {
  logRequestError(c, error);

  return c.json({ error: "Internal server error" }, 500);
});

app.get("/", () => servePublicFile("index.html", "text/html; charset=utf-8"));

app.get("/styles.css", () => servePublicFile("styles.css", "text/css"));

app.get("/app.js", () =>
  servePublicFile("app.js", "text/javascript; charset=utf-8"),
);

app.get("/api/prompt-models", (c) => c.json(PROMPT_MODELS));

app.get("/api/tags", async (c) => {
  debugLog("[route:/api/tags]");

  return c.json(await getTags());
});

app.get("/api/ps", async (c) => {
  debugLog("[route:/api/ps]");

  return c.json(await getRunningModels());
});

app.post("/api/show", async (c) => {
  const body = await c.req.json();

  // Body-aware routes catch their own errors so failed requests can include
  // the original body in the error log.
  try {
    debugLog("[route:/api/show]");
    debugLog(JSON.stringify(body, null, 2));

    return c.json(await showModel(body));
  } catch (error) {
    logRequestError(c, error, body);

    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/api/generate", async (c) => {
  const body = await c.req.json<OllamaGenerateBody>();

  // /api/generate is the only route that changes behavior: it rewrites the
  // prompt before forwarding the request to Ollama.
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

app.post("/api/translate-json", async (c) => {
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

export default {
  fetch: app.fetch,
  idleTimeout,
};

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
