import type { Context } from "hono";

// Keep normal runs quiet. Debug logs are opt-in through CLI flags.
export const isDebugEnabled =
  Bun.argv.includes("--degug") || Bun.argv.includes("--debug");

export function debugLog(...values: unknown[]) {
  if (isDebugEnabled) {
    console.log(...values);
  }
}

export function logRequestError(
  c: Context,
  error: unknown,
  body?: unknown,
) {
  const url = new URL(c.req.url);

  // Error logs are always printed and include the failing request route. When a
  // route already parsed the body, it can pass it here for easier debugging.
  console.error("[request:error]");
  console.error(`${c.req.method} ${url.pathname}${url.search}`);

  if (body !== undefined) {
    console.error("Body:", JSON.stringify(body, null, 2));
  }

  console.error(error);
}
