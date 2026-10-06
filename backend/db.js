const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = config.paths.data;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Collection name must be a non-empty string');
  }
  return path.join(DATA_DIR, `${name}.json`);
}

function read(name) {
  ensureDataDir();
  const file = filePath(name);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf-8');
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    const error = new Error(`ملف البيانات ${name}.json تالف: ${err.message}`);
    error.statusCode = 500;
    throw error;
  }
}

function write(name, data) {
  ensureDataDir();
  if (!Array.isArray(data)) throw new Error('Collection data must be an array');
  const target = filePath(name);
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(temporary, target);
  return data;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const db = {
  init() {
    ensureDataDir();
    console.log(`[db] ready at: ${DATA_DIR}`);
  },

  all(name) {
    return read(name);
  },

  findById(name, id) {
    return read(name).find((item) => item.id === id) || null;
  },

  find(name, predicate) {
    if (typeof predicate !== 'function') throw new Error('predicate must be a function');
    return read(name).find(predicate) || null;
  },

  filter(name, predicate) {
    if (typeof predicate !== 'function') throw new Error('predicate must be a function');
    return read(name).filter(predicate);
  },

  insert(name, item) {
    const items = read(name);
    const now = new Date().toISOString();
    const record = {
      id: item.id || generateId(),
      createdAt: now,
      updatedAt: now,
      ...item,
    };
    items.push(record);
    write(name, items);
    return record;
  },

  update(name, id, patch) {
    const items = read(name);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const updated = {
      ...items[index],
      ...patch,
      id: items[index].id,
      updatedAt: new Date().toISOString(),
    };
    items[index] = updated;
    write(name, items);
    return updated;
  },

  remove(name, id) {
    const items = read(name);
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    write(name, filtered);
    return true;
  },
};

module.exports = db;
