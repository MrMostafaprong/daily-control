const db = require('../db');
const config = require('../config');
const git = require('../utils/git');
const projectService = require('./projectService');
const secretCrypto = require('../utils/crypto');

const GITHUB_API = 'https://api.github.com';
const GITHUB_ACCOUNT_ID = 'default';

function normalizeRepository(repo) {
  if (!repo) return null;
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName || repo.full_name,
    private: repo.private,
    defaultBranch: repo.defaultBranch || repo.default_branch || 'main',
    cloneUrl: repo.cloneUrl || repo.clone_url,
    sshUrl: repo.sshUrl || repo.ssh_url,
    url: repo.url || repo.html_url,
  };
}

function validateRepositoryPart(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(value)) {
    const err = new Error(`${label} contains invalid characters`);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function encodeContentPath(filePath = '') {
  if (typeof filePath !== 'string' || filePath.length > 500 || filePath.includes('\0')) {
    const err = new Error('Invalid repository path');
    err.statusCode = 400;
    throw err;
  }
  const parts = filePath.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..' || part.includes('\\'))) {
    const err = new Error('Invalid repository path');
    err.statusCode = 400;
    throw err;
  }
  return parts.map(encodeURIComponent).join('/');
}

function repoEndpoint(owner, repo, suffix = '') {
  return `/repos/${encodeURIComponent(validateRepositoryPart(owner, 'Owner'))}/${encodeURIComponent(validateRepositoryPart(repo, 'Repository'))}${suffix}`;
}

function getGithubToken() {
  const stored = db.findById('github_accounts', GITHUB_ACCOUNT_ID);
  if (stored && stored.token) {
    if (secretCrypto.isEncrypted(stored.token)) {
      try { return secretCrypto.decrypt(stored.token); } catch { return null; }
    }
    return stored.token;
  }
  return config.github.token || null;
}

async function ghFetch(endpoint, options = {}) {
  const token = getGithubToken();
  if (!token) {
    const err = new Error('GitHub is not connected');
    err.statusCode = 401;
    throw err;
  }
  const res = await fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.message || ''; } catch { /* no body */ }
    const err = new Error(`GitHub API error (${res.status})${detail ? `: ${detail}` : ''}`);
    err.statusCode = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

async function githubStatus() {
  const token = getGithubToken();
  if (!token) return { connected: false };
  try {
    const user = await ghFetch('/user');
    return {
      connected: true,
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function githubConnect(token) {
  if (!token || typeof token !== 'string') {
    const err = new Error('token must be a non-empty string');
    err.statusCode = 400;
    throw err;
  }
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const err = new Error('Invalid GitHub token');
    err.statusCode = 401;
    throw err;
  }
  const user = await res.json();
  const record = {
    id: GITHUB_ACCOUNT_ID,
    token: secretCrypto.encrypt(token),
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
  };
  const existing = db.findById('github_accounts', GITHUB_ACCOUNT_ID);
  if (existing) db.update('github_accounts', GITHUB_ACCOUNT_ID, record);
  else db.insert('github_accounts', record);
  return { login: user.login, name: user.name, avatarUrl: user.avatar_url };
}

function githubDisconnect() {
  const existing = db.findById('github_accounts', GITHUB_ACCOUNT_ID);
  if (existing) db.remove('github_accounts', GITHUB_ACCOUNT_ID);
}

async function githubListRepos() {
  const repos = await ghFetch('/user/repos?per_page=100&sort=updated');
  return repos.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    url: r.html_url,
    description: r.description || '',
    updatedAt: r.updated_at,
  }));
}

async function githubCreateRepo({ name, description, isPrivate }) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(name)) {
    const err = new Error('Repository name contains invalid characters');
    err.statusCode = 400;
    throw err;
  }
  const repo = normalizeRepository(await ghFetch('/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || '',
      private: !!isPrivate,
      auto_init: false,
    }),
  }));
  return repo;
}

async function githubPushProject(projectId, { repoName, commitMessage }) {
  if (typeof repoName !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(repoName)) {
    const err = new Error('Repository name contains invalid characters');
    err.statusCode = 400;
    throw err;
  }
  const project = projectService.getProject(projectId);
  if (!project) {
    const err = new Error('Project not found');
    err.statusCode = 404;
    throw err;
  }
  if (!project.path) {
    const err = new Error('Project has no path set');
    err.statusCode = 400;
    throw err;
  }
  const token = getGithubToken();
  if (!token) {
    const err = new Error('GitHub is not connected');
    err.statusCode = 401;
    throw err;
  }
  const user = await ghFetch('/user');
  let repo;
  try {
    repo = normalizeRepository(await ghFetch(`/repos/${user.login}/${repoName}`));
  } catch (err) {
    if (err.statusCode === 404) {
      repo = await githubCreateRepo({ name: repoName, isPrivate: true });
    } else {
      throw err;
    }
  }
  const remoteUrl = `https://${encodeURIComponent(token)}@github.com/${repo.fullName}.git`;
  const publicRemoteUrl = `https://github.com/${repo.fullName}.git`;
  let result;
  try {
    result = await git.initAndPush(project.path, {
      remoteUrl,
      branch: repo.defaultBranch || 'main',
      commitMessage: commitMessage || 'Initial commit from Daily Control',
    });
  } finally {
    // Never leave the access token persisted in .git/config after the push.
    try { await git.setRemote(project.path, 'origin', publicRemoteUrl); } catch {}
  }
  return {
    repo: { name: repo.name, fullName: repo.fullName, url: repo.url },
    git: result,
  };
}

