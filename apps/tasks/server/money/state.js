// Money's JSON documents, in apps/tasks/state/money (apps/tasks/state is a symlink to ~/tars/apps/tasks/state
// on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/../..', {
  money: () => ({ labels: {}, insights: [], day: null, at: null, error: null }),
}, 'money');
