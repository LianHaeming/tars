// This app's JSON documents, in apps/food/state (a symlink to ~/tars/apps/food/state on the live checkout).
const { docs } = require('@tars/server');

module.exports = docs(__dirname + '/..', {
  food: () => ({ basket: [], shop: '', servings: {} }),
});
