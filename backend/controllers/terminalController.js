const services = require('../services');
const { asyncHandler, createError } = require('../middleware');

const runCommand = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { command, args, timeout, cwd, approved } = req.body || {};

  if (!command) throw createError(400, 'command is required');
  if (approved !== true) throw createError(428, 'موافقة المستخدم مطلوبة قبل تشغيل الأمر');

  const result = await services.runTerminalCommand(projectId, {
    command,
    args,
    timeout,
    cwd,
  });

  res.json({ result });
});

const listAllowedCommands = asyncHandler(async (req, res) => {
  const commands = await services.listAllowedCommands();
  res.json({ commands });
});

module.exports = {
  runCommand,
  listAllowedCommands,
};
