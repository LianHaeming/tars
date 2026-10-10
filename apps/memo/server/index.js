// tars Memo server: one app for the memorisation games — Burmese (/burmese, /api/burmese*) and Omarchy (/omarchy,
// /api/omarchy*). Each game's API and data live in server/<game>/ and state/<game>/. Serves the built React app
// (web → dist/). Run: node server  (port 8410)
const path = require('path');
const { start } = require('@tars/server');
const burmese = require('./burmese');
const omarchy = require('./omarchy');

const PORT = process.env.PORT || 8410;
const DIST = path.join(__dirname, '..', 'dist');

async function api(req, res, parts, body) {
  if (parts[0] === 'burmese') return burmese.api(req, res, parts, body);
  if (parts[0] === 'omarchy') return omarchy.api(req, res, parts, body);
}

start({ port: PORT, dist: DIST, api });
burmese.warm();
