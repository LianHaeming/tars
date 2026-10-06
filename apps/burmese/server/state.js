// This app's JSON documents, in apps/burmese/state (a symlink to ~/tars/apps/burmese/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  burmese: () => ({ deck: [], progress: {}, days: {}, history: [] }),
});
