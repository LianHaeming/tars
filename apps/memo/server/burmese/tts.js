// Spoken Burmese: MP3s from Meta's open MMS-TTS Burmese voice, run locally by tts_mms.py in the venv that
// `bin/burmese tts-install` makes. Each clip is made once, on first play, and kept in state/audio/ under a hash of its
// text and speed, so editing a sentence's Burmese makes a fresh clip. One worker process, one job at a time; it
// exits after 5 idle minutes (the model holds ~850 MB) and the next new clip restarts it.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawn } = require('child_process');
const { STATE } = require('./state');

const DIR = path.join(STATE, 'audio');
const VENV = path.join(process.env.HOME, '.local/share/tars/mms-tts');
const PY = path.join(VENV, 'bin/python');
const RATES = { normal: 1.0, slow: 0.7 };

const IDLE = 5 * 60e3;

let worker = null;
let queue = Promise.resolve();
let idle = null;

function startWorker() {
  if (!fs.existsSync(PY)) throw new Error('Burmese voice not installed (run bin/burmese tts-install)');
  const p = spawn(PY, [path.join(__dirname, 'tts_mms.py')], {
    env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_VERBOSITY: 'error', PYTHONWARNINGS: 'ignore' }, stdio: ['pipe', 'pipe', 'inherit'],
  });
  const waiting = [];
  const ready = new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  readline.createInterface({ input: p.stdout }).on('line', line => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const w = waiting.shift();
    if (w) msg.error ? w.reject(new Error(msg.error)) : w.resolve(msg);
  });
  p.on('exit', code => {
    console.error('tts worker exited', code);
    if (worker?.p === p) worker = null;
    for (const w of waiting.splice(0)) w.reject(new Error('Burmese voice stopped'));
  });
  worker = {
    p,
    ready,
    run: job => new Promise((resolve, reject) => { waiting.push({ resolve, reject }); p.stdin.write(JSON.stringify(job) + '\n'); }),
  };
  return worker;
}

// clip(text, speed) — the MP3 path for this Burmese text, made first if needed.
function clip(text, speed = 'normal') {
  const rate = RATES[speed] || RATES.normal;
  const file = path.join(DIR, crypto.createHash('sha1').update(`mms|${rate}|${text}`).digest('hex').slice(0, 16) + '.mp3');
  if (fs.existsSync(file)) return Promise.resolve(file);
  const job = queue.then(async () => {
    if (fs.existsSync(file)) return file;
    fs.mkdirSync(DIR, { recursive: true });
    const w = worker || startWorker();
    await w.ready;
    const tmp = file.replace(/\.mp3$/, '.tmp.mp3');
    await w.run({ text, out: tmp, rate });
    fs.renameSync(tmp, file);
    clearTimeout(idle);
    idle = setTimeout(() => worker?.p.kill(), IDLE);
    return file;
  });
  queue = job.catch(() => {});
  return job;
}

module.exports = { clip, PY };
