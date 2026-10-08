// FSRS-6 (open-spaced-repetition), day-granular: each memory keeps stability s (days until recall falls to 90%) and
// difficulty d (1–10). Grades: 1 Again, 2 Hard, 3 Good, 4 Easy. Same-day repeats use the short-term formula.
const W = [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629,
  1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542];
const DECAY = -W[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const RETENTION = 0.9;
const MAX_DAYS = 365;

const clampD = d => Math.min(10, Math.max(1, d));
const initS = g => Math.max(W[g - 1], 0.1);
const rawD = g => W[4] - Math.exp(W[5] * (g - 1)) + 1;
const initD = g => clampD(rawD(g));

const recall = (t, s) => Math.pow(1 + FACTOR * t / s, DECAY);
const interval = s => Math.min(MAX_DAYS, Math.max(1, Math.round(s / FACTOR * (Math.pow(RETENTION, 1 / DECAY) - 1))));

function nextD(d, g) {
  const damped = d + -W[6] * (g - 3) * (10 - d) / 9;
  return clampD(W[7] * rawD(4) + (1 - W[7]) * damped);
}

function nextS(d, s, t, g) {
  if (t === 0) {
    let inc = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(s, -W[19]);
    if (g >= 3) inc = Math.max(inc, 1);
    return s * inc;
  }
  const r = recall(t, s);
  if (g === 1) {
    const f = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
    return Math.min(f, s / Math.exp(W[17] * W[18]));
  }
  return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1)
    * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1));
}

// step(mem, grade, elapsedDays) → { s, d, days } — days until the next review (0 = again today).
function step(mem, g, t) {
  if (mem.s == null) {
    const s = initS(g);
    return { s, d: initD(g), days: g === 1 ? 0 : interval(s) };
  }
  const s = Math.max(0.1, nextS(mem.d, mem.s, t, g));
  return { s, d: nextD(mem.d, g), days: g === 1 ? 0 : interval(s) };
}

module.exports = { step, recall, interval };
