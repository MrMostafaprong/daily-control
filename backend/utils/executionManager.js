const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_BUFFER = 10 * 1024 * 1024;
const MAX_SUDO_PASSWORD_LEN = 512;

// أوامر تُعتبر مميزة دائمًا حتى لو لم تُسجَّل في القاعدة — تحتاج روت
const PRIVILEGED = new Set([
  'sudo', 'su', 'doas', 'runas',
  'chmod', 'chown', 'chattr',
  'mkfs', 'dd', 'fdisk', 'parted',
  'systemctl', 'service', 'reboot', 'shutdown', 'poweroff', 'halt', 'init',
  'iptables', 'nft', 'firewall-cmd', 'setenforce',
  'visudo', 'passwd', 'useradd', 'userdel', 'usermod', 'groupadd',
  'mount', 'umount', 'losetup', 'insmod', 'rmmod', 'modprobe',
  'docker',
]);

function createError(statusCode, message, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

const EVAL_FLAGS = {
  node: ['-e', '--eval', '-p', '--print', '--input-type'],
  python: ['-c'],
  python3: ['-c'],
};

function audit(entry) {
  try {
    const config = require('../config');
    if (!config.terminal.auditLog) return;
    const file = path.join(config.paths.data, 'terminal-audit.jsonl');
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', 'utf-8');
  } catch { /* audit best-effort */ }
}

function validate({ command, args, cwd, timeout }) {
  const config = require('../config');
  if (!command || typeof command !== 'string') {
    throw createError(400, 'command is required');
  }
  // Never pass user input through a shell.
  if (/[;&|<>`$()\\\n\r]/.test(command) || args.some((arg) => /[;&|<>`$()\\\n\r]/.test(arg))) {
    throw createError(400, 'تركيب أوامر shell غير مسموح؛ شغّل أمرًا واحدًا فقط');
  }
  if (['mkdir', 'touch', 'nano'].includes(command)) {
    const paths = args.filter((arg) => arg !== '-p');
    if (!paths.length || args.some((arg) => arg.startsWith('-') && arg !== '-p')) {
      throw createError(400, `${command}: استخدم مسارًا نسبيًا داخل المشروع`);
    }
    for (const target of paths) {
      if (!target || target.startsWith('/') || target === '..' || target.includes('../') || target.includes('..\\')) {
        throw createError(403, 'المسار يجب أن يبقى داخل مجلد المشروع');
      }
    }
    if (command === 'nano') {
      throw createError(501, 'nano تفاعلي ولا يعمل داخل هذا الترمينال؛ استخدم محرر الملفات داخل مساحة العمل');
    }
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

function checkAccess(command, args = [], rootToken) {
  const config = require('../config');
  const registry = require('../services/commandRegistry');
  const rootSession = require('../services/rootSession');
  const hasRoot = rootSession.isValid(rootToken);
  const entry = registry.get(command);
  const privileged = PRIVILEGED.has(command) || (entry && entry.requiresRoot);

  // تشديد إضافي للنسخة الآمنة: منع rm الخطر حتى بالروت
  if (command === 'rm') {
    const joined = (args || []).join(' ');
    if (/(^|\s)(\/|\/\*|\~|\~\/?\*)(\s|$)/.test(joined) || (args || []).includes('-rf') && ((args || []).includes('/') || (args || []).includes('/*') || (args || []).includes('~'))) {
      throw createError(403, 'rm على الجذر/المنزل ممنوع نهائيًا في النسخة الآمنة', { code: 'FORBIDDEN' });
    }
    // rm داخل المشروع فقط — يحتاج روت إن كان متكررًا
    if (((args || []).includes('-r') || (args || []).includes('-rf') || (args || []).includes('-fr')) && !rootSession.isValid(rootToken)) {
      throw createError(403, 'rm المتكرر يحتاج صلاحية الروت — فعّل الروت من الواجهة', { code: 'ROOT_REQUIRED' });
    }
  }
  // 1) البوابة الحساسة أولًا: أي أمر مميز يحتاج روت
  if (privileged && !hasRoot) {
    throw createError(403, `الأمر "${command}" يحتاج صلاحية الروت — فعّل الروت من الواجهة`, { code: 'ROOT_REQUIRED' });
  }
  // 2) وضع القائمة البيضاء: المنع لغير المسجلين
  const strict = config.terminal.mode === 'whitelist' || config.terminal.enforceWhitelist;
  if (strict) {
    if (!entry || !entry.enabled) {
      throw createError(403, `Command "${command}" is not allowed`, { code: 'NOT_ALLOWED' });
    }
    return { entry, hasRoot, privileged: !!privileged };
  }
  // 3) وضع open: أي أمر مسموح (زي الترمينال العادي) ما عدا المعطّل إداريًا
  if (entry && !entry.enabled) {
    throw createError(403, `الأمر "${command}" معطّل من الإدارة`, { code: 'DISABLED' });
  }
  return { entry, hasRoot, privileged: !!privileged };
}

function execute({ command, args = [], cwd, timeout, rootToken, sudoPassword }) {
  return new Promise((resolve, reject) => {
    try {
      validate({ command, args, cwd, timeout });
      checkAccess(command, args, rootToken);
      if (sudoPassword !== undefined && sudoPassword !== null) {
        if (typeof sudoPassword !== 'string' || !sudoPassword || sudoPassword.length > MAX_SUDO_PASSWORD_LEN) {
          throw createError(400, 'sudoPassword غير صالح');
        }
      }
    } catch (err) {
      audit({ command, args, cwd, ok: false, denied: err.code || err.message });
      return reject(err);
    }

    // مسار sudo مع باسورد نظام: spawn + ‎-S + stdin (لا يظهر في اللوج)
    if (command === 'sudo' && sudoPassword) {
      return executeSudo({ args, cwd, timeout, sudoPassword, resolve });
    }

    const config = require('../config');
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
        const base = { command, args, cwd };

        if (err) {
          const result = {
            ok: false,
            code: typeof err.code === 'number' ? err.code : 1,
            stdout: stdout || '',
            stderr: err.code === 'ENOENT'
              ? `الأمر غير مثبت أو غير موجود في PATH: ${command}`
              : (command === 'sudo' ? friendlySudoError(stderr || err.message || '') : (stderr || err.message || '')),
            duration,
            timedOut: err.killed === true,
          };
          audit({ ...base, ...result });
          return resolve(result);
        }

        const result = { ok: true, code: 0, stdout: stdout || '', stderr: stderr || '', duration, timedOut: false };
        audit({ ...base, ...result, code: 0 });
        return resolve(result);
      }
    );
  });
}

