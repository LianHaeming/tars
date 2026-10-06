// JSON documents in an app's state folder: each is read once, kept in memory and written atomically on change.
// Each file has exactly one owner app — another app changes it through the owner's API, never by opening the file.
const fs = require('fs');
const path = require('path');

function doc(dir, name, empty) {
  const file = path.join(dir, name + '.json');
  let value = empty();
  try { value = { ...value, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  return {
    get: () => value,
    save() {
      fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2));
      fs.renameSync(file + '.tmp', file);
    },
  };
}

// docs(appDir, { name: () => emptyValue }) → { STATE, name: doc, … }. State lives in <appDir>/state (TARS_STATE overrides).
function docs(appDir, shapes) {
  const STATE = process.env.TARS_STATE || path.join(appDir, 'state');
  fs.mkdirSync(STATE, { recursive: true });
  return { STATE, ...Object.fromEntries(Object.entries(shapes).map(([name, empty]) => [name, doc(STATE, name, empty)])) };
}

module.exports = { docs };
