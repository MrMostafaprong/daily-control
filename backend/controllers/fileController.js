const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

const getFileTree = asyncHandler(async (req, res) => {
  const tree = await services.getFileTree(req.params.projectId);
  if (!tree) throw createError(404, 'Project not found');
  res.json({ tree });
});

const readFile = asyncHandler(async (req, res) => {
  const { path, projectId } = req.query;
  if (!path) throw createError(400, 'path is required');
  const file = await services.readFile(path, { projectId });
  if (!file) throw createError(404, 'File not found');
  res.json({ file });
});

const writeFile = asyncHandler(async (req, res) => {
  const { path, content, projectId } = req.body || {};
  if (!path) throw createError(400, 'path is required');
  if (typeof content !== 'string') throw createError(400, 'content must be a string');
  const result = await services.writeFile(path, content, { projectId });
  res.json({ file: result });
});

const detectModels = asyncHandler(async (req, res) => {
  res.json({ models: await services.detectModels() });
});

module.exports = {
  getFileTree,
  readFile,
  writeFile,
  detectModels,
};