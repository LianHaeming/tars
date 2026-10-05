// Read-only view over data/state/whatsapp.json (written by app/whatsapp/bridge.js, a separate service).
// The bridge owns the file; the server only reads it, re-reading when its mtime changes.
const fs = require('fs');
const path = require('path');
const { DATA } = require('./store');

const FILE = path.join(DATA, 'state', 'whatsapp.json');
let cache = null, mtime = 0;

function raw() {
  try {
    const stat = fs.statSync(FILE);
    if (stat.mtimeMs !== mtime) { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')); mtime = stat.mtimeMs; }
    return cache;
  } catch { return null; }
}

const meta = d => ({ status: d?.status || 'offline', me: d?.me || null, updatedAt: d?.updatedAt || null });

// Conversation list: one row per chat, newest first, with just the last message as a preview.
function list() {
  const d = raw();
  if (!d) return { ...meta(null), chats: [] };
  const chats = Object.values(d.chats || {})
    .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0))
    .map(c => ({
      id: c.id, name: c.name, isGroup: !!c.isGroup, lastAt: c.lastAt || 0,
      last: (c.messages || [])[c.messages.length - 1] || null,
    }));
  return { ...meta(d), chats };
}

// Full thread for one chat.
function thread(id) {
  const d = raw();
  const c = d && d.chats && d.chats[id];
  if (!c) return null;
  return { id: c.id, name: c.name, isGroup: !!c.isGroup, messages: c.messages || [] };
}

module.exports = { list, thread };
