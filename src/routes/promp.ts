import { Hono } from "hono";
import { logRequestError } from "../logger";
import {
  deletePromptModel,
  getPromptModelDetails,
  getVisiblePromptModels,
  savePromptModel,
  validatePromptTemplate,
} from "../services/promptModels";

/**
 * REST routes for user-managed prompt models.
 *
 * The route name stays `/api/promp` to match the current UI/API contract.
 * Built-in prompt models, especially `default`, are intentionally hidden from
 * this public management surface and protected in the service layer.
 */
export const prompRoutes = new Hono();

// List only user-visible saved models. The internal `default` model is omitted.
prompRoutes.get("/", async (c) => c.json(await getVisiblePromptModels()));

// Include metadata used by the UI to decide which models can be deleted.
prompRoutes.get("/details", async (c) =>
  c.json(await getPromptModelDetails()),
);

// Shared validation endpoint for future clients; the current UI also mirrors
// these checks locally so users get immediate feedback while typing.
prompRoutes.post("/validate", async (c) => {
  const body = await c.req.json<{ template?: string }>();

  return c.json(validatePromptTemplate(String(body.template ?? "")));
});

// Create a new saved prompt model. Existing names return 409 unless overwrite
// is requested; the UI normally uses PUT for overwrites.
prompRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    name?: string;
    template?: string;
    overwrite?: boolean;
  }>();

  try {
    const result = await savePromptModel({
      name: String(body.name ?? ""),
      template: String(body.template ?? ""),
      overwrite: Boolean(body.overwrite),
    });

    return c.json(result, result.exists ? 409 : 201);
  } catch (error) {
    logRequestError(c, error, body);

    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save prompt model.",
      },
      400,
    );
  }
});

// Replace a prompt model by resource name. Names are normalized in the service,
// so `new-model-1` and `new model 1` target the same stored key.
prompRoutes.put("/:name", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json<{ template?: string }>();

  try {
    return c.json(
      await savePromptModel({
        name,
        template: String(body.template ?? ""),
        overwrite: true,
      }),
    );
  } catch (error) {
    logRequestError(c, error, { name, ...body });

    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update prompt model.",
      },
      400,
    );
  }
});

// Delete only saved models. Attempts to delete `default` or unknown names fail.
prompRoutes.delete("/:name", async (c) => {
  const name = c.req.param("name");

  try {
    return c.json(await deletePromptModel(name));
  } catch (error) {
    logRequestError(c, error, { name });

    return c.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete prompt model.",
      },
      400,
    );
  }
});
