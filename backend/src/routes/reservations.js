'use strict';

const express = require('express');
const reservations = require('../repositories/reservations');
const icalSync = require('../services/ical-sync');
const csvImport = require('../services/airbnb-csv-import');
const { registerGuest, CondoRpaError } = require('../services/condo-rpa');
const { isIsoDate, isNonNegativeAmount, isNonEmptyString, isTime } = require('../validation');

const router = express.Router();

// Trava em memória: o portal do condomínio não suporta bem duas sessões de
// automação rodando ao mesmo tempo, então bloqueia cadastros concorrentes
// para a mesma reserva.
const registerCondoLocks = new Set();

const STATUSES = ['pending', 'complete'];

// Valida os campos de uma reserva (já mesclada com a existente, no caso do
// PATCH). Retorna a mensagem de erro ou null se estiver tudo certo.
function validateReservation({
  guestName,
  guestDocument,
  checkinDate,
  checkoutDate,
  checkinTime,
  checkoutTime,
  grossAmount,
  status,
}) {
  if (!isNonEmptyString(guestName)) return 'guestName é obrigatório';
  if (guestDocument !== undefined && typeof guestDocument !== 'string') {
    return 'guestDocument deve ser um texto';
  }
  if (!isIsoDate(checkinDate)) return `checkinDate inválida: "${checkinDate}". Use YYYY-MM-DD`;
  if (!isIsoDate(checkoutDate)) return `checkoutDate inválida: "${checkoutDate}". Use YYYY-MM-DD`;
  if (checkoutDate <= checkinDate) return 'checkoutDate deve ser posterior a checkinDate';
  if (checkinTime !== undefined && !isTime(checkinTime)) {
    return `checkinTime inválido: "${checkinTime}". Use HH:MM`;
  }
  if (checkoutTime !== undefined && !isTime(checkoutTime)) {
    return `checkoutTime inválido: "${checkoutTime}". Use HH:MM`;
  }
  if (grossAmount !== undefined && !isNonNegativeAmount(grossAmount)) {
    return `grossAmount inválido: "${grossAmount}". Use um número >= 0`;
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return `status inválido: "${status}". Use um de: ${STATUSES.join(', ')}`;
  }
  return null;
}

// GET /api/reservations?month=YYYY-MM&year=YYYY&pendingOnly=true
router.get('/', (req, res) => {
  const result = reservations.list({
    month: req.query.month || undefined,
    year: req.query.year || undefined,
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

// POST /api/reservations/import-csv — importa o relatório de ganhos do Airbnb
// (CSV exportado em Pagamentos → Relatórios). Completa reservas pendentes com
// nome/valor e cria as que não existem (inclusive passadas, que o iCal não traz).
router.post('/import-csv', (req, res, next) => {
  try {
    res.json(csvImport.importFromCsv(req.body.csv));
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

// POST /api/reservations/:id/register-condo — dispara o RPA (Playwright) que
// cadastra o hóspede como "Autorização" no portal do Condomínio Dedicado.
router.post('/:id/register-condo', async (req, res, next) => {
  const id = req.params.id;
  const reservation = reservations.findById(id);
  if (!reservation) {
    return res.status(404).json({ error: `Reserva #${id} não encontrada` });
  }
  if (!reservation.guestDocument) {
    return res
      .status(400)
      .json({ error: 'Falta o RG do hóspede — complete a reserva antes de cadastrar no condomínio' });
  }
  if (!reservation.checkinTime || !reservation.checkoutTime) {
    return res
      .status(400)
      .json({ error: 'Faltam os horários de check-in/check-out — complete a reserva antes de cadastrar no condomínio' });
  }
  if (reservation.condoRegistered) {
    return res.status(400).json({ error: 'Esta reserva já está cadastrada no condomínio' });
  }
  if (registerCondoLocks.has(id)) {
    return res.status(409).json({ error: 'Já existe um cadastro em andamento para esta reserva' });
  }

  registerCondoLocks.add(id);
  try {
    await registerGuest({
      guestName: reservation.guestName,
      guestDocument: reservation.guestDocument,
      checkinDate: reservation.checkinDate,
      checkoutDate: reservation.checkoutDate,
      checkinTime: reservation.checkinTime,
      checkoutTime: reservation.checkoutTime,
      vehicleModel: req.body.vehicleModel,
      vehiclePlate: req.body.vehiclePlate,
      vehicleColor: req.body.vehicleColor,
    });
    res.json(reservations.update(id, { condoRegistered: true }));
  } catch (err) {
    if (err instanceof CondoRpaError) {
      // Erro de configuração (credencial/RG ausente) é culpa do request/ambiente
      // → 400; qualquer outra fase é o portal externo falhando → 502. A fase vai
      // no corpo pra UI poder orientar melhor o usuário.
      const status = err.phase === 'config' ? 400 : 502;
      return res.status(status).json({ error: err.message, phase: err.phase });
    }
    next(err);
  } finally {
    registerCondoLocks.delete(id);
  }
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
