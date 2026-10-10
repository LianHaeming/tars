// Burmese's JSON documents, in apps/memo/state/burmese (apps/memo/state is a symlink to ~/tars/apps/memo/state on
// the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/../..', {
  burmese: () => ({ memories: {}, custom: [], units: 0 }),
  words: () => ({ seq: 0, mem: {} }),
}, 'burmese');
