// tars Food server: the only code that reads or writes apps/food/state. Serves /api/food (basket, shop, servings),
// /api/food/suggest, /api/shopping (handed to the tasks app, which owns the Shopping list), the food content under
// /data/food/ and the built React app. Run: node server  (port 8408)
const path = require('path');
const { TARS, callApp, send, start } = require('@tars/server');
const store = require('./state');
const { suggest } = require('./recipe');

const PORT = process.env.PORT || 8408;
const DIST = path.join(__dirname, '..', 'dist');
const FOOD = path.join(TARS, 'data', 'food');

async function api(req, res, [resource, rid], body) {
  if (resource === 'shopping' && req.method === 'POST') {
    try { return send(res, 200, await callApp('tasks', 'POST', 'shopping', { items: body.items })); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }
  if (resource !== 'food') return;
  if (req.method === 'POST' && rid === 'suggest') {
    try { return send(res, 200, await suggest(body.id, body.dislike)); }
    catch (e) { return send(res, 502, { error: e.message }); }
  }
  const food = store.food.get();
  if (req.method === 'GET') return send(res, 200, food);
  if (req.method === 'PATCH') {
    if (Array.isArray(body.basket)) food.basket = [...new Set(body.basket.filter(x => typeof x === 'string'))];
    if (typeof body.shop === 'string') food.shop = body.shop;
    if (body.servings && typeof body.servings === 'object') {
      food.servings = Object.fromEntries(Object.entries({ ...food.servings, ...body.servings })
        .filter(([, v]) => typeof v === 'number' && v > 0 && v <= 20 && v !== 2));
    }
    store.food.save();
    return send(res, 200, food);
  }
}

start({ port: PORT, dist: DIST, api, statics: [{ prefix: '/data/food/', dir: FOOD }] });
