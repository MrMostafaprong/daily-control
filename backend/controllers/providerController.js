const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

const listProviders = asyncHandler((req, res) => {
  res.json({ providers: services.listProviders() });
});

const getProvider = asyncHandler((req, res) => {
  const provider = services.getProvider(req.params.id);
  if (!provider) throw createError(404, 'Provider not found');
  res.json({ provider });
});

const createProvider = asyncHandler((req, res) => {
  const { name, type, baseUrl, apiKey, command, models, defaultModel, enabled } = req.body || {};
  const provider = services.createProvider({
    name,
    type,
    baseUrl,
    apiKey,
    command,
    models,
    defaultModel,
    enabled,
  });
  res.status(201).json({ provider });
});

const updateProvider = asyncHandler((req, res) => {
  const updated = services.updateProvider(req.params.id, req.body || {});
  if (!updated) throw createError(404, 'Provider not found');
  res.json({ provider: updated });
});

const removeProvider = asyncHandler((req, res) => {
  const ok = services.removeProvider(req.params.id);
  if (!ok) throw createError(404, 'Provider not found');
  res.status(204).end();
});

const getProviderDefaults = asyncHandler((req, res) => {
  res.json({ defaults: services.getProviderDefaults() });
});

module.exports = {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  removeProvider,
  getProviderDefaults,
};