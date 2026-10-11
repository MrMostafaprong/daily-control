const fs = require('fs');
const path = require('path');

/**
 * سجل الأوامر الخارجي — Database جانبية للأوامر.
 * - الملف: backend/data/terminal-commands.json
 * - يتحدث بدون إعادة تشغيل: كل قراءة تتحقق من mtime، +watch اختياري.
 * - تحديثه لا يتطلب نسخة جديدة من التطبيق.
 */

const DEFAULT_COMMANDS = [
  { name: 'npm', enabled: true, requiresRoot: false, risk: 'low', description: 'Node package manager' },
  { name: 'yarn', enabled: true, requiresRoot: false, risk: 'low', description: 'Yarn package manager' },
  { name: 'pnpm', enabled: true, requiresRoot: false, risk: 'low', description: 'pnpm package manager' },
  { name: 'bun', enabled: true, requiresRoot: false, risk: 'low', description: 'Bun runtime' },
  { name: 'node', enabled: true, requiresRoot: false, risk: 'low', description: 'Node.js runtime' },
  { name: 'git', enabled: true, requiresRoot: false, risk: 'low', description: 'Git VCS' },
  { name: 'python', enabled: true, requiresRoot: false, risk: 'low', description: 'Python' },
  { name: 'python3', enabled: true, requiresRoot: false, risk: 'low', description: 'Python 3' },
  { name: 'pip', enabled: true, requiresRoot: false, risk: 'low', description: 'pip installer' },
  { name: 'pip3', enabled: true, requiresRoot: false, risk: 'low', description: 'pip3 installer' },
  { name: 'claude', enabled: true, requiresRoot: false, risk: 'low', description: 'Claude CLI' },
  { name: 'codex', enabled: true, requiresRoot: false, risk: 'low', description: 'Codex CLI' },
  { name: 'llm', enabled: true, requiresRoot: false, risk: 'low', description: 'LLM CLI' },
  { name: 'ollama', enabled: true, requiresRoot: false, risk: 'low', description: 'Ollama local models' },
  { name: 'fastfetch', enabled: true, requiresRoot: false, risk: 'low', description: 'System info' },
  { name: 'neofetch', enabled: true, requiresRoot: false, risk: 'low', description: 'System info' },
  { name: 'htop', enabled: true, requiresRoot: false, risk: 'low', description: 'Process viewer' },
  { name: 'btop', enabled: true, requiresRoot: false, risk: 'low', description: 'Process viewer' },
  { name: 'ls', enabled: true, requiresRoot: false, risk: 'low', description: 'List files' },
  { name: 'pwd', enabled: true, requiresRoot: false, risk: 'low', description: 'Print working dir' },
  { name: 'whoami', enabled: true, requiresRoot: false, risk: 'low', description: 'Current user' },
  { name: 'uname', enabled: true, requiresRoot: false, risk: 'low', description: 'System name' },
  { name: 'df', enabled: true, requiresRoot: false, risk: 'low', description: 'Disk free' },
  { name: 'du', enabled: true, requiresRoot: false, risk: 'low', description: 'Disk usage' },
  { name: 'xdg-open', enabled: true, requiresRoot: false, risk: 'low', description: 'Open file/URL' },
  { name: 'code', enabled: true, requiresRoot: false, risk: 'low', description: 'VS Code' },
  { name: 'mkdir', enabled: true, requiresRoot: false, risk: 'medium', description: 'Create dir (project only)' },
  { name: 'touch', enabled: true, requiresRoot: false, risk: 'medium', description: 'Create file (project only)' },
  { name: 'nano', enabled: true, requiresRoot: false, risk: 'medium', description: 'Blocked interactive — use editor' },
  { name: 'cd', enabled: true, requiresRoot: false, risk: 'low', description: 'Change dir (handled internally)' },
  // أوامر مميزة: موجودة في القاعدة لكنها تتطلب روت — تُستخدم في وضع open أيضًا
  { name: 'sudo', enabled: true, requiresRoot: true, risk: 'critical', description: 'Requires ROOT unlock' },
  { name: 'su', enabled: true, requiresRoot: true, risk: 'critical', description: 'Requires ROOT unlock' },
  { name: 'chmod', enabled: true, requiresRoot: true, risk: 'high', description: 'Requires ROOT unlock' },
  { name: 'chown', enabled: true, requiresRoot: true, risk: 'high', description: 'Requires ROOT unlock' },
  { name: 'systemctl', enabled: true, requiresRoot: true, risk: 'high', description: 'Requires ROOT unlock' },
  { name: 'docker', enabled: true, requiresRoot: true, risk: 'high', description: 'Requires ROOT unlock' },
];

