'use strict';

const settings = require('../repositories/settings');

async function getSettings(req, res, ctx, { sendJson }) {
  sendJson(res, 200, settings.get());
}

async function updateSettings(req, res, ctx, { sendJson, readJsonBody }) {
  const body = await readJsonBody(req);
  const updated = settings.update(body);
  sendJson(res, 200, updated);
}

module.exports = { getSettings, updateSettings };
