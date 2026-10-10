// Discover's JSON documents, in apps/tasks/state/discover (apps/tasks/state is a symlink to ~/tars/apps/tasks/state
// on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/../..', {
  discover: () => ({ day: null, at: null, repos: [], error: null }),
}, 'discover');
