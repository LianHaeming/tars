// This app's JSON documents, in apps/discover/state (a symlink to ~/tars/apps/discover/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  discover: () => ({ day: null, at: null, repos: [], error: null }),
});
