const executionManager = require('../utils/executionManager');
const commandRegistry = require('./commandRegistry');
const rootSession = require('./rootSession');
const path = require('path');
const { resolveSafe, assertRealPathInside, assertExists } = require('../utils/pathGuard');

function createError(statusCode, message, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

async function run(projectId, { command, args = [], timeout, cwd, rootToken, sudoPassword }) {
  const config = require('../config');
  const projectService = require('./projectService');
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

  const token = rootToken || null;
  const result = await executionManager.execute({
    command,
    args,
    cwd: workingDirectory,
    timeout,
    rootToken: token,
    // لحظي فقط — لا يُخزَّن في أي مكان
    sudoPassword: sudoPassword || undefined,
  });

  return {
    projectId,
    cwd: workingDirectory,
    command,
    args,
    privileged: (commandRegistry.get(command)?.requiresRoot || executionManager.PRIVILEGED.includes(command)) || false,
    rootUsed: rootSession.isValid(token),
    ...result,
  };
}

async function listAllowed() {
  const config = require('../config');
  return { mode: config.terminal.mode, commands: commandRegistry.listAllowed(), catalog: commandRegistry.list() };
}

async function upsertCommand(entry) {
  return commandRegistry.upsert(entry);
}

async function removeCommand(name) {
  return commandRegistry.remove(name);
}

async function reloadCommands() {
  return commandRegistry.reload();
}

module.exports = { run, listAllowed, upsertCommand, removeCommand, reloadCommands };
