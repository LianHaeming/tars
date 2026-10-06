// tars WhatsApp bridge — READ-ONLY. Speaks the WhatsApp multi-device protocol directly (Baileys, no browser)
// and writes every message it sees into data/state/whatsapp.json. It has no send path on purpose.
//
//   node bridge.js login     print a QR to link the PC (run from bin/whatsapp login)
//   node bridge.js run        service mode: reconnect the saved session, capture forever
//   node bridge.js more [N]   pull older history on demand — N rounds of 50/chat (default 8), then exit
//   node bridge.js status     print what's in whatsapp.json (no connection)
//
// The session (Baileys multi-file auth) lives in ~/.config/tars/whatsapp. Only one process may use it at a time.
const fs = require('fs');
const os = require('os');
const path = require('path');

const TARS = path.join(__dirname, '..', '..');
const DATA = process.env.TARS_DATA || path.join(TARS, 'data');
const FILE = path.join(DATA, 'state', 'whatsapp.json');
const SESSION = path.join(os.homedir(), '.config', 'tars', 'whatsapp');

const KEEP = Number(process.env.WA_KEEP) || 1000;   // max messages kept per chat (raise to go deeper)
const mode = process.argv[2] || 'run';
const wait = ms => new Promise(r => setTimeout(r, ms));
let relinks = 0;                   // guard self-heal loops when the saved session is stale
const log = (...a) => console.log(new Date().toISOString(), ...a);
const numberOf = jid => (jid || '').split('@')[0].split(':')[0];
function tsMs(t) {
  const s = typeof t === 'number' ? t : (t?.toNumber?.() ?? Number(t));
  return (s && !Number.isNaN(s) ? s : Math.floor(Date.now() / 1000)) * 1000;
}

