const { execFile } = require('child_process');
const fs = require('fs');
const config = require('../config');

const MAX_BUFFER = 10 * 1024 * 1024;

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isAllowed(command) {
  return config.terminal.allowedCommands.includes(command);
}

const EVAL_FLAGS = {
  node: ['-e', '--eval', '-p', '--print', '--input-type'],
  python: ['-c'],
  python3: ['-c'],
};

function validate({ command, args, cwd, timeout }) {
  if (!command || typeof command !== 'string') {
    throw createError(400, 'command is required');
  }
  if (!isAllowed(command)) {
    throw createError(403, `Command "${command}" is not allowed`);
  }
  if (!cwd || typeof cwd !== 'string') {
    throw createError(400, 'cwd is required');
  }
  if (!fs.existsSync(cwd)) {
    throw createError(404, `cwd does not exist: ${cwd}`);
  }
  if (!Array.isArray(args)) {
    throw createError(400, 'args must be an array');
  }
  if (args.length > config.terminal.maxArgs) {
    throw createError(400, `too many arguments (maximum ${config.terminal.maxArgs})`);
  }
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw createError(400, 'every arg must be a string');
    }
    if (arg.includes('\0')) {
      throw createError(400, 'args must not contain null bytes');
    }
  }
  const blocked = EVAL_FLAGS[command];
  if (blocked && args.some((arg) => blocked.includes(arg) || blocked.some((f) => f.startsWith('--') && arg.startsWith(`${f}=`)))) {
    throw createError(403, `تشغيل كود مباشر عبر ${command} غير مسموح — استخدم ملف`);
  }
  if (timeout !== undefined) {
    if (typeof timeout !== 'number' || timeout <= 0) {
      throw createError(400, 'timeout must be a positive number');
    }
    if (timeout > config.terminal.maxTimeout) {
      throw createError(400, `timeout exceeds max of ${config.terminal.maxTimeout}ms`);
    }
  }
}

function execute({ command, args = [], cwd, timeout }) {
  return new Promise((resolve, reject) => {
    try {
      validate({ command, args, cwd, timeout });
    } catch (err) {
      return reject(err);
    }

    const startedAt = Date.now();
    const effectiveTimeout = timeout || config.terminal.defaultTimeout;

    execFile(
      command,
      args,
      {
        cwd,
        timeout: effectiveTimeout,
        maxBuffer: Math.min(MAX_BUFFER, config.terminal.maxOutput),
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        const duration = Date.now() - startedAt;

        if (err) {
          return resolve({
            ok: false,
            code: typeof err.code === 'number' ? err.code : 1,
            stdout: stdout || '',
            stderr: stderr || err.message || '',
            duration,
            timedOut: err.killed === true,
          });
        }

        resolve({
          ok: true,
          code: 0,
          stdout: stdout || '',
          stderr: stderr || '',
          duration,
          timedOut: false,
        });
      }
    );
  });
}

module.exports = {
  execute,
  isAllowed,
};
