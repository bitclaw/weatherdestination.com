# AI Chat

Warpkit ships a full AI chat feature at `/chat` with per-user SQLite persistence, OpenRouter streaming (cloud), and optional Chrome built-in LLM (local, on-device).

---

## Architecture

| Concern | Detail |
|---------|--------|
| SSE endpoint | `src/routes/api/v1/ai-chat.ts` |
| DB layer | `src/features/ai-chat/server/ai-chat.server.ts` |
| Server functions | `src/features/ai-chat/server/ai-chat.{queries,mutations}.ts` |
| Components | `src/features/ai-chat/components/` |
| Routes | `_app.dashboard.chat.tsx`, `_app.dashboard.chat.index.tsx`, `_app.dashboard.chat.$id.tsx` |
| Config | `config.ai` in `config.ts` |

Conversations and messages are stored in each user's per-user SQLite database. The SSE endpoint streams tokens via `@tanstack/ai` + `@tanstack/ai-openrouter`.

---

## Configuration

```ts
// config.ts
ai: {
  model: 'openrouter/auto',       // any OpenRouter model slug
  systemPrompt: 'You are a helpful AI assistant.',
  localModel: true,               // show Chrome built-in LLM toggle
}
```

Set `OPENROUTER_API_KEY` in `.env` for cloud mode. Get a key at [openrouter.ai](https://openrouter.ai).

---

## Cloud Mode (OpenRouter)

Default. Streams via SSE to `POST /api/v1/ai-chat`. Requires `OPENROUTER_API_KEY`. Rate-limited at 30 req/min per IP, auth-gated.

`config.ai.model` accepts any OpenRouter model slug:
- `openrouter/auto` , auto-routes to the best available model
- `anthropic/claude-3.5-sonnet` , Claude 3.5 Sonnet
- `google/gemini-2.0-flash-001` , Gemini 2.0 Flash
- `meta-llama/llama-3.3-70b-instruct` , Llama 3.3 70B

---

## Local Mode (Chrome Built-in LLM)

Uses Chrome's on-device **Gemini Nano** via `window.LanguageModel`. No API key, no server round-trip, no token cost. Runs entirely in the browser.

Enable in config:
```ts
ai: { localModel: true }
```

When enabled, the chat header shows a toggle so users can switch between cloud and local. The toggle only appears when the browser reports the model is available , on unsupported browsers it is hidden automatically.

### Why Chrome extensions don't need flags

Chrome extensions run in a privileged context. The user explicitly installed the extension and granted it permissions. Extension manifests can request AI access directly , no flags, no Origin Trial.

Web pages run in the regular renderer context with no default trust. `window.LanguageModel` on a web page requires either:

1. **Manual flags** (dev/local only): Enable in `chrome://flags`:
   - `#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
   - `#prompt-api-for-gemini-nano` → Enabled
   
   Restart Chrome, then trigger model download:
   ```js
   // Run in DevTools console once to download model weights:
   await window.LanguageModel.create({
     monitor(m) {
       m.addEventListener('downloadprogress', e => console.log(e.loaded, e.total));
     }
   });
   ```
   Check `chrome://components/` → "Optimization Guide On Device Model" should show a version number.

2. **Origin Trial** (production): Register your domain at [googlechrome.github.io/OriginTrials](https://googlechrome.github.io/OriginTrials), get a token, embed it:
   ```html
   <!-- in your HTML <head> -->
   <meta http-equiv="origin-trial" content="YOUR_TOKEN_HERE">
   ```
   Or as an HTTP response header:
   ```
   Origin-Trial: YOUR_TOKEN_HERE
   ```
   Chrome then unlocks `window.LanguageModel` for eligible users on your domain automatically , no flags required.

### Gemini Nano self-identity limitation

Gemini Nano is a small model. When asked "are you running in the browser?", it may describe itself as server-hosted , this is incorrect. The model's training data includes descriptions of the Gemma family as server-deployed, and small models don't reliably override baked-in self-knowledge via system prompts.

The model IS running on-device. The response is a training artifact, not a runtime fact. This is a known limitation of small LLMs. Larger cloud models (via OpenRouter) follow system prompt instructions more faithfully.

### Availability states

`window.LanguageModel.availability()` returns:

| Status | Meaning |
|--------|---------|
| `'readily'` | Model downloaded and ready |
| `'available'` | Model ready (alias, same behavior) |
| `'downloadable'` | Registered but weights not yet downloaded , trigger with `LanguageModel.create()` |
| `'after-download'` | Same as downloadable |
| `'no'` | Not supported on this browser/OS |

Warpkit shows the toggle for `'readily'` and `'available'`. For `'downloadable'`, the user must trigger the download manually (dev setup only , Origin Trial handles this transparently in production).

---

## Message persistence

Both cloud and local messages are saved to per-user SQLite via `saveMessageFn`. The conversation list updates automatically via `invalidateQueries`. Messages load from the DB on route navigation via the route loader.

Auto-titling: the first user message (up to 60 chars) becomes the conversation title.

---

## Markdown rendering

Assistant messages render GFM markdown via the existing `unified` + `remark-gfm` + `rehype-sanitize` pipeline (`src/lib/markdown.ts` → `renderChatMarkdown`). Streaming messages render as plain text to avoid broken partial-markdown flicker. Rendering is memoized per message so the pipeline only runs when message content changes, not on every keypress.
