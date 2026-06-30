'use strict';

const { getDb } = require('../db/connection');

const CATEGORIES = ['luz', 'condominio', 'internet', 'funcionaria', 'outro'];

function rowToExpense(row) {
  if (!row) return null;
  return {
    id: row.id,
    month: row.month,
    category: row.category,
    amount: row.amount,
    description: row.description,
    createdAt: row.created_at,
  };
}

function create({ month, category, amount, description = '' }) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`Categoria inválida "${category}". Use uma de: ${CATEGORIES.join(', ')}`);
  }
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO expenses (month, category, amount, description)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(month, category, Number(amount), description);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(Number(id));
  return rowToExpense(row);
}

function list({ month } = {}) {
  const db = getDb();
  let sql = 'SELECT * FROM expenses';
  const params = [];
  if (month) {
    sql += ' WHERE month = ?';
    params.push(month);
  }
  sql += ' ORDER BY created_at ASC';
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToExpense);
}

module.exports = { CATEGORIES, create, findById, list };
