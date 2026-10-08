const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

const listProjects = asyncHandler((req, res) => {
  res.json({ projects: services.listProjects() });
});

const discoverProjects = asyncHandler((req, res) => {
  res.json({ projects: services.discoverProjects() });
});
const browseDirectories = asyncHandler((req, res) => res.json({ browser: services.browseDirectories(req.query.path) }));

const getProject = asyncHandler((req, res) => {
  const project = services.getProject(req.params.id);
  if (!project) throw createError(404, 'Project not found');
  res.json({ project });
});

const createProject = asyncHandler((req, res) => {
  const { name, path, description } = req.body || {};
  if (!name) throw createError(400, 'name is required');
  const project = services.createProject({ name, path, description });
  res.status(201).json({ project });
});

const updateProject = asyncHandler((req, res) => {
  const updated = services.updateProject(req.params.id, req.body || {});
  if (!updated) throw createError(404, 'Project not found');
  res.json({ project: updated });
});

const removeProject = asyncHandler((req, res) => {
  const ok = services.removeProject(req.params.id);
  if (!ok) throw createError(404, 'Project not found');
  res.status(204).end();
});

const scanProject = asyncHandler(async (req, res) => {
  const result = await services.scanProject(req.params.id);
  if (!result) throw createError(404, 'Project not found');
  res.json({ scan: result });
});

const getProjectTree = asyncHandler(async (req, res) => {
  const tree = await services.getProjectTree(req.params.id);
  if (!tree) throw createError(404, 'Project not found');
  res.json({ tree });
});

module.exports = {
  listProjects,
  discoverProjects,
  browseDirectories,
  getProject,
  createProject,
  updateProject,
  removeProject,
  scanProject,
  getProjectTree,
};
