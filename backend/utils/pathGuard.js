const path = require('path');
const fs = require('fs');

function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget === resolvedRoot) return true;
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : resolvedRoot + path.sep;
  return resolvedTarget.startsWith(rootWithSep);
}

function resolveSafe(root, filePath) {
  if (!root || typeof root !== 'string') throw createError(500, 'root is required');
  if (!filePath || typeof filePath !== 'string') throw createError(400, 'path is required');
  if (filePath.includes('\0')) throw createError(400, 'path must not contain null bytes');

  const resolved = path.resolve(root, filePath);
  if (!isInside(root, resolved)) {
    throw createError(403, 'Path is outside the allowed root');
  }
  return resolved;
}

function assertRealPathInside(root, target) {
  const resolvedRoot = fs.realpathSync(root);
  const resolvedTarget = fs.realpathSync(target);
  if (!isInside(resolvedRoot, resolvedTarget)) {
    throw createError(403, 'Path is outside the allowed root');
  }
  return resolvedTarget;
}

function assertExists(target, { type } = {}) {
  if (!fs.existsSync(target)) {
    throw createError(404, `Path does not exist: ${target}`);
  }
  if (type === 'file' || type === 'dir') {
    const stat = fs.statSync(target);
    if (type === 'file' && !stat.isFile()) {
      throw createError(400, `Not a file: ${target}`);
    }
    if (type === 'dir' && !stat.isDirectory()) {
      throw createError(400, `Not a directory: ${target}`);
    }
  }
  return target;
}

module.exports = {
  isInside,
  resolveSafe,
  assertRealPathInside,
  assertExists,
};
