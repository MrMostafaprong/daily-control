const providerService = require('./providerService');
const projectScanner = require('../utils/projectScanner');
const openaiAdapter = require('../adapters/openaiAdapter');
const cliAdapter = require('../adapters/cliAdapter');

/**
 * بيجمع كل الموديلات المتاحة من:
 *  - المزوّدين المسجلين (openai-compatible) → بننده /models على كل واحد
 *  - CLI tools المدعومة → بنشوف أي واحد متاح في PATH
 *
 * كل النتائج cached لمدة قصيرة عشان مانضربش الشبكة كل مرة.
 */

const CACHE_TTL_MS = 60 * 1000;
let cache = { at: 0, data: null };

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function fetchProviderModels(provider) {
  const providerWithKey = providerService.getWithKey(provider.id);
  if (!providerWithKey || !providerWithKey.apiKey) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: provider.type,
      error: 'No API key configured',
      models: [],
    };
  }

  try {
    const models = await openaiAdapter.listModels({
      baseUrl: providerWithKey.baseUrl,
      apiKey: providerWithKey.apiKey,
    });

    return {
      providerId: provider.id,
      providerName: provider.name,
      type: provider.type,
      baseUrl: providerWithKey.baseUrl,
      models: models.map((m) => ({
        id: m.id,
        name: m.id,
        providerId: provider.id,
        providerName: provider.name,
      })),
    };
  } catch (err) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: provider.type,
      error: err.message,
      models: [],
    };
  }
}

async function fetchCliModels(provider) {
  const command = provider.command;
  if (!command) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: 'cli',
      error: 'No command configured',
      models: [],
    };
  }

  const supported = cliAdapter.supports(command);
  if (!supported) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: 'cli',
      error: `CLI "${command}" is not supported by cliAdapter`,
      models: [],
    };
  }

  const available = await projectScanner.detectCliTools([
    { name: command, label: provider.name },
  ]);

  if (!available[0]?.available) {
    return {
      providerId: provider.id,
      providerName: provider.name,
      type: 'cli',
      command,
      error: `CLI "${command}" is not installed`,
      models: [],
    };
  }

  // CLI tools مش عندها endpoint للموديلات زي OpenAI.
  // بنرجّع الموديلات اللي المستخدم سجّلها في provider.models،
  // أو defaultModel لو موجود.
  const declared = provider.models && provider.models.length
    ? provider.models
    : provider.defaultModel
      ? [provider.defaultModel]
      : [];

  return {
    providerId: provider.id,
    providerName: provider.name,
    type: 'cli',
    command,
    available: true,
    models: declared.map((m) => ({
      id: m,
      name: m,
      providerId: provider.id,
      providerName: provider.name,
    })),
  };
}

async function listAll({ refresh = false } = {}) {
  const now = Date.now();
  if (!refresh && cache.data && now - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const providers = providerService.list().filter((p) => p.enabled);
  const localGroups = await projectScanner.detectLocalModels();

  const groups = await Promise.all(
    providers.map((p) => {
      if (p.type === 'openai') return fetchProviderModels(p);
      if (p.type === 'cli') return fetchCliModels(p);
      return Promise.resolve({
        providerId: p.id,
        providerName: p.name,
        type: p.type,
        error: `Unknown provider type "${p.type}"`,
        models: [],
      });
    })
  );

  const allGroups = [...localGroups, ...groups];
  const allModels = allGroups.flatMap((g) => g.models || []);

  const data = {
    groups: allGroups,
    total: allModels.length,
    fetchedAt: new Date().toISOString(),
  };

  cache = { at: now, data };
  return data;
}

async function getModel(providerId, modelId) {
  const data = await listAll();
  const group = data.groups.find((g) => g.providerId === providerId);
  if (!group) return null;
  return group.models.find((m) => m.id === modelId) || null;
}

function clearCache() {
  cache = { at: 0, data: null };
}

module.exports = {
  listAll,
  getModel,
  clearCache,
};
