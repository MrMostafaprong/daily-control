function adapterError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw adapterError(400, 'baseUrl is required');
  }
  return baseUrl.replace(/\/+$/, '');
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      let response;
      try {
        response = await fetch(url, { ...options, signal: options.signal || controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) return response;
      if (response.body) await response.body.cancel().catch(() => {});
      await wait(700 * (attempt + 1));
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || attempt === 2) throw error;
      await wait(700 * (attempt + 1));
    }
  }
  throw lastError || new Error('Provider request failed');
}

function providerErrorMessage(status, detail) {
  if (status === 429) return 'تم تجاوز حد الطلب لدى مزود الذكاء الاصطناعي. حاول بعد قليل.';
  if (status === 503) return 'الموديل مشغول مؤقتًا بسبب ضغط الخدمة. أعد المحاولة أو اختر موديلًا آخر.';
  return `Provider error (${status}): ${detail || 'unknown provider error'}`;
}

async function chat({ baseUrl, apiKey, model, messages, temperature, maxTokens, ...rest }) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw adapterError(400, 'apiKey is required');
  }
  if (!model || typeof model !== 'string') {
    throw adapterError(400, 'model is required');
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw adapterError(400, 'messages must be a non-empty array');
  }
  for (const m of messages) {
    if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
      throw adapterError(400, 'each message must have { role, content } as strings');
    }
  }

  const url = normalizeBaseUrl(baseUrl) + '/chat/completions';

  const body = {
    model,
    messages,
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { max_tokens: maxTokens }),
    ...rest,
  };

  let res;
  try {
    res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    if (err.name === 'AbortError') throw adapterError(504, 'انتهت مهلة انتظار مزود الذكاء الاصطناعي.');
    throw adapterError(502, 'تعذر الوصول إلى مزود الذكاء الاصطناعي.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.error?.message || text;
    } catch {
      // keep raw text
    }
    throw adapterError(res.status, providerErrorMessage(res.status, detail || res.statusText));
  }

  const data = await res.json();
  const choice = data?.choices?.[0];

  return {
    content: choice?.message?.content || '',
    role: choice?.message?.role || 'assistant',
    finishReason: choice?.finish_reason || null,
    model: data?.model || model,
    usage: data?.usage || null,
    raw: data,
  };
}

async function listModels({ baseUrl, apiKey }) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw adapterError(400, 'apiKey is required');
  }

  const url = normalizeBaseUrl(baseUrl) + '/models';

  let res;
  try {
    res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw adapterError(504, 'انتهت مهلة جلب قائمة الموديلات.');
    throw adapterError(502, 'تعذر الوصول إلى مزود الذكاء الاصطناعي.');
  }

  if (!res.ok) {
    throw adapterError(res.status, `Failed to list models (${res.status})`);
  }

  const data = await res.json();
  return (data?.data || []).map((m) => ({
    id: m.id,
    ownedBy: m.owned_by || null,
  }));
}

module.exports = {
  chat,
  listModels,
  fetchWithRetry,
  providerErrorMessage,
};
