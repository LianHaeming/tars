const { execFile } = require('child_process');
const path = require('path');

const MONZO = path.join(__dirname, '..', '..', 'bin', 'monzo');
const FRESH_MS = 2 * 60 * 1000;
let cached = null;
let inflight = null;

function load() {
  return inflight ??= new Promise((resolve, reject) => {
    execFile(MONZO, ['json'], { timeout: 60000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      inflight = null;
      if (err) return reject(new Error((stderr || err.message).trim()));
      try { cached = JSON.parse(stdout); resolve(cached); } catch (e) { reject(e); }
    });
  });
}

async function money(force) {
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return cached;
  return load();
}

module.exports = { money };
