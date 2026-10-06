const path = require('path');
const fs = require('fs/promises');
const config = require('../config');
const projectScanner = require('../utils/projectScanner');
const projectService = require('./projectService');
const { assertRealPathInside } = require('../utils/pathGuard');

function resolveSafePath(root, filePath) {
  const resolved = path.resolve(root, filePath);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!resolved.startsWith(rootWithSep) && resolved !== root) {
    const err = new Error('Path is outside the project root');
    err.statusCode = 403;
    throw err;
  }
  return resolved;
}

function assertSafeFileName(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  const blocked = new Set(['.git', '.ssh', '.aws', '.codex', '.env', '.env.local', '.env.production', 'github_accounts.json', 'providers.json']);
  if (parts.some((part) => (part.startsWith('.env') && part !== '.env.example') || blocked.has(part) || part.endsWith('.pem') || part.endsWith('.key'))) {
    const err = new Error('Access to sensitive files is blocked');
    err.statusCode = 403;
    throw err;
  }
}

function resolveBasePath(projectId) {
  if (!projectId) return config.paths.root;
  const project = projectService.getProject(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  return project.path || config.paths.root;
}

async function getFileTree(projectId) {
  const project = projectService.getProject(projectId);
  if (!project) return null;
  if (!project.path) throw new Error('Project has no path set');
  return projectScanner.tree(project.path);
}

async function readFile(filePath, { projectId } = {}) {
  assertSafeFileName(filePath);
  const base = resolveBasePath(projectId);
  const fullPath = resolveSafePath(base, filePath);
  try {
    assertRealPathInside(base, fullPath);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      const err = new Error('ده مجلد مش ملف');
      err.statusCode = 400;
      throw err;
    }
    if (stat.size > 2 * 1024 * 1024) {
      const err = new Error('الملف أكبر من 2 ميجا ومش هيتفتح في المحرر');
      err.statusCode = 413;
      throw err;
    }
    const buffer = await fs.readFile(fullPath);
    if (buffer.subarray(0, 8000).includes(0)) {
      const err = new Error('الملف ثنائي (binary) ومش قابل للتعديل كنص');
      err.statusCode = 415;
      throw err;
    }
    const content = buffer.toString('utf-8');
    return {
      path: filePath,
      content,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function writeFile(filePath, content, { projectId } = {}) {
  assertSafeFileName(filePath);
  const base = resolveBasePath(projectId);
  const fullPath = resolveSafePath(base, filePath);
  if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
    const err = new Error('File is too large (maximum 2 MB)');
    err.statusCode = 413;
    throw err;
  }
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  assertRealPathInside(base, path.dirname(fullPath));
  if (fsSyncExists(fullPath)) assertRealPathInside(base, fullPath);
  await fs.writeFile(fullPath, content, 'utf-8');
  const stat = await fs.stat(fullPath);
  return {
    path: filePath,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function fsSyncExists(filePath) {
  try { require('fs').lstatSync(filePath); return true; } catch { return false; }
}

async function detectModels() {
  const envModels = [];
  const envMap = {
    OPENAI_API_KEY: 'OpenAI (GPT)',
    ANTHROPIC_API_KEY: 'Anthropic (Claude)',
    DEEPSEEK_API_KEY: 'DeepSeek',
    QWEN_API_KEY: 'Qwen',
    GOOGLE_API_KEY: 'Google (Gemini)',
    GROQ_API_KEY: 'Groq',
    OPENROUTER_API_KEY: 'OpenRouter',
  };
  for (const [key, label] of Object.entries(envMap)) {
    if (process.env[key]) {
      envModels.push({ source: 'env', key, label, available: true });
    }
  }
  const cliModels = await projectScanner.detectCliTools([
    { name: 'claude', label: 'Claude CLI' },
    { name: 'codex', label: 'Codex CLI' },
    { name: 'llm', label: 'LLM CLI' },
    { name: 'ollama', label: 'Ollama' },
  ]);
  const localModels = await projectScanner.detectLocalModels();
  return { env: envModels, cli: cliModels, local: localModels };
}

module.exports = {
  getFileTree,
  readFile,
  writeFile,
  detectModels,
};
