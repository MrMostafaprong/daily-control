const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

const listModels = asyncHandler(async (req, res) => {
  const refresh = req.query.refresh === 'true';
  const data = await services.listModels({ refresh });
  res.json(data);
});

const getModel = asyncHandler(async (req, res) => {
  const { providerId, modelId } = req.params;
  const model = await services.getModel(providerId, modelId);
  if (!model) throw createError(404, 'Model not found');
  res.json({ model });
});

const refreshModels = asyncHandler(async (req, res) => {
  services.clearModelsCache();
  const data = await services.listModels({ refresh: true });
  res.json(data);
});

module.exports = {
  listModels,
  getModel,
  refreshModels,
};