let cache = null;
let cacheMtime = 0;
let watcherStarted = false;

function resolveFile() {
  const config = require('../config');
  const custom = config.terminal.commandsFile;
  if (custom) return path.isAbsolute(custom) ? custom : path.resolve(config.paths.backend, custom);
  return path.join(config.paths.data, 'terminal-commands.json');
}

function seedIfMissing(file) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(file)) {
    const payload = { version: 1, updatedAt: new Date().toISOString(), commands: DEFAULT_COMMANDS };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf-8');
    return payload;
  }
  return null;
}

function readRaw(force = false) {
  const file = resolveFile();
  const seeded = seedIfMissing(file);
  if (seeded) {
    cache = seeded;
    try { cacheMtime = fs.statSync(file).mtimeMs; } catch { cacheMtime = 0; }
    return cache;
  }
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { mtime = 0; }
  if (!force && cache && mtime === cacheMtime) return cache;
  const raw = fs.readFileSync(file, 'utf-8');
  if (!raw.trim()) throw Object.assign(new Error('terminal-commands.json فارغ'), { statusCode: 500 });
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw Object.assign(new Error(`terminal-commands.json تالف: ${e.message}`), { statusCode: 500 }); }
  const commands = Array.isArray(parsed) ? parsed : parsed.commands;
  if (!Array.isArray(commands)) throw Object.assign(new Error('terminal-commands.json يجب أن يحتوي على commands[]'), { statusCode: 500 });
  cache = { version: parsed.version || 1, updatedAt: parsed.updatedAt || null, commands };
  cacheMtime = mtime;
  return cache;
}

function normalize(entry) {
  return {
    name: String(entry.name || '').trim(),
    enabled: entry.enabled !== false,
    requiresRoot: entry.requiresRoot === true,
    risk: entry.risk || 'low',
    description: entry.description || '',
  };
}

function list() {
  return readRaw().commands.map(normalize).filter((c) => c.name);
}

function listAllowed() {
  return list().filter((c) => c.enabled).map((c) => c.name);
}

function get(name) {
  return list().find((c) => c.name === name) || null;
}

function persist(commands, version) {
  const file = resolveFile();
  const current = readRaw(true);
  const payload = {
    version: (version || current.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    commands,
  };
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
  cache = payload;
  try { cacheMtime = fs.statSync(file).mtimeMs; } catch { cacheMtime = 0; }
  return payload;
}

function upsert(entry) {
  const name = String(entry.name || '').trim();
  if (!name || /[;&|<>`$()\\\s\n\r]/.test(name)) {
    throw Object.assign(new Error('اسم أمر غير صالح'), { statusCode: 400 });
  }
  const commands = list();
  const idx = commands.findIndex((c) => c.name === name);
  if (idx === -1) {
    const next = normalize({ ...entry, name });
    commands.push(next);
    return { entry: next, store: persist(commands) };
  }
  // دمج: الحقول غير المرسلة تُحفظ من القديم (حتى لا يمسح الوصف عند تعطيل/تفعيل)
  const old = commands[idx];
  const merged = {
    name,
    enabled: entry.enabled === undefined ? old.enabled : entry.enabled !== false,
    requiresRoot: entry.requiresRoot === undefined ? old.requiresRoot : entry.requiresRoot === true,
    risk: entry.risk || old.risk || 'low',
    description: entry.description === undefined ? (old.description || '') : String(entry.description),
  };
  commands[idx] = merged;
  return { entry: merged, store: persist(commands) };
}

function remove(name) {
  const commands = list().filter((c) => c.name !== name);
  return persist(commands);
}

function setEnabled(name, enabled) {
  const item = get(name);
  if (!item) throw Object.assign(new Error(`الأمر "${name}" غير موجود`), { statusCode: 404 });
  return upsert({ ...item, enabled: !!enabled });
}

function reload() {
  return readRaw(true);
}

function watch(onChange) {
  if (watcherStarted) return;
  watcherStarted = true;
  const file = resolveFile();
  seedIfMissing(file);
  try {
    fs.watchFile(file, { interval: 1500 }, () => {
      try {
        reload();
        if (typeof onChange === 'function') onChange();
        console.log('[commands] reloaded terminal-commands.json (hot-reload, بدون إعادة تشغيل)');
      } catch (e) {
        console.error('[commands] reload failed:', e.message);
      }
    });
  } catch (e) {
    console.error('[commands] watch failed:', e.message);
  }
}

module.exports = {
  DEFAULT_COMMANDS,
  resolveFile,
  list,
  listAllowed,
  get,
  upsert,
  remove,
  setEnabled,
  reload,
  watch,
  readRaw,
};
