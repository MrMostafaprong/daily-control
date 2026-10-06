const db = require('../db');
const crypto = require('../utils/crypto');

const COLLECTION = 'providers';

const SUPPORTED_TYPES = ['openai', 'cli'];

const ENV_PROVIDER_CONFIG = [
  { env: 'OPENAI_API_KEY', id: 'env:openai', name: 'OpenAI (من البيئة)', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { env: 'DEEPSEEK_API_KEY', id: 'env:deepseek', name: 'DeepSeek (من البيئة)', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { env: 'QWEN_API_KEY', id: 'env:qwen', name: 'Qwen (من البيئة)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus' },
  { env: 'GOOGLE_API_KEY', id: 'env:google', name: 'Google Gemini (من البيئة)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.5-flash' },
  { env: 'GROQ_API_KEY', id: 'env:groq', name: 'Groq (من البيئة)', baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
  { env: 'OPENROUTER_API_KEY', id: 'env:openrouter', name: 'OpenRouter (من البيئة)', baseUrl: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini' },
];

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * الشكل الآمن للإرجاع للخارج — بدون أي مفاتيح
 */
function toPublic(provider) {
  if (!provider) return null;
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    enabled: provider.enabled !== false,
    hasKey: !!provider.encryptedKey || provider.managed === true,
    baseUrl: provider.baseUrl || null,
    command: provider.command || null,
    models: provider.models || [],
    defaultModel: provider.defaultModel || null,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    managed: provider.managed === true,
  };
}

function validateType(type) {
  if (!SUPPORTED_TYPES.includes(type)) {
    throw createError(400, `Unsupported type "${type}". Allowed: ${SUPPORTED_TYPES.join(', ')}`);
  }
}

function validatePayload({ name, type, baseUrl, apiKey, command }) {
  if (!name || typeof name !== 'string') {
    throw createError(400, 'name is required');
  }
  validateType(type);

  if (type === 'openai') {
    if (!baseUrl || typeof baseUrl !== 'string') {
      throw createError(400, 'baseUrl is required for openai type');
    }
    if (!apiKey || typeof apiKey !== 'string') {
      throw createError(400, 'apiKey is required for openai type');
    }
    try {
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw createError(400, 'baseUrl must be a valid HTTP(S) URL');
    }
  }

  if (type === 'cli') {
    if (!command || typeof command !== 'string') {
      throw createError(400, 'command is required for cli type');
    }
  }
}

function list() {
  const configured = db.all(COLLECTION).map(toPublic);
  const environment = ENV_PROVIDER_CONFIG
    .filter((item) => process.env[item.env])
    .map((item) => toPublic({ ...item, type: 'openai', enabled: true, managed: true, models: [] }));
  return [...environment, ...configured];
}

function getPublic(id) {
  const environment = ENV_PROVIDER_CONFIG.find((item) => item.id === id && process.env[item.env]);
  if (environment) return toPublic({ ...environment, type: 'openai', enabled: true, managed: true, models: [] });
  return toPublic(db.findById(COLLECTION, id));
}

/**
 * للاستخدام الداخلي فقط — بيرجع المفتاح مفكوك التشفير.
 * متستخدمهاش في controller مباشر.
 */
function getWithKey(id) {
  const localProviders = {
    'local:ollama': {
      id: 'local:ollama', name: 'Ollama محلي', type: 'openai', enabled: true,
      baseUrl: 'http://127.0.0.1:11434/v1', apiKey: 'ollama',
    },
    'local:lmstudio': {
      id: 'local:lmstudio', name: 'LM Studio محلي', type: 'openai', enabled: true,
      baseUrl: 'http://127.0.0.1:1234/v1', apiKey: 'lm-studio',
    },
  };
  if (localProviders[id]) return localProviders[id];
  const environment = ENV_PROVIDER_CONFIG.find((item) => item.id === id && process.env[item.env]);
  if (environment) {
    return { ...environment, type: 'openai', enabled: true, apiKey: process.env[environment.env], managed: true };
  }
  const provider = db.findById(COLLECTION, id);
  if (!provider) return null;

  const result = { ...provider };
  delete result.encryptedKey;

  if (provider.encryptedKey) {
    try {
      result.apiKey = crypto.decrypt(provider.encryptedKey);
    } catch (err) {
      result.apiKey = null;
      result.keyError = err.message;
    }
  } else {
    result.apiKey = null;
  }

  return result;
}

function create({ name, type, baseUrl, apiKey, command, models, defaultModel, enabled }) {
  validatePayload({ name, type, baseUrl, apiKey, command });

  const record = {
    name,
    type,
    enabled: enabled !== false,
    models: Array.isArray(models) ? models : [],
    defaultModel: defaultModel || null,
  };

  if (type === 'openai') {
    record.baseUrl = baseUrl.replace(/\/+$/, '');
    record.encryptedKey = crypto.encrypt(apiKey);
  }

  if (type === 'cli') {
    record.command = command;
  }

  return toPublic(db.insert(COLLECTION, record));
}

function update(id, patch = {}) {
  const existing = db.findById(COLLECTION, id);
  if (!existing) return null;

  const safe = {};

  if (patch.name !== undefined) safe.name = patch.name;
  if (patch.enabled !== undefined) safe.enabled = !!patch.enabled;
  if (patch.models !== undefined) safe.models = Array.isArray(patch.models) ? patch.models : [];
  if (patch.defaultModel !== undefined) safe.defaultModel = patch.defaultModel || null;

  if (patch.baseUrl !== undefined) {
    const baseUrl = String(patch.baseUrl).replace(/\/+$/, '');
    try {
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw createError(400, 'baseUrl must be a valid HTTP(S) URL');
    }
    safe.baseUrl = baseUrl;
  }

  if (patch.command !== undefined) {
    safe.command = patch.command;
  }

  if (patch.apiKey !== undefined) {
    if (patch.apiKey === null || patch.apiKey === '') {
      safe.encryptedKey = null;
    } else {
      safe.encryptedKey = crypto.encrypt(String(patch.apiKey));
    }
  }

  return toPublic(db.update(COLLECTION, id, safe));
}

function remove(id) {
  return db.remove(COLLECTION, id);
}

/**
 * قائمة اقتراحات للواجهة عشان المستخدم يضيف مزوّد بسرعة.
 */
function getDefaults() {
  return [
    {
      name: 'OpenAI',
      type: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
    },
    {
      name: 'DeepSeek',
      type: 'openai',
      baseUrl: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
    },
    {
      name: 'Google Gemini',
      type: 'openai',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      defaultModel: 'gemini-2.5-flash',
    },
    {
      name: 'Groq',
      type: 'openai',
      baseUrl: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.3-70b-versatile',
    },
    {
      name: 'OpenRouter',
      type: 'openai',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'openai/gpt-4o-mini',
    },
    {
      name: 'Qwen',
      type: 'openai',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen-plus',
    },
    {
      name: 'Claude CLI',
      type: 'cli',
      command: 'claude',
    },
    {
      name: 'Ollama',
      type: 'cli',
      command: 'ollama',
    },
  ];
}

module.exports = {
  list,
  getPublic,
  getWithKey,
  create,
  update,
  remove,
  getDefaults,
};
