// Omarchy's JSON documents, in apps/memo/state/omarchy (apps/memo/state is a symlink to ~/tars/apps/memo/state on
// the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/../..', {
  drill: () => ({ seq: 0, mem: {} }),
}, 'omarchy');
