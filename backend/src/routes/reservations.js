'use strict';

const express = require('express');
const reservations = require('../repositories/reservations');
const icalSync = require('../services/ical-sync');
const { isIsoDate, isNonNegativeAmount, isNonEmptyString } = require('../validation');

const router = express.Router();

const STATUSES = ['pending', 'complete'];

// Valida os campos de uma reserva (já mesclada com a existente, no caso do
// PATCH). Retorna a mensagem de erro ou null se estiver tudo certo.
function validateReservation({ guestName, checkinDate, checkoutDate, grossAmount, status }) {
  if (!isNonEmptyString(guestName)) return 'guestName é obrigatório';
  if (!isIsoDate(checkinDate)) return `checkinDate inválida: "${checkinDate}". Use YYYY-MM-DD`;
  if (!isIsoDate(checkoutDate)) return `checkoutDate inválida: "${checkoutDate}". Use YYYY-MM-DD`;
  if (checkoutDate <= checkinDate) return 'checkoutDate deve ser posterior a checkinDate';
  if (grossAmount !== undefined && !isNonNegativeAmount(grossAmount)) {
    return `grossAmount inválido: "${grossAmount}". Use um número >= 0`;
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return `status inválido: "${status}". Use um de: ${STATUSES.join(', ')}`;
  }
  return null;
}

// GET /api/reservations?month=YYYY-MM&pendingOnly=true
router.get('/', (req, res) => {
  const result = reservations.list({
    month: req.query.month || undefined,
    pendingOnly: req.query.pendingOnly === 'true',
  });
  res.json(result);
});

// POST /api/reservations
router.post('/', (req, res) => {
  const body = req.body;
  const error = validateReservation(body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(reservations.create(body));
});

// POST /api/reservations/sync — importa reservas do iCal do Airbnb
router.post('/sync', async (req, res, next) => {
  try {
    const result = await icalSync.syncFromIcal({ icalUrl: req.body.icalUrl });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations/:id
router.get('/:id', (req, res) => {
  const reservation = reservations.findById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ error: `Reserva #${req.params.id} não encontrada` });
  }
  res.json(reservation);
});

// PATCH /api/reservations/:id
router.patch('/:id', (req, res) => {
  const existing = reservations.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: `Reserva #${req.params.id} não encontrada` });
  }
  // Valida a visão final (existente + patch), para pegar casos como
  // "só mudei o check-out e ele ficou antes do check-in".
  const merged = { ...existing, ...req.body };
  const error = validateReservation(merged);
  if (error) return res.status(400).json({ error });
  res.json(reservations.update(req.params.id, req.body));
});

// DELETE /api/reservations/:id
router.delete('/:id', (req, res) => {
  if (!reservations.findById(req.params.id)) {
    return res.status(404).json({ error: `Reserva #${req.params.id} não encontrada` });
  }
  reservations.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
