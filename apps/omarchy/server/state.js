// This app's JSON documents, in apps/omarchy/state (a symlink to ~/tars/apps/omarchy/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  drill: () => ({ seq: 0, mem: {} }),
});