function friendlySudoError(stderr) {
  if (/a password is required|no tty present|no askpass|terminal is required/i.test(stderr || '')) {
    return `${stderr}\n💡 أدخل باسورد نظامك من نافذة التأكيد لإكمال العملية.`;
  }
  if (/sorry, try again|incorrect password|authentication failure/i.test(stderr || '')) {
    return `${stderr}\n💡 باسورد النظام غير صحيح — حاول مرة أخرى.`;
  }
  return stderr;
}

// تنفيذ sudo مع باسورد نظام لحظي عبر stdin — الباسورد لا يُحفَظ ولا يُسجَّل.
function executeSudo({ args, cwd, timeout, sudoPassword, resolve }) {
  const config = require('../config');
  const startedAt = Date.now();
  const effectiveTimeout = timeout || config.terminal.defaultTimeout;
  const maxOut = Math.min(MAX_BUFFER, config.terminal.maxOutput);
  const finalArgs = args.includes('-S') ? args : ['-S', ...args];
  let secret = String(sudoPassword);
  sudoPassword = null;

  const child = spawn('sudo', finalArgs, { cwd, windowsHide: true });
  let stdout = '';
  let stderr = '';
  let finished = false;

  const timer = setTimeout(() => {
    if (!finished) {
      finished = true;
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      secret = '';
      resolve({ ok: false, code: 1, stdout, stderr, duration: Date.now() - startedAt, timedOut: true });
    }
  }, effectiveTimeout);

  const append = (current, chunk) => {
    const next = current + chunk.toString();
    return next.length > maxOut ? next.slice(-maxOut) : next;
  };
  child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
  child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
  child.on('error', (e) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    secret = '';
    const result = { ok: false, code: 1, stdout, stderr: `تعذر تشغيل sudo: ${e.message}`, duration: Date.now() - startedAt, timedOut: false };
    audit({ command: 'sudo', args, cwd, ...result });
    resolve(result);
  });
  child.on('close', (code) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    secret = '';
    const failed = code !== 0;
    const result = failed
      ? { ok: false, code: code || 1, stdout, stderr: friendlySudoError(stderr), duration: Date.now() - startedAt, timedOut: false }
      : { ok: true, code: 0, stdout, stderr, duration: Date.now() - startedAt, timedOut: false };
    audit({ command: 'sudo', args, cwd, ...result });
    resolve(result);
  });

  try {
    child.stdin.write(secret + '\n');
    child.stdin.end();
  } catch { /* ignore */ }
  secret = '';
}

function isAllowed(command) {
  try {
    const config = require('../config');
    if (config.terminal.mode === 'whitelist' || config.terminal.enforceWhitelist) {
      const registry = require('../services/commandRegistry');
      const entry = registry.get(command);
      return Boolean(entry && entry.enabled);
    }
    return true; // open mode
  } catch { return false; }
}

module.exports = { execute, isAllowed, PRIVILEGED: [...PRIVILEGED] };
