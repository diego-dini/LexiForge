# LexiForge

Local interceptor for requests compatible with Ollama's `/api/generate` route.
It receives a translation prompt, extracts the source language, target language,
and text, builds a Final Fantasy XIV localization prompt, and forwards the
request to Ollama.

## Routes

- `GET /`: opens the local translation UI from `public/index.html`.
- `GET /styles.css`: serves the UI stylesheet.
- `GET /app.js`: serves the UI script.
- `GET /api/prompt-models`: returns the prompt templates used by the UI.
- `GET /api/tags`: forwards to Ollama and returns available models.
- `GET /api/ps`: forwards to Ollama and returns running models.
- `POST /api/show`: forwards model details requests to Ollama.
- `POST /api/generate`: rewrites the translation prompt, resolves the model,
  and forwards the generation request to Ollama.
- `POST /api/translate-json`: receives a multipart JSON file field named
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

## Environment

- `OLLAMA_HOST`: real Ollama server address. Default: `http://localhost:11434`.
- `MODEL_CACHE_TTL_MS`: how long to remember Ollama's model list. Default:
  `60000`.
- `IDLE_TIMEOUT_SECONDS`: Bun server idle timeout. Default: `120`.

## Example

```bash
curl -X POST "http://localhost:3000/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"translategemma:4b\",\"promptModel\":\"default\",\"prompt\":\"Translate the following text from English to pt. Keep it localized and immersive:\n\n\\\"Hello, adventurer.\\\"\",\"temperature\":0.3}"
```

## Prompt Models

`POST /api/generate` accepts an optional `promptModel` field:

- `default`: generic translation prompt without game context.
- `ffxiv-short`: compact Final Fantasy XIV localization prompt.
- `ffxiv-long`: more detailed Final Fantasy XIV localization prompt.
- `custom`: uses the `customPromptModel` field as the prompt template.

When `promptModel` is missing or unknown, the app uses `default`.

Custom prompt templates can use these placeholders:

- `{sourceLanguage}`
- `{targetLanguage}`
- `{text}`

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
