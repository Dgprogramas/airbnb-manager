'use strict';

// Banco em memória: precisa ser definido ANTES de qualquer require que toque o DB.
process.env.AIRBNB_DB_PATH = ':memory:';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { getDb } = require('../src/db/connection');
const reservations = require('../src/repositories/reservations');
const { importFromCsv } = require('../src/services/airbnb-csv-import');

beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM reservations;');
});

const HEADER_PT =
  'Código de confirmação,Tipo,Hóspede,Data de início,Data de término,Noites,Ganhos brutos';

test('cria reserva nova (source airbnb-csv) quando não há correspondente por data', () => {
  // Dia 20 desambigua DD/MM (o parser assume MM/DD quando o arquivo inteiro
  // é ambíguo — ver teste "detecta DD/MM..." mais abaixo).
  const csv = [
    HEADER_PT,
    'HMABC123,Reserva,"Vera Lúcia",20/07/2026,22/07/2026,2,"R$ 278,00"',
  ].join('\n');

  const result = importFromCsv(csv);

  assert.equal(result.createdCount, 1);
  assert.equal(result.updatedCount, 0);
  const [created] = result.created;
  assert.equal(created.guestName, 'Vera Lúcia');
  assert.equal(created.checkinDate, '2026-07-20');
  assert.equal(created.checkoutDate, '2026-07-22');
  assert.equal(created.grossAmount, 278);
  assert.equal(created.status, 'complete');
  assert.equal(created.source, 'airbnb-csv');
});

test('completa reserva pendente existente (mesmo check-in) com nome e valor', () => {
  const pending = reservations.create({
    guestName: 'Reserva Airbnb (a completar)',
    checkinDate: '2026-07-16',
    checkoutDate: '2026-07-17',
    grossAmount: 0,
    status: 'pending',
    source: 'airbnb-ical',
    icalUid: 'uid-1',
  });

  const csv = [HEADER_PT, 'HMDEF456,Reserva,Pablo,16/07/2026,17/07/2026,1,"R$ 189,94"'].join('\n');
  const result = importFromCsv(csv);

  assert.equal(result.updatedCount, 1);
  assert.equal(result.createdCount, 0);
  const updated = reservations.findById(pending.id);
  assert.equal(updated.guestName, 'Pablo');
  assert.equal(updated.grossAmount, 189.94);
  assert.equal(updated.status, 'complete');
  // Mantém a origem/uid do iCal — a reserva não muda de identidade.
  assert.equal(updated.source, 'airbnb-ical');
});

test('não sobrescreve reserva já completa (evita duplicar dado editado manualmente)', () => {
  const complete = reservations.create({
    guestName: 'Nome Editado à Mão',
    checkinDate: '2026-07-16',
    checkoutDate: '2026-07-17',
    grossAmount: 999,
    status: 'complete',
  });

  const csv = [HEADER_PT, 'HMDEF456,Reserva,Pablo,16/07/2026,17/07/2026,1,"R$ 189,94"'].join('\n');
  const result = importFromCsv(csv);

  assert.equal(result.skippedCount, 1);
  assert.equal(result.updatedCount, 0);
  assert.equal(result.createdCount, 0);
  const untouched = reservations.findById(complete.id);
  assert.equal(untouched.guestName, 'Nome Editado à Mão');
  assert.equal(untouched.grossAmount, 999);
});

test('reimportar o mesmo arquivo é seguro (idempotente)', () => {
  const csv = [HEADER_PT, 'HMABC123,Reserva,"Vera Lúcia",02/07/2026,04/07/2026,2,"R$ 278,00"'].join(
    '\n'
  );

  importFromCsv(csv);
  const second = importFromCsv(csv);

  assert.equal(second.createdCount, 0);
  assert.equal(second.skippedCount, 1);
  assert.equal(reservations.list().length, 1);
});

