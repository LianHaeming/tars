// This app's JSON documents, in apps/money/state (a symlink to ~/tars/apps/money/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  money: () => ({ labels: {}, insights: [], day: null, at: null, error: null }),
});
