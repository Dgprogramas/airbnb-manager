'use strict';

const reservations = require('../repositories/reservations');

async function listReservations(req, res, { query }, { sendJson }) {
  const result = reservations.list({
    month: query.get('month') || undefined,
    pendingOnly: query.get('pendingOnly') === 'true',
  });
  sendJson(res, 200, result);
}

async function createReservation(req, res, ctx, { sendJson, readJsonBody }) {
  const body = await readJsonBody(req);
  if (!body.guestName || !body.checkinDate || !body.checkoutDate) {
    return sendJson(res, 400, { error: 'guestName, checkinDate e checkoutDate são obrigatórios' });
  }
  const created = reservations.create(body);
  sendJson(res, 201, created);
}

async function updateReservation(req, res, { params }, { sendJson, readJsonBody }) {
  const body = await readJsonBody(req);
  const updated = reservations.update(params.id, body);
  sendJson(res, 200, updated);
}

module.exports = { listReservations, createReservation, updateReservation };
