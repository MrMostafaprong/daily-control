const rootSession = require('../services/rootSession');
const { asyncHandler, createError } = require('../middleware');

const getStatus = asyncHandler(async (req, res) => {
  res.json({ root: rootSession.status() });
});

const unlock = asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  if (!password) throw createError(400, 'password is required');
  const session = rootSession.unlock(password);
  res.json({ ok: true, ...session });
});

const lock = asyncHandler(async (req, res) => {
  const token = rootSession.extractToken(req);
  rootSession.lock(token);
  res.json({ ok: true });
});

const verify = asyncHandler(async (req, res) => {
  const token = rootSession.extractToken(req);
  res.json({ valid: rootSession.isValid(token) });
});

module.exports = { getStatus, unlock, lock, verify };
