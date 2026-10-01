// JSON documents in data/state/: each is read once, kept in memory and written atomically on change.
const fs = require('fs');
const path = require('path');

const TARS = path.join(__dirname, '..', '..');
const DATA = process.env.TARS_DATA || path.join(TARS, 'data');
const STATE = path.join(DATA, 'state');
fs.mkdirSync(STATE, { recursive: true });

function doc(name, empty) {
  const file = path.join(STATE, name + '.json');
  let value = empty();
  try { value = { ...value, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  return {
    get: () => value,
    save() {
      fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
      fs.renameSync(file + '.tmp', file);
    },
  };
}

module.exports = {
  TARS,
  DATA,
  tasks: doc('tasks', () => ({ projects: [], tasks: [] })),
  food: doc('food', () => ({ basket: [], shop: '' })),
  chat: doc('chat', () => ({ messages: [], sessionId: null })),
  burmese: doc('burmese', () => ({ phrases: [], index: 0, lastDay: null })),
};
