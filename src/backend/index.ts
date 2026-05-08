import { Hono } from "hono";
import { logRequestError } from "./logger";
import { prompRoutes } from "./routes/promp.ts";
import { ollamaRoutes } from "./routes/ollama.ts";

const app = new Hono();
const idleTimeout = Number(Bun.env.IDLE_TIMEOUT_SECONDS ?? 120);

function servePublicFile(fileName: string, contentType: string) {
  const file = Bun.file(new URL(`../../public/${fileName}`, import.meta.url));

  return new Response(file, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    },
  });
}

app.get("/favicon.ico", () => servePublicFile("favicon.svg", "image/x-icon"));

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

app.route("/api/promp", prompRoutes);
app.route("/ollama/api", ollamaRoutes);

export default {
  fetch: app.fetch,
  idleTimeout,
};
