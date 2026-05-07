# LexiForge

Local interceptor and UI for requests compatible with Ollama's
`/ollama/api/generate` route. It receives a translation prompt, extracts the source
language, target language, and text, applies the selected prompt model, and
forwards the request to Ollama.

## Routes

- `GET /`: opens the local translation UI from `public/index.html`.
- `GET /styles.css`: serves the UI stylesheet.
- `GET /app.js`: serves the UI script.
- `GET /api/promp`: returns the prompt templates used by the UI.
- `GET /api/promp/details`: returns prompt templates with saved/built-in
  metadata.
- `POST /api/promp`: creates a saved prompt template.
- `PUT /api/promp/:name`: replaces a saved prompt template.
- `DELETE /api/promp/:name`: deletes a saved prompt template.
- `POST /api/promp/validate`: validates prompt template placeholders.
- `GET /ollama/api/tags`: forwards to Ollama and returns available models.
- `GET /ollama/api/ps`: forwards to Ollama and returns running models.
- `POST /ollama/api/show`: forwards model details requests to Ollama.
- `GET /ollama/api/models/:model/exists`: checks whether an Ollama model is
  installed.
- `POST /ollama/api/pull`: installs an Ollama model.
- `DELETE /ollama/api/models/:model`: deletes an Ollama model.
- `POST /ollama/api/generate`: rewrites the translation prompt, resolves the model,
  and forwards the generation request to Ollama.
- `POST /ollama/api/translate-json`: receives a multipart JSON file field named
  `file`, translates every string entry, and streams progress as NDJSON. The
  final event includes the translated structure.

## Requirements

- Bun
- Ollama running locally
- Model `translategemma:4b` installed, or another model sent in the request body

## Install

```bash
bun install
```

## Run

```bash
bun run start
```

With reload on changes:

```bash
bun run dev
```

Enable debug logs:

```bash
bun run start --debug
```

The app also accepts `--degug`.

## Docker

Build and run LexiForge with Docker Compose:

```bash
docker compose up --build
```

By default the container reaches Ollama through:

```text
http://host.docker.internal:11434
```

Override it when needed:

```bash
OLLAMA_HOST=http://ollama:11434 docker compose up --build
```

To also start an Ollama container:

```bash
docker compose --profile ollama up --build
```

## Environment

- `OLLAMA_HOST`: real Ollama server address. Default: `http://localhost:11434`.
- `MODEL_CACHE_TTL_MS`: how long to remember Ollama's model list. Default:
  `60000`.
- `IDLE_TIMEOUT_SECONDS`: Bun server idle timeout. Default: `120`.

## Example

```bash
curl -X POST "http://localhost:3000/ollama/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"translategemma:4b\",\"promptModel\":\"default\",\"prompt\":\"Translate the following text from English to pt. Keep it localized and immersive:\n\n\\\"Hello, adventurer.\\\"\",\"temperature\":0.3}"
```

## Prompt Models

`POST /ollama/api/generate` accepts an optional `promptModel` field:

- `default`: generic translation prompt without game context.
- `custom`: uses the `customPromptModel` field as the prompt template.

When `promptModel` is missing or unknown, the app uses `default`.

Saved prompt models are stored in `prompt-models/prompt-models.json` and are
loaded together with the built-in models when the app starts or the UI refreshes
the prompt model list.

The built-in `default` prompt model is internal. It is used as a fallback by the
translation flow, but it is not returned by `/api/promp` and cannot be created,
updated, downloaded, or deleted through the prompt model UI/API.

Custom prompt templates can use these placeholders:

- `{glossary}`
- `{originLanguage}`
- `{sourceLanguage}`
- `{targetLanguage}`
- `{text}`

Templates must include `{text}` and `{targetLanguage}` before they can be
saved. Missing `{originLanguage}` or `{sourceLanguage}`, and missing
`{glossary}`, are shown as warnings in the editor.

Example custom body:

```json
{
  "model": "translategemma:4b",
  "promptModel": "custom",
  "customPromptModel": "Translate from {sourceLanguage} to {targetLanguage}. Return only the answer.\n\n{text}",
  "prompt": "Translate the following text from English to pt.\n\n\"Hello.\"",
  "temperature": 0.3
}
```

The server logs the received request, the request forwarded to Ollama, and the
response returned by Ollama.

### Prompt Model API

Prompt model management lives under `/api/promp`:

- `GET /api/promp`: list saved models visible in the UI.
- `GET /api/promp/details`: list saved models with metadata for management
  screens.
- `POST /api/promp`: create a saved model.
- `PUT /api/promp/:name`: replace a saved model.
- `DELETE /api/promp/:name`: delete a saved model.
- `POST /api/promp/validate`: validate placeholders without saving.

Names are normalized before they are stored. For example, `New Model 1`,
`new-model-1`, and `new_model_1` all become `new_model_1`.
