'use strict';

const reservations = require('../repositories/reservations');

// Importa reservas do CSV de ganhos do Airbnb (Conta → Pagamentos → Relatório
// de ganhos). Diferente do iCal, o CSV traz nome do hóspede, valor e reservas
// já passadas — é o jeito de recuperar o histórico e completar pendências.
//
// O formato varia com o idioma da conta (colunas em português ou inglês) e o
// separador decimal, então o parser mapeia cabeçalhos por apelidos e detecta
// o formato de data/valor pelo conteúdo.

// --- Parser CSV (RFC 4180): aspas, vírgula dentro de campo, quebra de linha
// dentro de campo, CRLF e BOM. O relatório do Airbnb usa aspas em nomes.
function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

// Apelidos de cabeçalho (contas em português e inglês). Comparação sem
// acentos e em minúsculas.
const HEADER_ALIASES = {
  guest: ['hospede', 'guest'],
  checkin: ['data de inicio', 'start date'],
  checkout: ['data de termino', 'end date'],
  nights: ['noites', 'nights'],
  gross: ['ganhos brutos', 'gross earnings'],
  amount: ['valor', 'amount'],
  type: ['tipo', 'type'],
  code: ['codigo de confirmacao', 'confirmation code'],
};

function normalizeHeader(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function mapHeaders(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const indexes = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    indexes[key] = normalized.findIndex((h) => aliases.includes(h));
  }
  return indexes;
}

// Arredonda para 2 casas, evitando ruído de ponto flutuante ao somar valores.
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// 'R$1.234,56' / '1,234.56' / '1234.56' -> número. Quando os dois separadores
// aparecem, o último é o decimal; vírgula sozinha é decimal (padrão pt-BR).
function parseMoney(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[^\d.,-]/g, '');
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(',', '.');
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// Detecta o formato das datas 'A/B/YYYY' do arquivo inteiro: se alguma
// primeira parte passa de 12, é DD/MM; se alguma segunda parte passa de 12,
// é MM/DD; na dúvida, assume MM/DD (padrão dos relatórios do Airbnb).
function detectDayFirst(dateStrings) {
  let dayFirst = null;
  for (const s of dateStrings) {
    const m = /^(\d{1,2})\/(\d{1,2})\/\d{4}$/.exec(s);
    if (!m) continue;
    if (Number(m[1]) > 12) return true;
    if (Number(m[2]) > 12) dayFirst = false;
  }
  return dayFirst ?? false;
}

