'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
// AIRBNB_DB_PATH permite apontar para outro arquivo (ou ':memory:' nos testes)
const DB_PATH = process.env.AIRBNB_DB_PATH || path.join(DATA_DIR, 'airbnb-manager.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

// Migrações para bancos criados antes de colunas novas existirem no schema.sql
// (CREATE TABLE IF NOT EXISTS não altera tabelas já criadas).
function migrate(db) {
  const columns = db.prepare('PRAGMA table_info(reservations)').all().map((c) => c.name);
  if (!columns.includes('cancelled_at')) {
    db.exec('ALTER TABLE reservations ADD COLUMN cancelled_at TEXT');
  }
  if (!columns.includes('guest_document')) {
    db.exec("ALTER TABLE reservations ADD COLUMN guest_document TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.includes('checkin_time')) {
    db.exec("ALTER TABLE reservations ADD COLUMN checkin_time TEXT NOT NULL DEFAULT '14:00'");
  }
  if (!columns.includes('checkout_time')) {
    db.exec("ALTER TABLE reservations ADD COLUMN checkout_time TEXT NOT NULL DEFAULT '11:00'");
  }
}

function getDb() {
  if (dbInstance) return dbInstance;

  if (DB_PATH !== ':memory:' && !fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  dbInstance = new DatabaseSync(DB_PATH);
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  dbInstance.exec(schema);
  migrate(dbInstance);

  return dbInstance;
}

module.exports = { getDb, DB_PATH };
