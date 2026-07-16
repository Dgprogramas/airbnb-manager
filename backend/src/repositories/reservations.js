'use strict';

const { getDb } = require('../db/connection');

function rowToReservation(row) {
  if (!row) return null;
  return {
    id: row.id,
    guestName: row.guest_name,
    guestDocument: row.guest_document,
    checkinDate: row.checkin_date,
    checkoutDate: row.checkout_date,
    checkinTime: row.checkin_time,
    checkoutTime: row.checkout_time,
    grossAmount: row.gross_amount,
    condoRegistered: Boolean(row.condo_registered),
    apartmentInfoSent: Boolean(row.apartment_info_sent),
    status: row.status,
    source: row.source,
    icalUid: row.ical_uid,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  };
}

function create({
  guestName,
  guestDocument = '',
  checkinDate,
  checkoutDate,
  checkinTime = '14:00',
  checkoutTime = '11:00',
  grossAmount = 0,
  status = 'complete',
  source = 'manual',
  icalUid = null,
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO reservations
      (guest_name, guest_document, checkin_date, checkout_date, checkin_time, checkout_time,
       gross_amount, status, source, ical_uid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    guestName,
    guestDocument,
    checkinDate,
    checkoutDate,
    checkinTime,
    checkoutTime,
    Number(grossAmount) || 0,
    status,
    source,
    icalUid
  );
  return findById(result.lastInsertRowid);
}

function findById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reservations WHERE id = ?').get(Number(id));
  return rowToReservation(row);
}

function findByIcalUid(icalUid) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reservations WHERE ical_uid = ?').get(icalUid);
  return rowToReservation(row);
}

function list({ month, pendingOnly } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM reservations';
  const conditions = [];
  const params = [];

  if (month) {
    conditions.push('checkin_date LIKE ?');
    params.push(`${month}%`);
  }
  if (pendingOnly) {
    conditions.push("status = 'pending'");
  }
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY checkin_date ASC';

  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToReservation);
}

function update(id, patch) {
  const existing = findById(id);
  if (!existing) throw new Error(`Reserva #${id} não encontrada`);

  const merged = {
    guestName: patch.guestName ?? existing.guestName,
    guestDocument: patch.guestDocument ?? existing.guestDocument,
    checkinDate: patch.checkinDate ?? existing.checkinDate,
    checkoutDate: patch.checkoutDate ?? existing.checkoutDate,
    checkinTime: patch.checkinTime ?? existing.checkinTime,
    checkoutTime: patch.checkoutTime ?? existing.checkoutTime,
    grossAmount: patch.grossAmount !== undefined ? Number(patch.grossAmount) : existing.grossAmount,
    condoRegistered:
      patch.condoRegistered !== undefined ? Boolean(patch.condoRegistered) : existing.condoRegistered,
    apartmentInfoSent:
      patch.apartmentInfoSent !== undefined
        ? Boolean(patch.apartmentInfoSent)
        : existing.apartmentInfoSent,
    status: patch.status ?? existing.status,
  };

  const db = getDb();
  db.prepare(`
    UPDATE reservations SET
      guest_name = ?,
      guest_document = ?,
      checkin_date = ?,
      checkout_date = ?,
      checkin_time = ?,
      checkout_time = ?,
      gross_amount = ?,
      condo_registered = ?,
      apartment_info_sent = ?,
      status = ?
    WHERE id = ?
  `).run(
    merged.guestName,
    merged.guestDocument,
    merged.checkinDate,
    merged.checkoutDate,
    merged.checkinTime,
    merged.checkoutTime,
    merged.grossAmount,
    merged.condoRegistered ? 1 : 0,
    merged.apartmentInfoSent ? 1 : 0,
    merged.status,
    Number(id)
  );

  return findById(id);
}

// Reservas do iCal ainda não canceladas com check-in a partir de `dateIso` —
// usadas pelo sync para detectar cancelamentos (evento sumiu do feed).
function listActiveIcalFrom(dateIso) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM reservations
       WHERE source = 'airbnb-ical' AND cancelled_at IS NULL AND checkin_date >= ?`
    )
    .all(dateIso);
  return rows.map(rowToReservation);
}

function markCancelled(id) {
  const db = getDb();
  db.prepare("UPDATE reservations SET cancelled_at = datetime('now') WHERE id = ?").run(Number(id));
  return findById(id);
}

function remove(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM reservations WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

module.exports = {
  create,
  findById,
  findByIcalUid,
  list,
  update,
  listActiveIcalFrom,
  markCancelled,
  remove,
};
