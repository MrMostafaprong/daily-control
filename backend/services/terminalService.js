const executionManager = require('../utils/executionManager');
const projectService = require('./projectService');

/**
 * تشغيل أوامر المشروع من الواجهة.
 * - الأمر لازم يبقى في whitelist (executionManager بياخد باله)
 * - الـ cwd دايمًا هو مسار المشروع
 * - بنرجّع stdout/stderr/duration
 */

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function run(projectId, { command, args = [], timeout }) {
  const config = require('../config');
  if (!config.terminal.enabled) throw createError(403, 'Terminal is disabled');
  if (!projectId) throw createError(400, 'projectId is required');

  const project = projectService.getProject(projectId);
  if (!project) throw createError(404, 'Project not found');
  if (!project.path) throw createError(400, 'Project has no path set');

  const result = await executionManager.execute({
    command,
    args,
    cwd: project.path,
    timeout,
  });

  return {
    projectId,
    cwd: project.path,
    command,
    args,
    ...result,
  };
}

async function listAllowed() {
  const config = require('../config');
  return config.terminal.allowedCommands;
}

module.exports = {
  run,
  listAllowed,
};
