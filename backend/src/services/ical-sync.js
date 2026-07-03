'use strict';

const ical = require('node-ical');
const reservations = require('../repositories/reservations');
const settings = require('../repositories/settings');

// Date (do node-ical) -> 'YYYY-MM-DD'. Eventos do Airbnb são all-day (VALUE=DATE),
// gravados em UTC; usamos as partes UTC para evitar erro de fuso (off-by-one).
function toIsoDate(date) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Hoje no fuso local -> 'YYYY-MM-DD'.
function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// O iCal do Airbnb traz dois tipos de evento: "Reserved" (reserva de verdade)
// e "Airbnb (Not available)" (datas bloqueadas manualmente). Bloqueio não é reserva.
function isBlockedEvent(event) {
  const summary =
    typeof event.summary === 'string' ? event.summary : (event.summary && event.summary.val) || '';
  return /not available|unavailable/i.test(summary);
}

// Sincroniza reservas a partir do iCal do Airbnb. Usa a URL passada no corpo ou,
// na falta dela, a configurada em settings.icalUrl. Cria reservas 'pending'
// (o iCal só traz datas), evitando duplicar pelo ical_uid. Também detecta
// cancelamentos: reserva futura importada do iCal que sumiu do feed é marcada
// como cancelada (cancelled_at).
async function syncFromIcal({ icalUrl } = {}) {
  const config = settings.get();
  const url = icalUrl || config.icalUrl;
  if (!url) {
    throw new Error(
      'Nenhuma URL de iCal disponível. Configure em PATCH /api/settings { icalUrl } ou envie icalUrl no corpo.'
    );
  }

  const data = await ical.async.fromURL(url);
  const events = Object.values(data).filter((item) => item.type === 'VEVENT');

  const created = [];
  let skipped = 0;
  let blocked = 0;
  const feedUids = new Set();

  for (const event of events) {
    const uid = event.uid;
    const start = event.start ? toIsoDate(event.start) : null;
    const end = event.end ? toIsoDate(event.end) : null;

    if (uid) feedUids.add(uid);

    if (isBlockedEvent(event)) {
      blocked += 1;
      continue;
    }
    if (!uid || !start || !end) {
      skipped += 1;
      continue;
    }
    if (reservations.findByIcalUid(uid)) {
      skipped += 1; // já importada numa sync anterior
      continue;
    }
    created.push(
      reservations.create({
        guestName: 'Reserva Airbnb (a completar)',
        checkinDate: start,
        checkoutDate: end,
        grossAmount: 0,
        status: 'pending',
        source: 'airbnb-ical',
        icalUid: uid,
      })
    );
  }

  // Cancelamentos: só reservas com check-in de hoje em diante — o feed do
  // Airbnb remove eventos passados naturalmente, e isso não é cancelamento.
  const cancelled = [];
  for (const reservation of reservations.listActiveIcalFrom(todayIso())) {
    if (!feedUids.has(reservation.icalUid)) {
      cancelled.push(reservations.markCancelled(reservation.id));
    }
  }

  return {
    url,
    totalEvents: events.length,
    createdCount: created.length,
    skippedCount: skipped,
    blockedCount: blocked,
    cancelledCount: cancelled.length,
    created,
    cancelled,
  };
}

module.exports = { syncFromIcal };