test('calcula checkout a partir de "noites" quando a coluna de término está ausente', () => {
  const header = 'Código de confirmação,Tipo,Hóspede,Data de início,Noites,Ganhos brutos';
  const csv = [header, 'HMGHI789,Reserva,Leonardo,20/07/2026,3,"R$ 450,00"'].join('\n');

  const result = importFromCsv(csv);

  assert.equal(result.createdCount, 1);
  assert.equal(result.created[0].checkinDate, '2026-07-20');
  assert.equal(result.created[0].checkoutDate, '2026-07-23');
});

test('aceita cabeçalho em inglês e datas no formato MM/DD/YYYY', () => {
  const header = 'Confirmation code,Type,Guest,Start date,End date,Nights,Gross earnings';
  const csv = [header, 'HMJKL012,Reservation,John Smith,07/20/2026,07/22/2026,2,"$300.00"'].join(
    '\n'
  );

  const result = importFromCsv(csv);

  assert.equal(result.createdCount, 1);
  assert.equal(result.created[0].checkinDate, '2026-07-20');
  assert.equal(result.created[0].checkoutDate, '2026-07-22');
  assert.equal(result.created[0].grossAmount, 300);
});

test('detecta DD/MM quando algum dia do arquivo passa de 12', () => {
  // 25/07 só faz sentido como DD/MM — confirma que o parser não assume
  // MM/DD cegamente quando o próprio arquivo desambigua.
  const csv = [HEADER_PT, 'HMXYZ,Reserva,Ana,25/07/2026,27/07/2026,2,"R$ 200,00"'].join('\n');

  const result = importFromCsv(csv);

  assert.equal(result.created[0].checkinDate, '2026-07-25');
  assert.equal(result.created[0].checkoutDate, '2026-07-27');
});

test('soma duas linhas "Reserva" do mesmo código (cobrança dividida)', () => {
  const csv = [
    HEADER_PT,
    'HMSAME,Reserva,Maria,20/07/2026,22/07/2026,2,"R$ 123,12"',
    'HMSAME,Reserva,Maria,20/07/2026,22/07/2026,2,"R$ 303,52"',
  ].join('\n');

  const result = importFromCsv(csv);

  assert.equal(result.createdCount, 1);
  assert.equal(result.created[0].grossAmount, 426.64);
});

test('exclui linhas que não são reserva (resolução/payout/crédito) da soma', () => {
  const csv = [
    HEADER_PT,
    'HMRES,Reserva,Laissa,20/07/2026,22/07/2026,2,"R$ 464,82"',
    'HMRES,Pagamento da Resolução,Laissa,20/07/2026,22/07/2026,2,"R$ 108,00"',
  ].join('\n');

  const result = importFromCsv(csv);

  assert.equal(result.createdCount, 1);
  assert.equal(result.created[0].grossAmount, 464.82); // resolução não entra
});

test('prefere a coluna "Valor" a "Ganhos brutos" (repasse líquido)', () => {
  const header =
    'Código de confirmação,Tipo,Hóspede,Data de início,Data de término,Noites,Valor,Ganhos brutos';
  const csv = [header, 'HMVAL,Reserva,Crícia,20/07/2026,27/07/2026,7,"R$ 912,33","R$ 950,56"'].join(
    '\n'
  );

  const result = importFromCsv(csv);

  assert.equal(result.created[0].grossAmount, 912.33);
});

test('ignora linhas sem hóspede ou sem data de início válida', () => {
  const csv = [HEADER_PT, ',Repasse,,,,,"R$ 50,00"'].join('\n');

  const result = importFromCsv(csv);

  assert.equal(result.createdCount, 0);
  assert.equal(result.ignoredRows, 1);
});

test('rejeita CSV vazio', () => {
  assert.throws(() => importFromCsv(''), /CSV vazio/);
  assert.throws(() => importFromCsv('   '), /CSV vazio/);
});

test('rejeita CSV sem as colunas esperadas', () => {
  assert.throws(() => importFromCsv('Foo,Bar\n1,2'), /CSV não reconhecido/);
});

test('rejeita CSV só com cabeçalho', () => {
  assert.throws(() => importFromCsv(HEADER_PT), /sem linhas de dados/);
});
