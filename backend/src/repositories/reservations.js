'use strict';

const { getDb } = require('../db/connection');

function rowToReservation(row) {
  if (!row) return null;
  return {
    id: row.id,
    guestName: row.guest_name,
    checkinDate: row.checkin_date,
    checkoutDate: row.checkout_date,
    grossAmount: row.gross_amount,
    condoRegistered: Boolean(row.condo_registered),
    apartmentInfoSent: Boolean(row.apartment_info_sent),
    status: row.status,
    source: row.source,
    icalUid: row.ical_uid,
    createdAt: row.created_at,
  };
}

function create({
  guestName,
  checkinDate,
  checkoutDate,
  grossAmount = 0,
  status = 'complete',
  source = 'manual',
  icalUid = null,
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO reservations
      (guest_name, checkin_date, checkout_date, gross_amount, status, source, ical_uid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    guestName,
    checkinDate,
    checkoutDate,
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
    checkinDate: patch.checkinDate ?? existing.checkinDate,
    checkoutDate: patch.checkoutDate ?? existing.checkoutDate,
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
      checkin_date = ?,
      checkout_date = ?,
      gross_amount = ?,
      condo_registered = ?,
      apartment_info_sent = ?,
      status = ?
    WHERE id = ?
  `).run(
    merged.guestName,
    merged.checkinDate,
    merged.checkoutDate,
    merged.grossAmount,
    merged.condoRegistered ? 1 : 0,
    merged.apartmentInfoSent ? 1 : 0,
    merged.status,
    Number(id)
  );

  return findById(id);
}

module.exports = { create, findById, findByIcalUid, list, update };
