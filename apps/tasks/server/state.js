// This app's JSON documents, in apps/tasks/state (a symlink to ~/tars/apps/tasks/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  tasks: () => ({ projects: [], tasks: [] }),
  food: () => ({ basket: [], shop: '', servings: {} }),
  burmese: () => ({ deck: [], progress: {}, days: {}, history: [] }),
  inbox: () => ({ candidates: [], seen: [] }),
  money: () => ({ labels: {}, insights: [], day: null, at: null, error: null }),
  discover: () => ({ day: null, at: null, repos: [], error: null }),
});
