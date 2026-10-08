const sessions = require('../services/sessionService');
const { asyncHandler, createError } = require('../middleware');
const list = asyncHandler((req, res) => res.json({ sessions: sessions.list() }));
const get = asyncHandler((req, res) => { const session = sessions.get(req.params.id); if (!session) throw createError(404, 'Session not found'); res.json({ session }); });
const create = asyncHandler((req, res) => res.status(201).json({ session: sessions.create(req.body || {}) }));
const update = asyncHandler((req, res) => { const session = sessions.update(req.params.id, req.body || {}); if (!session) throw createError(404, 'Session not found'); res.json({ session }); });
const remove = asyncHandler((req, res) => { if (!sessions.remove(req.params.id)) throw createError(404, 'Session not found'); res.status(204).end(); });
module.exports = { list, get, create, update, remove };
