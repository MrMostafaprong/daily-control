const executionManager = require('../utils/executionManager');
const projectService = require('./projectService');
const path = require('path');
const { resolveSafe, assertRealPathInside, assertExists } = require('../utils/pathGuard');

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

async function run(projectId, { command, args = [], timeout, cwd }) {
  const config = require('../config');
  if (!config.terminal.enabled) throw createError(403, 'Terminal is disabled');
  if (!projectId) throw createError(400, 'projectId is required');

  const project = projectService.getProject(projectId);
  if (!project) throw createError(404, 'Project not found');
  if (!project.path) throw createError(400, 'Project has no path set');

  const workingDirectory = cwd
    ? assertRealPathInside(project.path, assertExists(resolveSafe(project.path, path.relative(project.path, cwd)), { type: 'dir' }))
    : project.path;
  if (command === 'cd') {
    if (args.length !== 1) throw createError(400, 'cd يحتاج مسار مجلد واحد فقط');
    const next = assertRealPathInside(project.path, assertExists(resolveSafe(workingDirectory, args[0]), { type: 'dir' }));
    return { projectId, cwd: next, command, args, ok: true, code: 0, stdout: `المجلد الحالي: ${next}\n`, stderr: '', duration: 0, timedOut: false };
  }
  const result = await executionManager.execute({
    command,
    args,
    cwd: workingDirectory,
    timeout,
  });

  return {
    projectId,
    cwd: workingDirectory,
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
