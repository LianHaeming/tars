// This app's JSON documents, in apps/tasks/state (a symlink to ~/tars/apps/tasks/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  tasks: () => ({ projects: [], tasks: [] }),
  inbox: () => ({ candidates: [], seen: [] }),
});
