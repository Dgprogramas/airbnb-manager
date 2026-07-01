'use strict';

const reservations = require('../repositories/reservations');
const settings = require('../repositories/settings');

// Desdobra linhas "folded" do iCal (RFC 5545): uma linha longa é quebrada
// e continua na linha seguinte iniciada por espaço ou tab.
function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}

// '20260803' ou '20260803T140000Z' -> '2026-08-03'
function toIsoDate(value) {
  const digits = value.trim().slice(0, 8);
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

// Extrai os VEVENTs de um texto iCal, retornando { uid, start, end, summary }.
function parseIcal(text) {
  const lines = unfold(text).split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const rawName = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const name = rawName.split(';')[0].toUpperCase(); // ignora params (ex: ;VALUE=DATE)

    if (name === 'UID') current.uid = value.trim();
    else if (name === 'DTSTART') current.start = toIsoDate(value);
    else if (name === 'DTEND') current.end = toIsoDate(value);
    else if (name === 'SUMMARY') current.summary = value.trim();
  }

  return events;
}

// Busca o texto do iCal via HTTP (fetch é global nativo do Node 18+).
async function fetchIcalText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'airbnb-manager/1.0' } });
  if (!res.ok) throw new Error(`Falha ao buscar o iCal (HTTP ${res.status})`);
  return res.text();
}

// Sincroniza reservas a partir do iCal do Airbnb. Usa a URL passada no corpo
// ou, na falta dela, a configurada em settings.icalUrl. Cria reservas como
// 'pending' (o iCal só traz datas), evitando duplicar pelo ical_uid.
async function syncFromIcal({ icalUrl } = {}) {
  const config = settings.get();
  const url = icalUrl || config.icalUrl;
  if (!url) {
    throw new Error(
      'Nenhuma URL de iCal disponível. Configure em PATCH /api/settings { icalUrl } ou envie icalUrl no corpo.'
    );
  }

  const text = await fetchIcalText(url);
  const events = parseIcal(text);

  const created = [];
  let skipped = 0;

  for (const event of events) {
    if (!event.uid || !event.start || !event.end) {
      skipped += 1;
      continue;
    }
    if (reservations.findByIcalUid(event.uid)) {
      skipped += 1; // já importada numa sync anterior
      continue;
    }
    const reservation = reservations.create({
      guestName: 'Reserva Airbnb (a completar)',
      checkinDate: event.start,
      checkoutDate: event.end,
      grossAmount: 0,
      status: 'pending',
      source: 'airbnb-ical',
      icalUid: event.uid,
    });
    created.push(reservation);
  }

  return {
    url,
    totalEvents: events.length,
    createdCount: created.length,
    skippedCount: skipped,
    created,
  };
}

module.exports = { syncFromIcal, parseIcal };
