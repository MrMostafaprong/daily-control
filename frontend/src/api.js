// ─────────────────────────────────────────────
// api.js — نقطة الاتصال الوحيدة بالباك اند
// كل الـ requests بتعد من الـ proxy بتاع vite
// ─────────────────────────────────────────────

const BASE = '/api';
const ACCESS_TOKEN = import.meta.env?.VITE_API_TOKEN || '';

// ─── Helper داخلي ────────────────────────────

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
  const { timeout: _timeout, signal, headers: extraHeaders, ...fetchOptions } = options;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...(ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {}),
        ...(extraHeaders || {}),
      },
      signal: signal || controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالباك اند');
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  // 204 = نجاح من غير محتوى
  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // رد من غير JSON
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `خطأ (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
const del = (path) => request(path, { method: 'DELETE' });

// ─── Core ────────────────────────────────────

export const api = {
  health: () => get('/health'),
  info: () => get('/info'),
  shutdown: () => post('/shutdown', {}),

  // ─── Projects ──────────────────────────────
  projects: {
    list: () => get('/projects'),
    discover: () => get('/projects/discover'),
    browse: (path) => get(`/projects/browse${path ? `?path=${encodeURIComponent(path)}` : ''}`),
    get: (id) => get(`/projects/${encodeURIComponent(id)}`),
    create: (data) => post('/projects', data),
    update: (id, data) => put(`/projects/${encodeURIComponent(id)}`, data),
    remove: (id) => del(`/projects/${encodeURIComponent(id)}`),
    scan: (id) => post(`/projects/${encodeURIComponent(id)}/scan`),
    tree: (id) => get(`/projects/${encodeURIComponent(id)}/tree`),
  },

  // ─── GitHub ────────────────────────────────
  github: {
    status: () => get('/github/status'),
    connect: (token) => post('/github/connect', { token }),
    disconnect: () => del('/github/disconnect'),
    repos: () => get('/github/repos'),
    createRepo: (data) => post('/github/repos', data),
    push: (projectId, { repoName, commitMessage }) =>
      post(`/github/push/${encodeURIComponent(projectId)}`, { repoName, commitMessage }),
    contents: (owner, repo, path = '', ref) => {
      const params = new URLSearchParams();
      if (path) params.set('path', path);
      if (ref) params.set('ref', ref);
      const query = params.toString();
      return get(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents${query ? `?${query}` : ''}`);
    },
    writeFile: (owner, repo, data) => put(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`, data),
    deleteFile: (owner, repo, data) => request(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`, { method: 'DELETE', body: JSON.stringify(data) }),
    deleteRepo: (owner, repo) => del(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`),
    createIssue: (owner, repo, data) => post(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, data),
    commentIssue: (owner, repo, issueNumber, body) => post(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${encodeURIComponent(issueNumber)}/comments`, { body }),
  },

  // ─── Files ─────────────────────────────────
  files: {
    tree: (projectId) => get(`/files/tree/${encodeURIComponent(projectId)}`),
    read: (path, projectId) => {
      const params = new URLSearchParams({ path });
      if (projectId) params.set('projectId', projectId);
      return get(`/files/read?${params}`);
    },
    write: (path, content, projectId) =>
      post('/files/write', { path, content, projectId }),
    models: () => get('/files/models'),
  },
  // ─── Providers ─────────────────────────────
  providers: {
    list: () => get('/providers'),
    get: (id) => get(`/providers/${encodeURIComponent(id)}`),
    defaults: () => get('/providers/defaults'),
    create: (data) => post('/providers', data),
    update: (id, data) => put(`/providers/${encodeURIComponent(id)}`, data),
    remove: (id) => del(`/providers/${encodeURIComponent(id)}`),
  },

  // ─── Models ────────────────────────────────
  models: {
    list: (refresh = false) => get(`/models${refresh ? '?refresh=true' : ''}`),
    refresh: () => post('/models/refresh'),
    get: (providerId, modelId) => get(`/models/${encodeURIComponent(providerId)}/${encodeURIComponent(modelId)}`),
  },

  // ─── AI ────────────────────────────────────
  ai: {
    chat: (data) => post('/ai/chat', data),
    sessions: {
      list: () => get('/ai/sessions'), get: (id) => get(`/ai/sessions/${encodeURIComponent(id)}`),
      create: (data = {}) => post('/ai/sessions', data), update: (id, data) => put(`/ai/sessions/${encodeURIComponent(id)}`, data),
      remove: (id) => del(`/ai/sessions/${encodeURIComponent(id)}`),
    },
    fallback: (data) => post('/ai/fallback', data),
    parallel: (data) => post('/ai/parallel', data),
    // بث مباشر (SSE) — onChunk(text) لكل جزء، ويرجع النص الكامل
    stream: async (data, { onChunk, signal } = {}) => {
      const res = await fetch(`${BASE}/stream/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(data),
        signal,
      });
      if (!res.ok || !res.body) {
        let message = `خطأ (${res.status})`;
        try { message = (await res.json())?.error || message; } catch { /* no body */ }
        throw new Error(message);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const raw = /^data: (.+)$/m.exec(block)?.[1];
          if (!event || !raw) continue;
          let payload = null;
          try { payload = JSON.parse(raw); } catch { continue; }
          if (event === 'chunk' && payload.content) {
            full += payload.content;
            onChunk?.(payload.content, full);
          } else if (event === 'error') {
            throw new Error(payload.message || 'فشل البث');
          }
        }
      }
      return full;
    },
  },

  // ─── Terminal ──────────────────────────────
  terminal: {
    allowed: () => get('/terminal/allowed'),
    run: (projectId, data) => post(`/terminal/run/${encodeURIComponent(projectId)}`, data),
  },

  // ─── Tasks ─────────────────────────────────
  tasks: {
    list: (filters = {}) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== null && v !== '') params.set(k, v);
      }
      const qs = params.toString();
      return get(`/tasks${qs ? `?${qs}` : ''}`);
    },
    get: (id) => get(`/tasks/${id}`),
    create: (data) => post('/tasks', data),
    update: (id, data) => put(`/tasks/${id}`, data),
    remove: (id) => del(`/tasks/${id}`),
    complete: (id) => post(`/tasks/${id}/complete`),
    stats: () => get('/tasks/stats'),
  },

  // ─── Planner ───────────────────────────────
  planner: {
    daily: (data) => post('/planner/daily', data),
    breakdown: (taskId, data) => post(`/planner/breakdown/${taskId}`, data),
    priorities: (data) => post('/planner/priorities', data),
  },
};

export default api;
