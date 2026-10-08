const db = require('../db');
const COLLECTION = 'ai_sessions';
const MAX_MESSAGES = 100;
const MAX_CONTENT = 20000;
function error(statusCode, message) { const err = new Error(message); err.statusCode = statusCode; return err; }
function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-MAX_MESSAGES).map((message) => ({ role: ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'user', content: String(message.content || '').slice(0, MAX_CONTENT) }));
}
function list() { return db.all(COLLECTION).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); }
function get(id) { return db.findById(COLLECTION, id); }
function create({ title = 'جلسة جديدة', providerId = null, model = null, messages = [] } = {}) { return db.insert(COLLECTION, { title: String(title).trim().slice(0, 120) || 'جلسة جديدة', providerId: providerId || null, model: model || null, messages: cleanMessages(messages) }); }
function update(id, patch = {}) {
  if (!get(id)) return null;
  const safe = {};
  if (patch.title !== undefined) { const title = String(patch.title).trim().slice(0, 120); if (!title) throw error(400, 'عنوان الجلسة لا يمكن أن يكون فارغًا'); safe.title = title; }
  if (patch.providerId !== undefined) safe.providerId = patch.providerId || null;
  if (patch.model !== undefined) safe.model = patch.model || null;
  if (patch.messages !== undefined) safe.messages = cleanMessages(patch.messages);
  return db.update(COLLECTION, id, safe);
}
function remove(id) { return db.remove(COLLECTION, id); }
module.exports = { list, get, create, update, remove };
