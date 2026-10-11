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

function isNonFastForward(err) {
  const combined = `${err.stderr || ''}\n${err.stdout || ''}\n${err.message || ''}`;
  return /fetch first|non-fast-forward|\[rejected\]|failed to push some refs/i.test(combined);
}

function isRebaseConflict(err) {
  const combined = `${err.stderr || ''}\n${err.stdout || ''}\n${err.message || ''}`;
  return /CONFLICT|Failed to merge|could not apply|already exists|untracked working tree files/i.test(combined);
}

async function conflictedFiles(dir) {
  try {
    const { stdout } = await run(dir, ['diff', '--name-only', '--diff-filter=U']);
    return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

// سحب مع إعادة تأسيس — يحل حالة "fetch first" تلقائيًا.
// عند تعارض: يلغي العملية ويرمي خطأً عربيًا بأسماء الملفات المتعارضة.
async function pullRebase(dir, remote, branch) {
  try {
    return await run(dir, ['pull', '--rebase', remote, branch]);
  } catch (err) {
    if (isRebaseConflict(err)) {
      const files = await conflictedFiles(dir); // قبل الإجهاض — بعده القائمة تتمسح
      try { await run(dir, ['rebase', '--abort']); } catch { /* ignore */ }
      const error = new Error(
        `تعارض دمج — أُجهضت المزامنة تلقائيًا ولم يتغير شيء.\n` +
        (files.length ? `الملفات المتعارضة: ${files.join('، ')}\n` : '') +
        `حل التعارض يدويًا (عدّل الملفات ثم git add و git rebase --continue) وحاول الدفع مجددًا.`
      );
      error.statusCode = 409;
      error.code = 'MERGE_CONFLICT';
      error.files = files;
      throw error;
    }
    throw err;
  }
}

// دفع مع مزامنة تلقائية: لو رُفض الدفع لأن الريموت متقدم، يسحب (rebase) ثم يدفع مجددًا.
async function pushWithSync(dir, remote, branch, opts = {}) {
  const force = !!opts.force;
  const sync = opts.sync !== false; // مفعّل افتراضيًا
  try {
    const out = await push(dir, remote, branch, { force });
    return { ...out, synced: false };
  } catch (err) {
    if (!sync || force || !isNonFastForward(err)) throw err;
    const pulled = await pullRebase(dir, remote, branch);
    const out = await push(dir, remote, branch, { force });
    return { ...out, synced: true, pull: pulled.stdout };
  }
}

async function fetch(dir, remote = 'origin') {
  return run(dir, ['fetch', remote]);
}

// حالة التزامن: كم كوميت متقدم/متأخر عن الريموت (null لو لا يوجد upstream)
async function syncStatus(dir, remote = 'origin', branch = 'main') {
  try {
    await fetch(dir, remote);
    let upstream = branch;
    try {
      const { stdout } = await run(dir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
      upstream = stdout || branch;
    } catch { upstream = `${remote}/${branch}`; }
    const { stdout } = await run(dir, ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]);
    const [ahead, behind] = stdout.split(/\s+/).map((n) => Number(n) || 0);
    return { ahead, behind, branch, upstream };
  } catch {
    return { ahead: null, behind: null, branch, upstream: null };
  }
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
  pushWithSync,
  pullRebase,
  fetch,
  syncStatus,
  isNonFastForward,
  initAndPush,
};