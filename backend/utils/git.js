const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const GIT_TIMEOUT_MS = 120000;
const MAX_BUFFER = 10 * 1024 * 1024;

function run(cwd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'git',
      args,
      {
        cwd,
        timeout: opts.timeout || GIT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) {
          err.stdout = stdout;
          err.stderr = stderr;
          return reject(err);
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    );
    if (opts.input) child.stdin.end(opts.input);
  });
}

async function isInstalled() {
  try {
    await run(process.cwd(), ['--version']);
    return true;
  } catch {
    return false;
  }
}

function isRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

async function init(dir) {
  if (isRepo(dir)) return { stdout: 'already a repo', stderr: '' };
  return run(dir, ['init']);
}

async function addAll(dir) {
  return run(dir, ['add', '-A']);
}

async function commit(dir, message) {
  try {
    const result = await run(dir, ['commit', '-m', message]);
    return { ...result, empty: false };
  } catch (err) {
    const combined = `${err.stdout || ''}${err.stderr || ''}`;
    if (combined.includes('nothing to commit')) {
      return { stdout: err.stdout || '', stderr: err.stderr || '', empty: true };
    }
    throw err;
  }
}

async function renameBranch(dir, name) {
  return run(dir, ['branch', '-M', name]);
}

async function setRemote(dir, name, url) {
  try {
    await run(dir, ['remote', 'remove', name]);
  } catch {}
  return run(dir, ['remote', 'add', name, url]);
}

async function push(dir, remote, branch, opts = {}) {
  const args = ['push', '-u', remote, branch];
  if (opts.force) args.push('--force');
  return run(dir, args);
}

async function initAndPush(dir, { remoteUrl, branch = 'main', commitMessage, force = false }) {
  const installed = await isInstalled();
  if (!installed) {
    const err = new Error('git is not installed or not in PATH');
    err.statusCode = 500;
    throw err;
  }
  if (!fs.existsSync(dir)) {
    const err = new Error(`Directory does not exist: ${dir}`);
    err.statusCode = 400;
    throw err;
  }
  const steps = {};
  steps.init = await init(dir);
  steps.add = await addAll(dir);
  steps.commit = await commit(dir, commitMessage);
  steps.rename = await renameBranch(dir, branch);
  steps.remote = await setRemote(dir, 'origin', remoteUrl);
  steps.push = await push(dir, 'origin', branch, { force });
  return {
    branch,
    committed: !steps.commit.empty,
    output: steps.push.stdout,
  };
}

module.exports = {
  run,
  isInstalled,
  isRepo,
  init,
  addAll,
  commit,
  renameBranch,
  setRemote,
  push,
  initAndPush,
};