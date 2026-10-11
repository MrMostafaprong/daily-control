const services = require('../services');
const rootSession = require('../services/rootSession');
const { asyncHandler, createError } = require('../middleware');

const runCommand = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { command, args, timeout, cwd, approved, sudoPassword } = req.body || {};

  if (!command) throw createError(400, 'command is required');
  if (approved !== true) throw createError(428, 'موافقة المستخدم مطلوبة قبل تشغيل الأمر');

  const rootToken = rootSession.extractToken(req);
  const result = await services.runTerminalCommand(projectId, {
    command,
    args,
    timeout,
    cwd,
    rootToken,
    // باسورد النظام لحظي: يُستخدم مرة واحدة ولا يُحفَظ
    sudoPassword: typeof sudoPassword === 'string' && sudoPassword ? sudoPassword : undefined,
  });

  res.json({ result });
});

const listAllowedCommands = asyncHandler(async (req, res) => {
  const data = await services.listAllowedCommands();
  res.json(data);
});

// ─── إدارة قاعدة الأوامر (روت فقط — hot update بدون إعادة تشغيل) ───
const upsertCommand = asyncHandler(async (req, res) => {
  const { name, enabled, requiresRoot, risk, description } = req.body || {};
  if (!name) throw createError(400, 'name is required');
  const out = await services.upsertTerminalCommand({ name, enabled, requiresRoot, risk, description });
  res.json({ ok: true, ...out });
});

const removeCommand = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const store = await services.removeTerminalCommand(name);
  res.json({ ok: true, version: store.version, updatedAt: store.updatedAt });
});

const reloadCommands = asyncHandler(async (req, res) => {
  const store = await services.reloadTerminalCommands();
  res.json({ ok: true, version: store.version, commands: store.commands.length });
});

module.exports = {
  runCommand,
  listAllowedCommands,
  upsertCommand,
  removeCommand,
  reloadCommands,
};
