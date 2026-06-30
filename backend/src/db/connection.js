'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'airbnb-manager.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  dbInstance = new DatabaseSync(DB_PATH);
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  dbInstance.exec(schema);

  return dbInstance;
}

module.exports = { getDb, DB_PATH };
