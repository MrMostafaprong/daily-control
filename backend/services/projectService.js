const path = require('path');
const db = require('../db');
const projectScanner = require('../utils/projectScanner');
const fs = require('fs');
const { assertRealPathInside } = require('../utils/pathGuard');

const COLLECTION = 'projects';

function listProjects() {
  return db.all(COLLECTION);
}

function discoverProjects() {
  const added = new Set(db.all(COLLECTION).map((p) => p.path).filter(Boolean));
  return require('../utils/projectDiscovery').discover().map((p) => ({ ...p, added: added.has(p.path) }));
}

function getProject(id) {
  return db.findById(COLLECTION, id);
}

function createProject({ name, path: projectPath, description }) {
  if (typeof name !== 'string' || !name.trim()) {
    throw createError(400, 'name is required');
  }
  const safePath = projectPath ? validateProjectPath(projectPath) : null;
  return db.insert(COLLECTION, {
    name: name.trim().slice(0, 160),
    path: safePath,
    description: description || '',
    lastScan: null,
    stack: null,
  });
}

function updateProject(id, patch) {
  const safe = {};
  if (patch.name !== undefined) {
    if (typeof patch.name !== 'string' || !patch.name.trim()) throw createError(400, 'name must be a non-empty string');
    safe.name = patch.name.trim().slice(0, 160);
  }
  if (patch.description !== undefined) safe.description = String(patch.description).slice(0, 2000);
  if (patch.path !== undefined) safe.path = patch.path ? validateProjectPath(patch.path) : null;
  return db.update(COLLECTION, id, safe);
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim()) throw createError(400, 'path must be a non-empty string');
  const resolved = path.resolve(projectPath.trim());
  if (!fs.existsSync(resolved)) throw createError(400, 'Project path does not exist');
  if (!fs.statSync(resolved).isDirectory()) throw createError(400, 'Project path must be a directory');
  return assertRealPathInside(resolved, resolved);
}

function removeProject(id) {
  return db.remove(COLLECTION, id);
}

async function scanProject(id) {
  const project = db.findById(COLLECTION, id);
  if (!project) return null;
  if (!project.path) throw new Error('Project has no path set');
  const result = await projectScanner.scan(project.path);
  const updated = db.update(COLLECTION, id, {
    lastScan: new Date().toISOString(),
    stack: result.stack,
    fileCount: result.fileCount,
    totalSize: result.totalSize,
  });
  return { project: updated, ...result };
}

async function getProjectTree(id) {
  const project = db.findById(COLLECTION, id);
  if (!project) return null;
  if (!project.path) throw new Error('Project has no path set');
  return projectScanner.tree(project.path);
}

module.exports = {
  listProjects,
  discoverProjects,
  getProject,
  createProject,
  updateProject,
  removeProject,
  scanProject,
  getProjectTree,
};
