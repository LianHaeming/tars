// Shared helper for shelling out to the `claude` CLI from the tars folder. ask.js streams the reply;
// burmese.js buffers whole batches — both get the same spawn + timeout + stderr-tail error handling here.
const { spawn } = require('child_process');
const { TARS } = require('./store');

const DEFAULT_TIMEOUT = 180e3;

// Last non-empty stderr line, else a generic message, capped so we never dump a wall of text at a caller.
const claudeError = (code, errText, max = 300) =>
  (errText.trim().split('\n').filter(Boolean).pop() || `claude exited with ${code}`).slice(0, max);

// Spawns `claude <args>` in the tars folder, captures stderr and arms a timeout. The caller owns stdout
// (streamed or buffered) and the close handler; `clear()` stops the timer, `error(code)` builds the message.
function spawnClaude(args, { timeout = DEFAULT_TIMEOUT, onTimeout } = {}) {
  const child = spawn('claude', args, { cwd: TARS, stdio: ['ignore', 'pipe', 'pipe'] });
  let errText = '';
  child.stderr.on('data', x => { errText += x; });
  const timer = setTimeout(() => { onTimeout?.(); child.kill(); }, timeout);
  return { child, clear: () => clearTimeout(timer), error: code => claudeError(code, errText) };
}

// Buffers the whole reply and resolves stdout; rejects on timeout, spawn error or non-zero exit.
function runClaude(args, opts = {}) {
  return new Promise((resolve, reject) => {
    const { child, clear, error } = spawnClaude(args, { ...opts, onTimeout: () => reject(new Error('claude timed out')) });
    let out = '';
    child.stdout.on('data', c => { out += c; });
    child.on('error', e => { clear(); reject(e); });
    child.on('close', code => { clear(); code ? reject(new Error(error(code))) : resolve(out); });
  });
}

module.exports = { spawnClaude, runClaude };
