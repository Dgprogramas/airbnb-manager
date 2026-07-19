'use strict';

// Banco em memória: precisa ser definido ANTES de qualquer require que toque o DB.
process.env.AIRBNB_DB_PATH = ':memory:';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../src/db/connection');
const reservations = require('../src/repositories/reservations');

beforeEach(() => {
  getDb().exec('DELETE FROM reservations;');
});

function createSample(overrides = {}) {
  return reservations.create({
    guestName: 'Hóspede Teste',
    checkinDate: '2026-07-10',
    checkoutDate: '2026-07-15',
    grossAmount: 750,
    ...overrides,
  });
}

test('create + findById fazem o round-trip com camelCase', () => {
  const created = createSample();
  const found = reservations.findById(created.id);

  assert.equal(found.guestName, 'Hóspede Teste');
  assert.equal(found.checkinDate, '2026-07-10');
  assert.equal(found.grossAmount, 750);
  assert.equal(found.status, 'complete');
  assert.equal(found.source, 'manual');
  assert.equal(found.cancelledAt, null);

  // Campos do cadastro no condomínio: defaults quando não informados
  assert.equal(found.guestDocument, '');
  assert.equal(found.checkinTime, '14:00');
  assert.equal(found.checkoutTime, '11:00');
});

test('create aceita documento e horários informados', () => {
  const created = createSample({
    guestDocument: '12.345.678-9',
    checkinTime: '15:30',
    checkoutTime: '10:00',
  });

  assert.equal(created.guestDocument, '12.345.678-9');
  assert.equal(created.checkinTime, '15:30');
  assert.equal(created.checkoutTime, '10:00');
});

test('list filtra por mês do check-in e por pendência', () => {
  createSample({ checkinDate: '2026-07-01', checkoutDate: '2026-07-03' });
  createSample({ checkinDate: '2026-08-01', checkoutDate: '2026-08-03', status: 'pending' });

  assert.equal(reservations.list({ month: '2026-07' }).length, 1);
  assert.equal(reservations.list({ month: '2026-08' }).length, 1);
  assert.equal(reservations.list({ pendingOnly: true }).length, 1);
  assert.equal(reservations.list().length, 2);
});

test('list filtra por ano do check-in, sem misturar outros anos', () => {
  createSample({ checkinDate: '2025-12-30', checkoutDate: '2026-01-02' });
  createSample({ checkinDate: '2026-07-01', checkoutDate: '2026-07-03' });
  createSample({ checkinDate: '2027-01-05', checkoutDate: '2027-01-07' });

  assert.equal(reservations.list({ year: 2026 }).length, 1);
  assert.equal(reservations.list({ year: 2025 }).length, 1);
  assert.equal(reservations.list({ year: 2027 }).length, 1);
});

test('update mescla o patch sem apagar os demais campos', () => {
  const created = createSample();
  const updated = reservations.update(created.id, { grossAmount: 900, condoRegistered: true });

  assert.equal(updated.grossAmount, 900);
  assert.equal(updated.condoRegistered, true);
  assert.equal(updated.guestName, 'Hóspede Teste'); // não mudou
  assert.equal(updated.checkinTime, '14:00'); // default preservado
});

test('update aceita documento e horários no patch', () => {
  const created = createSample();
  const updated = reservations.update(created.id, {
    guestDocument: '98.765.432-1',
    checkinTime: '16:00',
    checkoutTime: '12:00',
  });

  assert.equal(updated.guestDocument, '98.765.432-1');
  assert.equal(updated.checkinTime, '16:00');
  assert.equal(updated.checkoutTime, '12:00');
  assert.equal(updated.guestName, 'Hóspede Teste'); // não mudou
});

test('markCancelled preenche cancelledAt e listActiveIcalFrom deixa de retornar', () => {
  const r = createSample({ source: 'airbnb-ical', icalUid: 'uid-1' });

  assert.equal(reservations.listActiveIcalFrom('2026-01-01').length, 1);

  const cancelled = reservations.markCancelled(r.id);
  assert.ok(cancelled.cancelledAt);
  assert.equal(reservations.listActiveIcalFrom('2026-01-01').length, 0);
});

test('listActiveIcalFrom só considera check-in a partir da data dada', () => {
  createSample({ source: 'airbnb-ical', icalUid: 'uid-passada', checkinDate: '2026-01-05', checkoutDate: '2026-01-08' });
  createSample({ source: 'airbnb-ical', icalUid: 'uid-futura', checkinDate: '2026-12-05', checkoutDate: '2026-12-08' });
  createSample({ icalUid: null }); // manual: nunca entra

  const active = reservations.listActiveIcalFrom('2026-06-01');
  assert.equal(active.length, 1);
  assert.equal(active[0].icalUid, 'uid-futura');
});

test('remove apaga a reserva e retorna false para id inexistente', () => {
  const created = createSample();

  assert.equal(reservations.remove(created.id), true);
  assert.equal(reservations.findById(created.id), null);
  assert.equal(reservations.remove(9999), false);
});

test('findByIcalUid impede duplicar importação', () => {
  createSample({ source: 'airbnb-ical', icalUid: 'uid-abc' });

  assert.ok(reservations.findByIcalUid('uid-abc'));
  assert.equal(reservations.findByIcalUid('uid-outra'), null);
});
