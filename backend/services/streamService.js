const providerService = require('./providerService');
const cliAdapter = require('../adapters/cliAdapter');
const openaiAdapter = require('../adapters/openaiAdapter');

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function buildMessages({ messages, prompt, systemPrompt }) {
  if (Array.isArray(messages) && messages.length > 0) {
    const out = [];
    if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
    for (const m of messages) out.push({ role: m.role, content: m.content });
    return out;
  }
  if (typeof prompt === 'string' && prompt.trim()) {
    const out = [];
    if (systemPrompt) out.push({ role: 'system', content: systemPrompt });
    out.push({ role: 'user', content: prompt });
    return out;
  }
  throw createError(400, 'Either messages[] or prompt is required');
}

async function* streamOpenAI({ baseUrl, apiKey, model, messages, temperature, maxTokens, signal }) {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions';

  const res = await openaiAdapter.fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { max_tokens: maxTokens }),
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw createError(res.status, openaiAdapter.providerErrorMessage(res.status, text || res.statusText));
  }

  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });

    let nlIndex;
    while ((nlIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nlIndex).trim();
      buffer = buffer.slice(nlIndex + 1);

      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;

      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed lines
      }
    }
  }
}

async function* streamChat({
  providerId,
  model,
  messages,
  prompt,
  systemPrompt,
  temperature,
  maxTokens,
  signal,
}) {
  if (!providerId) throw createError(400, 'providerId is required');

  const provider = providerService.getWithKey(providerId);
  if (!provider) throw createError(404, 'Provider not found');
  if (provider.enabled === false) throw createError(400, 'Provider is disabled');

  if (provider.type === 'openai') {
    if (provider.keyError) throw createError(500, 'تعذر فك تشفير مفتاح المزود — تأكد إن MASTER_KEY هو نفسه اللي اتحفظ بيه المفتاح');
    if (!provider.apiKey) throw createError(400, 'Provider has no API key configured');
    const effectiveModel = model || provider.defaultModel;
    if (!effectiveModel) throw createError(400, 'No model specified and provider has no default');

    const built = buildMessages({ messages, prompt, systemPrompt });

    yield* streamOpenAI({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: effectiveModel,
      messages: built,
      temperature,
      maxTokens,
      signal,
    });
    return;
  }

  if (provider.type === 'cli') {
    const command = provider.command;
    if (!command) throw createError(400, 'Provider has no CLI command configured');
    if (!cliAdapter.supports(command)) {
      throw createError(400, `CLI "${command}" is not supported`);
    }

    const built = buildMessages({ messages, prompt, systemPrompt });
    const promptText = built
      .map((m) => (m.role === 'system' ? `[system]\n${m.content}` : m.content))
      .join('\n\n');

    const cwd = provider.cwdHint || process.cwd();

    const result = await cliAdapter.chat({
      command,
      prompt: promptText,
      model: model || provider.defaultModel,
      cwd,
    });

    if (!result.ok) {
      throw createError(500, result.stderr || 'CLI execution failed');
    }

    if (result.content) yield result.content;
    return;
  }

  throw createError(400, `Unknown provider type "${provider.type}"`);
}

module.exports = {
  streamChat,
};
