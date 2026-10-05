// tars WhatsApp bridge — READ-ONLY. Drives a WhatsApp Web session (whatsapp-web.js + the system Chromium)
// and writes every message it sees into data/state/whatsapp.json. It has no send path on purpose.
//
//   node bridge.js login    print a QR to link the PC (run from bin/whatsapp login)
//   node bridge.js run       service mode: reconnect the saved session, capture forever
//   node bridge.js status    print what's in whatsapp.json (no browser)
//
// The session lives in ~/.config/tars/whatsapp (LocalAuth). Only one process may use it at a time.
const fs = require('fs');
const os = require('os');
const path = require('path');

const TARS = path.join(__dirname, '..', '..');
const DATA = process.env.TARS_DATA || path.join(TARS, 'data');
const FILE = path.join(DATA, 'state', 'whatsapp.json');
const SESSION = path.join(os.homedir(), '.config', 'tars', 'whatsapp');
const CHROMIUM = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

const KEEP = 150;                  // messages kept per chat
const BACKFILL = 40;               // messages pulled per chat on first connect
const REAL = new Set(['chat', 'image', 'video', 'ptt', 'audio', 'document', 'sticker', 'location', 'vcard']);

const mode = process.argv[2] || 'run';
const log = (...a) => console.log(new Date().toISOString(), ...a);

// --- store ---------------------------------------------------------------
let store = { status: 'starting', me: null, updatedAt: null, chats: {} };
try { store = { ...store, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}

let writeTimer = null;
function flush() {
  writeTimer = null;
  store.updatedAt = Date.now();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(store));
  fs.renameSync(FILE + '.tmp', FILE);
}
function save(now = false) {
  if (now) { if (writeTimer) clearTimeout(writeTimer); return flush(); }
  if (!writeTimer) writeTimer = setTimeout(flush, 1000);
}
function setStatus(s) { if (store.status !== s) { store.status = s; save(true); } }

function upsertChat(chat) {
  const id = chat.id._serialized;
  const c = store.chats[id] || (store.chats[id] = { id, name: '', isGroup: false, lastAt: 0, messages: [] });
  c.name = chat.name || c.name || id.split('@')[0];
  c.isGroup = !!chat.isGroup;
  return c;
}
function addMessage(c, m) {
  if (c.messages.some(x => x.id === m.id)) return false;
  c.messages.push(m);
  c.messages.sort((a, b) => a.at - b.at);
  if (c.messages.length > KEEP) c.messages = c.messages.slice(-KEEP);
  c.lastAt = c.messages[c.messages.length - 1].at;
  return true;
}
function slim(msg, author = '') {
  return {
    id: msg.id?._serialized || String(msg.id),
    at: (msg.timestamp || Math.floor(Date.now() / 1000)) * 1000,
    fromMe: !!msg.fromMe,
    author,
    body: msg.body || '',
    type: msg.type || 'chat',
    hasMedia: !!msg.hasMedia,
  };
}

if (mode === 'status') {
  const chats = Object.values(store.chats || {});
  const total = chats.reduce((n, c) => n + (c.messages || []).length, 0);
  console.log(`status:   ${store.updatedAt ? store.status : 'not started — run: bin/whatsapp login'}`);
  console.log(`linked as: ${store.me ? `${store.me.name || ''} (${store.me.number || ''})` : '—'}`);
  console.log(`captured:  ${chats.length} chats, ${total} messages`);
  console.log(`updated:   ${store.updatedAt ? new Date(store.updatedAt).toLocaleString() : '—'}`);
  console.log(`file:      ${FILE}`);
  process.exit(0);
}

// --- client --------------------------------------------------------------
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION }),
  puppeteer: {
    headless: true,
    executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
});

async function authorName(msg, chat) {
  if (!chat.isGroup || msg.fromMe) return '';
  try { const c = await msg.getContact(); return c.pushname || c.name || c.number || ''; } catch { return ''; }
}

client.on('qr', qr => {
  setStatus('needs-login');
  if (mode === 'login') {
    qrcode.generate(qr, { small: true });
    console.log('\nWhatsApp → Settings → Linked devices → Link a device, and scan the code above.');
  } else {
    log('not linked — run `bin/whatsapp login` on the PC to scan a QR. Waiting…');
  }
});

client.on('authenticated', () => { log('authenticated'); setStatus('authenticating'); });
client.on('auth_failure', m => { log('auth failure:', m); setStatus('needs-login'); });

client.on('ready', async () => {
  log('ready — backfilling recent messages');
  try {
    store.me = { name: client.info?.pushname || '', number: client.info?.wid?.user || '' };
    const chats = await client.getChats();
    for (const chat of chats) {
      if (chat.id._serialized === 'status@broadcast') continue;
      const c = upsertChat(chat);
      let msgs = [];
      try { msgs = await chat.fetchMessages({ limit: BACKFILL }); } catch {}
      for (const m of msgs) if (REAL.has(m.type)) addMessage(c, slim(m));
    }
    setStatus('ready');
    save(true);
    log(`backfill done — ${chats.length} chats`);
  } catch (e) {
    log('backfill error:', e.message);
    setStatus('ready');
  }
});

async function capture(msg) {
  try {
    if (!REAL.has(msg.type)) return;
    const chat = await msg.getChat();
    if (chat.id._serialized === 'status@broadcast') return;
    const c = upsertChat(chat);
    if (addMessage(c, slim(msg, await authorName(msg, chat)))) save();
  } catch (e) { log('capture error:', e.message); }
}
// message_create fires for both received and self-sent messages → captures the whole conversation.
client.on('message_create', capture);

client.on('disconnected', reason => {
  log('disconnected:', reason);
  setStatus('disconnected');
  if (mode === 'run') process.exit(1);   // let systemd restart and reconnect
});

process.on('SIGINT', () => { save(true); process.exit(0); });
process.on('SIGTERM', () => { save(true); process.exit(0); });

setStatus(store.status === 'ready' ? 'connecting' : store.status);
client.initialize();