// --- store ---------------------------------------------------------------
let store = { status: 'starting', me: null, updatedAt: null, chats: {} };
try { store = { ...store, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch {}
const contacts = {};               // jid -> display name (not persisted; rebuilt each run)
const groupNames = {};             // group jid -> subject

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

function addMessage(c, m) {
  if (!m.id || c.messages.some(x => x.id === m.id)) return false;
  c.messages.push(m);
  c.messages.sort((a, b) => a.at - b.at);
  if (c.messages.length > KEEP) c.messages = c.messages.slice(-KEEP);
  c.lastAt = c.messages[c.messages.length - 1].at;
  return true;
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

// --- message content -----------------------------------------------------
// WhatsApp messages are a union; pull out a type + any text, flag media, skip non-messages (reactions, receipts…).
function content(message) {
  if (!message) return null;
  const m = message.ephemeralMessage?.message || message.viewOnceMessage?.message
    || message.viewOnceMessageV2?.message || message.documentWithCaptionMessage?.message || message;
  if (m.conversation) return { type: 'chat', body: m.conversation };
  if (m.extendedTextMessage) return { type: 'chat', body: m.extendedTextMessage.text || '' };
  if (m.imageMessage) return { type: 'image', body: m.imageMessage.caption || '', hasMedia: true };
  if (m.videoMessage) return { type: 'video', body: m.videoMessage.caption || '', hasMedia: true };
  if (m.audioMessage) return { type: m.audioMessage.ptt ? 'ptt' : 'audio', body: '', hasMedia: true };
  if (m.documentMessage) return { type: 'document', body: m.documentMessage.caption || m.documentMessage.fileName || '', hasMedia: true };
  if (m.stickerMessage) return { type: 'sticker', body: '', hasMedia: true };
  if (m.locationMessage || m.liveLocationMessage) return { type: 'location', body: '', hasMedia: true };
  if (m.contactMessage || m.contactsArrayMessage) return { type: 'vcard', body: m.contactMessage?.displayName || '', hasMedia: true };
  return null;
}

function chatOf(jid, isGroup) {
  const c = store.chats[jid] || (store.chats[jid] = { id: jid, name: '', isGroup, lastAt: 0, messages: [] });
  c.isGroup = isGroup;
  const better = isGroup ? groupNames[jid] : contacts[jid];
  if (better && better !== c.name) c.name = better;
  if (!c.name) c.name = numberOf(jid);
  return c;
}

function record(waMsg) {
  const key = waMsg?.key || {};
  const jid = key.remoteJid;
  if (!jid || jid.endsWith('@broadcast') || jid.endsWith('@newsletter')) return false;
  const c = content(waMsg.message);
  if (!c) return false;
  const isGroup = jid.endsWith('@g.us');
  if (!key.fromMe && !isGroup && waMsg.pushName && !contacts[jid]) contacts[jid] = waMsg.pushName;
  const chat = chatOf(jid, isGroup);
  const author = isGroup && !key.fromMe
    ? (waMsg.pushName || contacts[key.participant] || numberOf(key.participant)) : '';
  return addMessage(chat, {
    id: key.id, at: tsMs(waMsg.messageTimestamp), fromMe: !!key.fromMe,
    author, body: c.body || '', type: c.type, hasMedia: !!c.hasMedia,
  });
}

function learnContacts(list) {
  for (const c of list || []) {
    const name = c.name || c.notify || c.verifiedName;
    if (c.id && name) contacts[c.id] = name;
  }
}
function learnChats(list) {
  for (const c of list || []) if (c.id?.endsWith('@g.us') && c.name) groupNames[c.id] = c.name;
}

// --- connection ----------------------------------------------------------
const {
  default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore, DisconnectReason, Browsers,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const logger = pino({ level: 'silent' });

async function resolveGroups(sock) {
  for (const c of Object.values(store.chats)) {
    if (!c.isGroup || (c.name && c.name !== numberOf(c.id))) continue;
    try { const meta = await sock.groupMetadata(c.id); if (meta?.subject) { groupNames[c.id] = meta.subject; c.name = meta.subject; } }
    catch {}
  }
  save();
}

// On-demand backfill: ask WhatsApp for messages older than each chat's current oldest, round by round.
// Replies arrive on 'messaging-history.set' and flow through record(); a chat that returns nothing is retired.
async function deepen(sock, rounds) {
  const PER = 50;
  const done = new Set();
  const all = () => Object.values(store.chats);
  const count = () => all().reduce((n, c) => n + c.messages.length, 0);
  log(`deepening: ${all().length} chats, ${count()} messages now, up to ${rounds} rounds (cap ${KEEP}/chat)`);
  for (let r = 1; r <= rounds; r++) {
    let progressed = 0;
    for (const c of all()) {
      if (done.has(c.id) || !c.messages.length || c.messages.length >= KEEP) { done.add(c.id); continue; }
      const oldest = c.messages[0];
      try { await sock.fetchMessageHistory(PER, { remoteJid: c.id, id: oldest.id, fromMe: oldest.fromMe }, Math.floor(oldest.at / 1000)); }
      catch { done.add(c.id); continue; }
      await wait(3000);
      if (c.messages[0].at < oldest.at) progressed++; else done.add(c.id);
    }
    save(true);
    log(`round ${r}: ${count()} messages, ${done.size}/${all().length} chats exhausted`);
    if (!progressed || done.size >= all().length) break;
  }
  log(`deepen done: ${count()} messages total`);
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser: Browsers.ubuntu('tars'),
    markOnlineOnConnect: false,   // don't take presence/notifications away from the phone
    syncFullHistory: true,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async u => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      setStatus('needs-login');
      if (mode === 'login') { qrcode.generate(qr, { small: true }); console.log('\nWhatsApp → Settings → Linked devices → Link a device, and scan the code above.'); }
      else log('not linked — run `bin/whatsapp login` on the PC to scan a QR. Waiting…');
    }
    if (connection === 'open') {
      store.me = { name: sock.user?.name || sock.user?.verifiedName || '', number: numberOf(sock.user?.id) };
      setStatus('ready');
      log('connected as', store.me.name || store.me.number);
      if (mode === 'more') {
        try { await resolveGroups(sock); } catch {}
        const rounds = Number(process.argv[3]) || 8;
        try { await deepen(sock, rounds); } catch (e) { log('deepen error:', e.message); }
        save(true);
        return process.exit(0);
      }
      setTimeout(() => resolveGroups(sock).catch(() => {}), 8000);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      save(true);
      try { sock.ev.removeAllListeners(); sock.end?.(undefined); } catch {}   // drop the old socket before reconnecting
      if (mode === 'more') return process.exit(0);   // one-shot; don't reconnect mid-backfill
      const again = () => setTimeout(() => start().catch(e => { log('reconnect failed:', e.message); process.exit(1); }), 1000);
      if (code === DisconnectReason.loggedOut) {
        setStatus('needs-login');
        // While linking, a logged-out close means the saved keys are stale (expired/aborted QR):
        // wipe them and come back with a fresh QR instead of giving up.
        if (mode === 'login' && relinks < 3) {
          relinks++;
          log('clearing a stale session and showing a fresh QR…');
          fs.rmSync(SESSION, { recursive: true, force: true });
          return again();
        }
        log('logged out — run `bin/whatsapp login` to re-link');
        return process.exit(0);    // in service mode, wait for a manual re-link
      }
      // 515 (restartRequired, normal right after pairing) or a transient drop — reconnect in both modes.
      log('connection closed, reconnecting…', code || '');
      setStatus('connecting');
      again();
    }
  });

  sock.ev.on('messaging-history.set', ({ chats, contacts: cs, messages }) => {
    learnContacts(cs); learnChats(chats);
    let n = 0; for (const m of messages || []) if (record(m)) n++;
    if (n) log(`history: +${n} messages`);
    save();
  });
  sock.ev.on('contacts.upsert', learnContacts);
  sock.ev.on('contacts.update', learnContacts);
  sock.ev.on('chats.upsert', learnChats);
  sock.ev.on('messages.upsert', ({ messages }) => {
    let n = 0; for (const m of messages || []) if (record(m)) n++;
    if (n) save();
  });
}

process.on('SIGINT', () => { save(true); process.exit(0); });
process.on('SIGTERM', () => { save(true); process.exit(0); });

setStatus(store.status === 'ready' ? 'connecting' : store.status);
start().catch(e => { log('start failed:', e.message); process.exit(1); });