async function githubListContents(owner, repo, filePath = '', ref) {
  const encodedPath = encodeContentPath(filePath);
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const result = await ghFetch(`${repoEndpoint(owner, repo, `/contents${encodedPath ? `/${encodedPath}` : ''}`)}${query}`);
  return Array.isArray(result) ? result.map((item) => ({
    name: item.name,
    path: item.path,
    type: item.type,
    size: item.size || 0,
    sha: item.sha,
    url: item.html_url,
  })) : {
    name: result.name,
    path: result.path,
    type: result.type,
    size: result.size || 0,
    sha: result.sha,
    content: result.encoding === 'base64' ? Buffer.from((result.content || '').replace(/\n/g, ''), 'base64').toString('utf8') : '',
    url: result.html_url,
  };
}

async function githubWriteFile(owner, repo, { path: filePath, content, message, branch, sha }) {
  if (typeof content !== 'string' || content.length > 2 * 1024 * 1024) {
    const err = new Error('File content must be a string up to 2 MB');
    err.statusCode = 400;
    throw err;
  }
  const payload = {
    message: typeof message === 'string' && message.trim() ? message.trim().slice(0, 200) : `Update ${filePath}`,
    content: Buffer.from(content, 'utf8').toString('base64'),
  };
  if (branch) payload.branch = branch;
  if (sha) payload.sha = sha;
  const result = await ghFetch(repoEndpoint(owner, repo, `/contents/${encodeContentPath(filePath)}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return { path: result.content?.path || filePath, sha: result.content?.sha, commit: result.commit?.html_url };
}

async function githubDeleteFile(owner, repo, { path: filePath, sha, message, branch }) {
  if (!sha) {
    const err = new Error('File sha is required to delete safely');
    err.statusCode = 400;
    throw err;
  }
  const payload = {
    message: typeof message === 'string' && message.trim() ? message.trim().slice(0, 200) : `Delete ${filePath}`,
    sha,
  };
  if (branch) payload.branch = branch;
  const result = await ghFetch(repoEndpoint(owner, repo, `/contents/${encodeContentPath(filePath)}`), {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
  return { path: filePath, commit: result.commit?.html_url };
}

async function githubDeleteRepo(owner, repo) {
  await ghFetch(repoEndpoint(owner, repo), { method: 'DELETE' });
  return { deleted: true, fullName: `${owner}/${repo}` };
}
async function githubUpdateVisibility(owner, repo, isPrivate) {
  if (typeof isPrivate !== 'boolean') { const err = new Error('isPrivate must be boolean'); err.statusCode = 400; throw err; }
  const result = await ghFetch(repoEndpoint(owner, repo), { method: 'PATCH', body: JSON.stringify({ private: isPrivate }) });
  return { name: result.name, fullName: result.full_name, private: result.private, url: result.html_url };
}

async function githubCreateIssue(owner, repo, { title, body }) {
  if (typeof title !== 'string' || !title.trim()) {
    const err = new Error('Issue title is required');
    err.statusCode = 400;
    throw err;
  }
  const result = await ghFetch(repoEndpoint(owner, repo, '/issues'), {
    method: 'POST',
    body: JSON.stringify({ title: title.trim().slice(0, 200), body: String(body || '').slice(0, 10000) }),
  });
  return { number: result.number, title: result.title, url: result.html_url };
}

async function githubCommentIssue(owner, repo, issueNumber, body) {
  if (!/^\d+$/.test(String(issueNumber)) || !String(body || '').trim()) {
    const err = new Error('A valid issue number and comment body are required');
    err.statusCode = 400;
    throw err;
  }
  const result = await ghFetch(repoEndpoint(owner, repo, `/issues/${issueNumber}/comments`), {
    method: 'POST',
    body: JSON.stringify({ body: String(body).slice(0, 10000) }),
  });
  return { id: result.id, url: result.html_url, body: result.body };
}

module.exports = {
  githubStatus,
  githubConnect,
  githubDisconnect,
  githubListRepos,
  githubCreateRepo,
  githubPushProject,
  githubListContents,
  githubWriteFile,
  githubDeleteFile,
  githubDeleteRepo,
  githubUpdateVisibility,
  githubCreateIssue,
  githubCommentIssue,
};
