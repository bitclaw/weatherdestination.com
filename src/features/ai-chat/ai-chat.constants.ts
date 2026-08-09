const MAX_MESSAGES = 50;
const MAX_TOTAL_JSON_CHARS = 100_000;

// Only 'user' and 'assistant' - never 'system'. @tanstack/ai's UIMessage
// type allows a 'system' role, and params.messages here is entirely
// client-supplied (chatParamsFromRequest parses the raw request body) then
// passed straight into chat() alongside config.ai.systemPrompt. Without
// this, a caller could inject a message with role: 'system' that lands
// after the operator's own system prompt in the assembled conversation,
// overriding it, or fabricate prior 'assistant' turns to steer the model.
const ALLOWED_ROLES = new Set(['user', 'assistant']);

export const validateChatMessages = (
  messages: ReadonlyArray<unknown>
): { ok: true } | { ok: false; error: string } => {
  if (messages.length === 0)
    return { ok: false, error: 'messages must not be empty' };
  if (messages.length > MAX_MESSAGES)
    return {
      ok: false,
      error: `messages exceeds limit of ${MAX_MESSAGES}`
    };
  if (JSON.stringify(messages).length > MAX_TOTAL_JSON_CHARS)
    return {
      ok: false,
      error: `messages total size exceeds ${MAX_TOTAL_JSON_CHARS} characters`
    };
  for (const message of messages) {
    const role = (message as { role?: unknown } | null)?.role;
    if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
      return {
        ok: false,
        error: `message role must be one of: ${Array.from(ALLOWED_ROLES).join(', ')}`
      };
    }
  }
  return { ok: true };
};
