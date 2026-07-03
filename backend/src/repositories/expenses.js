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

function update(id, patch) {
  const existing = findById(id);
  if (!existing) throw new Error(`Despesa #${id} não encontrada`);

  const merged = {
    month: patch.month ?? existing.month,
    category: patch.category ?? existing.category,
    amount: patch.amount !== undefined ? Number(patch.amount) : existing.amount,
    description: patch.description ?? existing.description,
  };
  if (!CATEGORIES.includes(merged.category)) {
    throw new Error(`Categoria inválida "${merged.category}". Use uma de: ${CATEGORIES.join(', ')}`);
  }

  const db = getDb();
  db.prepare(`
    UPDATE expenses SET month = ?, category = ?, amount = ?, description = ?
    WHERE id = ?
  `).run(merged.month, merged.category, merged.amount, merged.description, Number(id));

  return findById(id);
}

function remove(id) {
  const db = getDb();
  const result = db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

module.exports = { CATEGORIES, create, findById, list, update, remove };
