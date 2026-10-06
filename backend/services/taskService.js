const db = require('../db');

const COLLECTION = 'tasks';

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'in_progress', 'done', 'cancelled'];

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sortTasks(tasks) {
  return tasks.slice().sort((a, b) => {
    const ap = PRIORITY_RANK[a.priority] ?? 9;
    const bp = PRIORITY_RANK[b.priority] ?? 9;
    if (ap !== bp) return ap - bp;

    const ad = a.dueDate || '9999-12-31';
    const bd = b.dueDate || '9999-12-31';
    if (ad !== bd) return ad.localeCompare(bd);

    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}

function list({ projectId, status, priority, dueBefore } = {}) {
  let items = db.all(COLLECTION);
  if (projectId) items = items.filter((t) => t.projectId === projectId);
  if (status) items = items.filter((t) => t.status === status);
  if (priority) items = items.filter((t) => t.priority === priority);
  if (dueBefore) items = items.filter((t) => t.dueDate && t.dueDate <= dueBefore);
  return sortTasks(items);
}

function getById(id) {
  return db.findById(COLLECTION, id);
}

function create({ title, description, priority, status, dueDate, projectId, tags, estimatedMinutes }) {
  if (!title || typeof title !== 'string') throw createError(400, 'title is required');

  const safePriority = priority || 'medium';
  if (!PRIORITIES.includes(safePriority)) {
    throw createError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }

  const safeStatus = status || 'pending';
  if (!STATUSES.includes(safeStatus)) {
    throw createError(400, `status must be one of: ${STATUSES.join(', ')}`);
  }

  return db.insert(COLLECTION, {
    title: title.trim(),
    description: description || '',
    priority: safePriority,
    status: safeStatus,
    dueDate: dueDate || null,
    projectId: projectId || null,
    tags: Array.isArray(tags) ? tags : [],
    estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : null,
    completedAt: null,
  });
}

function update(id, patch = {}) {
  const existing = db.findById(COLLECTION, id);
  if (!existing) return null;

  const safe = {};

  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string' || !patch.title.trim()) {
      throw createError(400, 'title must be a non-empty string');
    }
    safe.title = patch.title.trim();
  }
  if (patch.description !== undefined) safe.description = patch.description;
  if (patch.priority !== undefined) {
    if (!PRIORITIES.includes(patch.priority)) {
      throw createError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
    }
    safe.priority = patch.priority;
  }
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) {
      throw createError(400, `status must be one of: ${STATUSES.join(', ')}`);
    }
    safe.status = patch.status;
    if (patch.status === 'done') safe.completedAt = new Date().toISOString();
    else safe.completedAt = null;
  }
  if (patch.dueDate !== undefined) safe.dueDate = patch.dueDate || null;
  if (patch.projectId !== undefined) safe.projectId = patch.projectId || null;
  if (patch.tags !== undefined) safe.tags = Array.isArray(patch.tags) ? patch.tags : [];
  if (patch.estimatedMinutes !== undefined) {
    safe.estimatedMinutes = Number.isFinite(patch.estimatedMinutes)
      ? patch.estimatedMinutes
      : null;
  }

  return db.update(COLLECTION, id, safe);
}

function remove(id) {
  return db.remove(COLLECTION, id);
}

function complete(id) {
  return update(id, { status: 'done' });
}

function stats() {
  const tasks = db.all(COLLECTION);
  const now = today();

  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    cancelled: tasks.filter((t) => t.status === 'cancelled').length,
    overdue: tasks.filter(
      (t) =>
        t.status !== 'done' &&
        t.status !== 'cancelled' &&
        t.dueDate &&
        t.dueDate < now
    ).length,
  };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  complete,
  stats,
  PRIORITIES,
  STATUSES,
};