// 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' -> 'YYYY-MM-DD'.
function toIsoDate(raw, dayFirst) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const day = dayFirst ? Number(m[1]) : Number(m[2]);
  const month = dayFirst ? Number(m[2]) : Number(m[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Soma `nights` dias a uma data ISO (usado quando o CSV não traz o término).
function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

// Extrai as linhas que são reservas de fato (têm hóspede + data de início;
// linhas de repasse/ajuste do relatório não têm) e agrega por código de
// confirmação — uma reserva pode aparecer em mais de uma linha (ajustes).
// Só linhas de reserva de fato viram estadia. O relatório mistura tipos:
// "Reserva" (a reserva), "Payout"/"Transferência" (repasse pro banco),
// "Pagamento da Resolução" (reembolso do AirCover) e "Créditos Diversos".
// Payout/Créditos não têm hóspede/data (já caem fora), mas a Resolução tem
// e compartilha o código da reserva — se somada, infla o valor. Quando a
// coluna Tipo existe, aceitamos apenas reserva de verdade.
const RESERVATION_TYPES = ['reserva', 'reservation'];

function extractStays(rows, indexes) {
  const cell = (row, key) => (indexes[key] >= 0 ? (row[indexes[key]] ?? '').trim() : '');

  const dateStrings = [];
  for (const row of rows) {
    if (cell(row, 'checkin')) dateStrings.push(cell(row, 'checkin'));
    if (cell(row, 'checkout')) dateStrings.push(cell(row, 'checkout'));
  }
  const dayFirst = detectDayFirst(dateStrings);

  const stays = new Map();
  let ignored = 0;

  for (const row of rows) {
    // Se houver coluna Tipo, exige que seja uma reserva (descarta resolução,
    // payout, créditos). Sem a coluna, cai no filtro de hóspede+data abaixo.
    if (indexes.type >= 0) {
      const type = normalizeHeader(cell(row, 'type'));
      if (!RESERVATION_TYPES.includes(type)) {
        ignored++;
        continue;
      }
    }

    const guest = cell(row, 'guest');
    const checkin = toIsoDate(cell(row, 'checkin'), dayFirst);
    if (!guest || !checkin) {
      ignored++;
      continue;
    }

    let checkout = toIsoDate(cell(row, 'checkout'), dayFirst);
    const nights = Number(cell(row, 'nights'));
    if (!checkout && Number.isInteger(nights) && nights > 0) {
      checkout = addDays(checkin, nights);
    }

    // "Valor" é o repasse líquido (o que cai na conta). Preferido a "Ganhos
    // brutos" — este último é antes da taxa de serviço do Airbnb. Uma mesma
    // reserva pode vir em duas linhas "Reserva" (cobrança dividida); somamos.
    const amount = parseMoney(cell(row, 'amount')) ?? parseMoney(cell(row, 'gross')) ?? 0;
    const key = cell(row, 'code') || `${checkin}|${guest}`;

    const existing = stays.get(key);
    if (existing) {
      existing.grossAmount = round2(existing.grossAmount + amount);
    } else {
      stays.set(key, { guestName: guest, checkinDate: checkin, checkoutDate: checkout, grossAmount: amount });
    }
  }

  return { stays: [...stays.values()], ignored };
}

// Importa o conteúdo de um CSV de ganhos. Casa cada estadia com as reservas
// existentes pela data de check-in (o apartamento é um só — não há duas
// entradas no mesmo dia): pendente é completada com nome/valor, completa é
// pulada (não sobrescreve dado já preenchido), sem correspondente vira
// reserva nova com source 'airbnb-csv'. Reimportar o mesmo arquivo é seguro.
function importFromCsv(csvText) {
  if (typeof csvText !== 'string' || !csvText.trim()) {
    const err = new Error('CSV vazio. Envie o conteúdo do relatório de ganhos do Airbnb.');
    err.status = 400;
    throw err;
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    const err = new Error('CSV sem linhas de dados (só cabeçalho ou vazio).');
    err.status = 400;
    throw err;
  }

  const indexes = mapHeaders(rows[0]);
  if (indexes.guest === -1 || indexes.checkin === -1) {
    const err = new Error(
      'CSV não reconhecido: faltam as colunas de hóspede e data de início. ' +
        'Exporte o relatório de ganhos do Airbnb (Pagamentos → Relatórios).'
    );
    err.status = 400;
    throw err;
  }

  const { stays, ignored } = extractStays(rows.slice(1), indexes);

  // Reservas ativas indexadas pela data de check-in (canceladas ficam fora:
  // uma reserva nova pode legitimamente ocupar a mesma data de uma cancelada).
  const byCheckin = new Map();
  for (const r of reservations.list()) {
    if (!r.cancelledAt) byCheckin.set(r.checkinDate, r);
  }

  const created = [];
  const updated = [];
  let skipped = 0;

  for (const stay of stays) {
    const existing = byCheckin.get(stay.checkinDate);
    if (!existing) {
      if (!stay.checkoutDate || stay.checkoutDate <= stay.checkinDate) {
        skipped++; // sem data de término válida não dá pra criar
        continue;
      }
      created.push(
        reservations.create({
          guestName: stay.guestName,
          checkinDate: stay.checkinDate,
          checkoutDate: stay.checkoutDate,
          grossAmount: stay.grossAmount,
          status: 'complete',
          source: 'airbnb-csv',
        })
      );
    } else if (existing.status === 'pending') {
      updated.push(
        reservations.update(existing.id, {
          guestName: stay.guestName,
          grossAmount: stay.grossAmount,
          status: 'complete',
        })
      );
    } else if (existing.source === 'airbnb-csv') {
      // Reserva que veio do próprio CSV: reimportar é um "refresh". Atualiza
      // só quando algo mudou de fato (mantém a reimportação idempotente e
      // corrige valores de importações anteriores com o parser antigo).
      const changed =
        existing.guestName !== stay.guestName ||
        existing.grossAmount !== stay.grossAmount ||
        (stay.checkoutDate && existing.checkoutDate !== stay.checkoutDate);
      if (changed) {
        updated.push(
          reservations.update(existing.id, {
            guestName: stay.guestName,
            grossAmount: stay.grossAmount,
            ...(stay.checkoutDate ? { checkoutDate: stay.checkoutDate } : {}),
          })
        );
      } else {
        skipped++;
      }
    } else {
      skipped++; // manual/iCal já completa: não sobrescreve o que o usuário pôs
    }
  }

  return {
    staysFound: stays.length,
    createdCount: created.length,
    updatedCount: updated.length,
    skippedCount: skipped,
    ignoredRows: ignored,
    created,
    updated,
  };
}

module.exports = { importFromCsv, parseCsv, parseMoney, toIsoDate };
