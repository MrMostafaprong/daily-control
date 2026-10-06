const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

// ─── Tasks ────────────────────────────────────────────

const listTasks = asyncHandler((req, res) => {
  const { projectId, status, priority, dueBefore } = req.query;
  res.json({ tasks: services.listTasks({ projectId, status, priority, dueBefore }) });
});

const getTask = asyncHandler((req, res) => {
  const task = services.getTask(req.params.id);
  if (!task) throw createError(404, 'Task not found');
  res.json({ task });
});

const createTask = asyncHandler((req, res) => {
  const task = services.createTask(req.body || {});
  res.status(201).json({ task });
});

const updateTask = asyncHandler((req, res) => {
  const updated = services.updateTask(req.params.id, req.body || {});
  if (!updated) throw createError(404, 'Task not found');
  res.json({ task: updated });
});

const removeTask = asyncHandler((req, res) => {
  const ok = services.removeTask(req.params.id);
  if (!ok) throw createError(404, 'Task not found');
  res.status(204).end();
});

const completeTask = asyncHandler((req, res) => {
  const updated = services.completeTask(req.params.id);
  if (!updated) throw createError(404, 'Task not found');
  res.json({ task: updated });
});

const taskStats = asyncHandler((req, res) => {
  res.json({ stats: services.taskStats() });
});

// ─── Planner ──────────────────────────────────────────

const generatePlan = asyncHandler(async (req, res) => {
  const { providerId, model, date } = req.body || {};
  if (!providerId) throw createError(400, 'providerId is required');
  const result = await services.generatePlan({ providerId, model, date });
  res.json(result);
});

const breakdownTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { providerId, model } = req.body || {};
  if (!providerId) throw createError(400, 'providerId is required');
  const result = await services.breakdownTask({ taskId, providerId, model });
  res.json(result);
});

const suggestPriorities = asyncHandler(async (req, res) => {
  const { providerId, model } = req.body || {};
  if (!providerId) throw createError(400, 'providerId is required');
  const result = await services.suggestPriorities({ providerId, model });
  res.json(result);
});

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  removeTask,
  completeTask,
  taskStats,

  generatePlan,
  breakdownTask,
  suggestPriorities,
};