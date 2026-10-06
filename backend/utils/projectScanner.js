const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out',
  '.next', '.nuxt', '.svelte-kit', '.vite', '.cache', 'coverage',
  '.nyc_output', '.venv', 'venv', 'env', '__pycache__',
  '.pytest_cache', '.mypy_cache', 'target', 'bin', 'obj', '.idea', '.vscode',
]);

const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function isIgnored(name) {
  const isEnvSecret = name.startsWith('.env') && name !== '.env.example';
  const isKeyFile = name.endsWith('.pem') || name.endsWith('.key');
  const isRuntimeSecret = name === 'github_accounts.json' || name === 'providers.json';
  return IGNORED_DIRS.has(name) || IGNORED_FILES.has(name) || isEnvSecret || isKeyFile || isRuntimeSecret;
}

async function readJsonSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function detectStack(root) {
  const stack = { languages: [], frameworks: [], tools: [] };
  const checks = [
    { file: 'package.json', lang: 'JavaScript/Node', tool: 'npm' },
    { file: 'yarn.lock', tool: 'yarn' },
    { file: 'pnpm-lock.yaml', tool: 'pnpm' },
    { file: 'requirements.txt', lang: 'Python', tool: 'pip' },
    { file: 'pyproject.toml', lang: 'Python', tool: 'poetry/pip' },
    { file: 'go.mod', lang: 'Go', tool: 'go' },
    { file: 'Cargo.toml', lang: 'Rust', tool: 'cargo' },
    { file: 'composer.json', lang: 'PHP', tool: 'composer' },
    { file: 'Gemfile', lang: 'Ruby', tool: 'bundler' },
    { file: 'pom.xml', lang: 'Java', tool: 'maven' },
    { file: 'build.gradle', lang: 'Java/Kotlin', tool: 'gradle' },
    { file: 'pubspec.yaml', lang: 'Dart', tool: 'pub' },
    { file: 'Dockerfile', tool: 'docker' },
    { file: 'docker-compose.yml', tool: 'docker-compose' },
  ];
  for (const c of checks) {
    if (fsSync.existsSync(path.join(root, c.file))) {
      if (c.lang && !stack.languages.includes(c.lang)) stack.languages.push(c.lang);
      if (c.tool && !stack.tools.includes(c.tool)) stack.tools.push(c.tool);
    }
  }
  const pkg = await readJsonSafe(path.join(root, 'package.json'));
  if (pkg) {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const frameworkMap = {
      react: 'React', 'react-dom': 'React', next: 'Next.js', vue: 'Vue',
      nuxt: 'Nuxt', svelte: 'Svelte', '@angular/core': 'Angular',
      express: 'Express', fastify: 'Fastify', koa: 'Koa',
      '@nestjs/core': 'NestJS', vite: 'Vite', webpack: 'Webpack',
      typescript: 'TypeScript', tailwindcss: 'Tailwind CSS', electron: 'Electron',
    };
    for (const [dep, label] of Object.entries(frameworkMap)) {
      if (allDeps[dep] && !stack.frameworks.includes(label)) stack.frameworks.push(label);
    }
  }
  return stack;
}

async function scan(root, opts = {}) {
  const maxEntries = opts.maxEntries || 10000;
  if (!fsSync.existsSync(root)) {
    const err = new Error(`Path does not exist: ${root}`);
    err.statusCode = 404;
    throw err;
  }
  const stack = await detectStack(root);
  let fileCount = 0;
  let totalSize = 0;
  let truncated = false;
  const topLevel = [];

  async function walk(dir) {
    if (fileCount >= maxEntries) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (isIgnored(entry.name)) continue;
      if (fileCount >= maxEntries) {
        truncated = true;
        return;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        fileCount++;
        try {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
        } catch {}
      }
    }
  }

  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (isIgnored(entry.name)) continue;
      topLevel.push({
        name: entry.name,
        type: entry.isDirectory() ? 'dir' : 'file',
      });
    }
  } catch {}

  await walk(root);

  return {
    root,
    stack,
    fileCount,
    totalSize,
    topLevel,
    truncated,
    scannedAt: new Date().toISOString(),
  };
}

async function tree(root, opts = {}) {
  const maxDepth = opts.maxDepth ?? 5;
  const maxEntries = opts.maxEntries ?? 5000;
  if (!fsSync.existsSync(root)) {
    const err = new Error(`Path does not exist: ${root}`);
    err.statusCode = 404;
    throw err;
  }
  let count = 0;
  let truncated = false;

  async function walk(dir, depth) {
    if (depth > maxDepth || count >= maxEntries) {
      truncated = true;
      return [];
    }
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const result = [];
    for (const entry of entries) {
      if (isIgnored(entry.name)) continue;
      if (count >= maxEntries) {
        truncated = true;
        break;
      }
      const fullPath = path.join(dir, entry.name);
      const relativePath = path
        .relative(root, fullPath)
        .split(path.sep)
        .join('/');
      count++;
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          type: 'dir',
          path: relativePath,
          relativePath,
          children: await walk(fullPath, depth + 1),
        });
      } else if (entry.isFile()) {
        let size = 0;
        try {
          size = (await fs.stat(fullPath)).size;
        } catch {}
        result.push({
          name: entry.name,
          type: 'file',
          path: relativePath,
          relativePath,
          size,
        });
      }
    }
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return result;
  }

  const children = await walk(root, 0);
  return {
    root,
    name: path.basename(root),
    type: 'dir',
    children,
    truncated,
  };
}

function commandExists(cmd) {
  return new Promise((resolve) => {
    const checker = process.platform === 'win32' ? 'where' : 'which';
    execFile(checker, [cmd], { windowsHide: true }, (err) => {
      resolve(!err);
    });
  });
}

async function detectCliTools(tools) {
  const results = await Promise.all(
    tools.map(async (t) => {
      const available = await commandExists(t.name);
      return { name: t.name, label: t.label, available };
    })
  );
  return results;
}

async function fetchJson(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function detectLocalModels() {
  const [ollama, lmStudio] = await Promise.all([
    fetchJson('http://127.0.0.1:11434/api/tags'),
    fetchJson('http://127.0.0.1:1234/v1/models'),
  ]);
  const groups = [];

  if (ollama && Array.isArray(ollama.models)) {
    groups.push({
      providerId: 'local:ollama',
      providerName: 'Ollama محلي',
      type: 'local',
      source: 'local',
      available: true,
      models: ollama.models.map((model) => ({
        id: model.name,
        name: model.name,
        providerId: 'local:ollama',
        providerName: 'Ollama محلي',
        details: model.details?.parameter_size || null,
      })),
    });
  }

  if (lmStudio && Array.isArray(lmStudio.data)) {
    groups.push({
      providerId: 'local:lmstudio',
      providerName: 'LM Studio محلي',
      type: 'local',
      source: 'local',
      available: true,
      models: lmStudio.data.map((model) => ({
        id: model.id,
        name: model.id,
        providerId: 'local:lmstudio',
        providerName: 'LM Studio محلي',
      })),
    });
  }

  return groups;
}

async function runVersion(cmd, args = ['--version']) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(null);
      resolve((stdout || '').trim().split('\n')[0]);
    });
  });
}

module.exports = {
  scan,
  tree,
  detectCliTools,
  detectLocalModels,
  runVersion,
};
