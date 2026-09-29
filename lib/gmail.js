const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'secrets', 'gmail-client.json');
const TOKEN = path.join(ROOT, 'secrets', 'gmail-token.json');
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const REDIRECT = process.env.GMAIL_REDIRECT || 'https://omarchy.tail0bf266.ts.net:8790/oauth2callback';

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

function client() {
  if (!fs.existsSync(CLIENT)) throw new Error(`Missing ${CLIENT}. Save your Google OAuth client there, then run: bin/gmail auth`);
  const c = readJson(CLIENT);
  const o = c.web || c.installed || c;
  if (!o.client_id || !o.client_secret) throw new Error(`${CLIENT} has no client_id/client_secret`);
  return { id: o.client_id, secret: o.client_secret };
}

function authUrl() {
  const { id } = client();
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id, redirect_uri: REDIRECT, response_type: 'code',
    scope: SCOPE, access_type: 'offline', prompt: 'consent',
  });
}

async function tokenRequest(params) {
  const { id, secret } = client();
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('token endpoint ' + r.status + ': ' + JSON.stringify(j));
  return j;
}

async function exchangeCode(code) {
  const j = await tokenRequest({ code, redirect_uri: REDIRECT, grant_type: 'authorization_code' });
  if (!j.refresh_token) throw new Error('no refresh_token returned — re-run auth (consent must use prompt=consent)');
  fs.mkdirSync(path.dirname(TOKEN), { recursive: true });
  fs.writeFileSync(TOKEN, JSON.stringify({ refresh_token: j.refresh_token, access_token: j.access_token, expiry: Date.now() + j.expires_in * 1000 }, null, 2));
  return j;
}

let cached = null;
async function accessToken() {
  if (!fs.existsSync(TOKEN)) throw new Error('tars is not authorised with Gmail yet — run: bin/gmail auth');
  const t = cached || readJson(TOKEN);
  if (t.access_token && t.expiry && Date.now() < t.expiry - 60000) { cached = t; return t.access_token; }
  const j = await tokenRequest({ refresh_token: t.refresh_token, grant_type: 'refresh_token' });
  cached = { refresh_token: t.refresh_token, access_token: j.access_token, expiry: Date.now() + j.expires_in * 1000 };
  fs.writeFileSync(TOKEN, JSON.stringify(cached, null, 2));
  return j.access_token;
}

async function api(pathq) {
  const tok = await accessToken();
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + pathq, { headers: { authorization: 'Bearer ' + tok } });
  const j = await r.json();
  if (!r.ok) throw new Error('gmail api ' + r.status + ': ' + JSON.stringify(j));
  return j;
}

async function search(query, max = 20) {
  const p = new URLSearchParams({ maxResults: String(max) });
  if (query) p.set('q', query);
  return (await api('messages?' + p)).messages || [];
}

async function message(id, headers = ['From', 'Subject', 'Date']) {
  const p = new URLSearchParams({ format: 'metadata' });
  headers.forEach(h => p.append('metadataHeaders', h));
  const m = await api(`messages/${id}?` + p);
  const h = {};
  (m.payload?.headers || []).forEach(x => { h[x.name.toLowerCase()] = x.value; });
  return { id: m.id, snippet: m.snippet, headers: h };
}

module.exports = { authUrl, exchangeCode, accessToken, search, message, REDIRECT, CLIENT, TOKEN };
