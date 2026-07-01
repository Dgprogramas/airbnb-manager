'use strict';

const express = require('express');
const reservations = require('../repositories/reservations');
const icalSync = require('../services/ical-sync');

const router = express.Router();

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
  if (!body.guestName || !body.checkinDate || !body.checkoutDate) {
    return res.status(400).json({ error: 'guestName, checkinDate e checkoutDate são obrigatórios' });
  }
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
  if (!reservations.findById(req.params.id)) {
    return res.status(404).json({ error: `Reserva #${req.params.id} não encontrada` });
  }
  res.json(reservations.update(req.params.id, req.body));
});

module.exports = router;
