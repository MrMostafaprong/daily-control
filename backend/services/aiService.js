const providerService = require('./providerService');
const openaiAdapter = require('../adapters/openaiAdapter');
const cliAdapter = require('../adapters/cliAdapter');

/**
 * نقطة الدخول الموحّدة لأي مهمة AI.
 * بتستقبل { providerId, model, messages | prompt } وبترجّع رد موحّد.
 *
 * مفيش حفظ محادثات هنا — ده شغل conversationService.
 */
function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function buildMessages({ messages, systemPrompt, prompt }) {
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

async function chat({ providerId, model, messages, prompt, systemPrompt, temperature, maxTokens }) {
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

    return openaiAdapter.chat({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: effectiveModel,
      messages: built,
      temperature,
      maxTokens,
    });
  }

  if (provider.type === 'cli') {
    const command = provider.command;
    if (!command) throw createError(400, 'Provider has no CLI command configured');
    if (!cliAdapter.supports(command)) {
      throw createError(400, `CLI "${command}" is not supported`);
    }

    if (!provider.cwdHint && !provider.path) {
      // CLI محتاج cwd. لو المستخدم مش حاطط مشروع، نستخدم فولدر البيانات.
      // لكن الأفضل نجبر الـ caller يمرّر cwd.
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

    return {
      content: result.content,
      role: 'assistant',
      finishReason: result.ok ? 'stop' : 'error',
      model: model || provider.defaultModel || command,
      usage: null,
      ok: result.ok,
      error: result.ok ? null : result.stderr,
    };
  }

  throw createError(400, `Unknown provider type "${provider.type}"`);
}

module.exports = {
  chat,
};