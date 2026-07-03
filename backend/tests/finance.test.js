'use strict';

// Banco em memória: precisa ser definido ANTES de qualquer require que toque o DB.
process.env.AIRBNB_DB_PATH = ':memory:';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../src/db/connection');
const reservations = require('../src/repositories/reservations');
const expenses = require('../src/repositories/expenses');
const settings = require('../src/repositories/settings');
const finance = require('../src/services/finance');

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM reservations; DELETE FROM expenses;');
  db.exec("UPDATE settings SET host_split_percent = 30, owner_name = 'Pai' WHERE id = 1");
});

test('fechamento soma receita, subtrai despesas e aplica o split', () => {
  reservations.create({
    guestName: 'Ana',
    checkinDate: '2026-06-05',
    checkoutDate: '2026-06-08',
    grossAmount: 1000,
  });
  reservations.create({
    guestName: 'Bruno',
    checkinDate: '2026-06-20',
    checkoutDate: '2026-06-22',
    grossAmount: 500,
  });
  expenses.create({ month: '2026-06', category: 'luz', amount: 200 });
  expenses.create({ month: '2026-06', category: 'condominio', amount: 300 });

  const closing = finance.closeMonth('2026-06');

  assert.equal(closing.reservationsCount, 2);
  assert.equal(closing.grossRevenue, 1500);
  assert.equal(closing.totalExpenses, 500);
  assert.equal(closing.balance, 1000);
  assert.equal(closing.hostAmount, 300); // 30%
  assert.equal(closing.ownerAmount, 700); // 70%
  assert.equal(closing.pendingCount, 0);
});

test('fechamento arredonda para 2 casas sem ruído de ponto flutuante', () => {
  reservations.create({
    guestName: 'Carla',
    checkinDate: '2026-06-10',
    checkoutDate: '2026-06-12',
    grossAmount: 100.1,
  });

  const closing = finance.closeMonth('2026-06');

  assert.equal(closing.hostAmount, 30.03);
  assert.equal(closing.ownerAmount, 70.07);
});

test('fechamento ignora reservas canceladas', () => {
  reservations.create({
    guestName: 'Ativa',
    checkinDate: '2026-06-01',
    checkoutDate: '2026-06-03',
    grossAmount: 800,
  });
  const toCancel = reservations.create({
    guestName: 'Cancelada',
    checkinDate: '2026-06-10',
    checkoutDate: '2026-06-12',
    grossAmount: 999,
    source: 'airbnb-ical',
    icalUid: 'uid-cancelada',
  });
  reservations.markCancelled(toCancel.id);

  const closing = finance.closeMonth('2026-06');

  assert.equal(closing.reservationsCount, 1);
  assert.equal(closing.grossRevenue, 800);
});

test('fechamento conta reservas pendentes (dados incompletos)', () => {
  reservations.create({
    guestName: 'Completa',
    checkinDate: '2026-06-01',
    checkoutDate: '2026-06-03',
    grossAmount: 400,
  });
  reservations.create({
    guestName: 'Reserva Airbnb (a completar)',
    checkinDate: '2026-06-15',
    checkoutDate: '2026-06-18',
    grossAmount: 0,
    status: 'pending',
    source: 'airbnb-ical',
    icalUid: 'uid-pendente',
  });

  const closing = finance.closeMonth('2026-06');

  assert.equal(closing.pendingCount, 1);
  assert.equal(closing.grossRevenue, 400);
});

test('mês sem movimento fecha zerado', () => {
  const closing = finance.closeMonth('2026-01');

  assert.equal(closing.reservationsCount, 0);
  assert.equal(closing.grossRevenue, 0);
  assert.equal(closing.totalExpenses, 0);
  assert.equal(closing.balance, 0);
  assert.equal(closing.hostAmount, 0);
  assert.equal(closing.ownerAmount, 0);
});

test('split respeita o percentual configurado em settings', () => {
  settings.update({ hostSplitPercent: 50 });
  reservations.create({
    guestName: 'Meio a meio',
    checkinDate: '2026-06-01',
    checkoutDate: '2026-06-05',
    grossAmount: 1000,
  });

  const closing = finance.closeMonth('2026-06');

  assert.equal(closing.hostAmount, 500);
  assert.equal(closing.ownerAmount, 500);
});
