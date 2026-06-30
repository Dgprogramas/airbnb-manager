'use strict';

const { getDb } = require('../db/connection');

function rowToSettings(row) {
  return {
    hostSplitPercent: row.host_split_percent,
    ownerName: row.owner_name,
    icalUrl: row.ical_url,
  };
}

function get() {
  const db = getDb();
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  return rowToSettings(row);
}

function update(patch) {
  const current = get();
  const merged = {
    hostSplitPercent:
      patch.hostSplitPercent !== undefined ? Number(patch.hostSplitPercent) : current.hostSplitPercent,
    ownerName: patch.ownerName ?? current.ownerName,
    icalUrl: patch.icalUrl !== undefined ? patch.icalUrl : current.icalUrl,
  };

  const db = getDb();
  db.prepare(`
    UPDATE settings SET host_split_percent = ?, owner_name = ?, ical_url = ?
    WHERE id = 1
  `).run(merged.hostSplitPercent, merged.ownerName, merged.icalUrl);

  return get();
}

module.exports = { get, update };
