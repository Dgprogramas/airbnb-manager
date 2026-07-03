'use strict';

const express = require('express');
const expenses = require('../repositories/expenses');
const { isMonth, isNonNegativeAmount } = require('../validation');

const router = express.Router();

// Valida os campos de uma despesa (mesclada com a existente, no caso do PATCH).
function validateExpense({ month, category, amount }) {
  if (!isMonth(month)) return `month inválido: "${month}". Use YYYY-MM`;
  if (!expenses.CATEGORIES.includes(category)) {
    return `Categoria inválida "${category}". Use uma de: ${expenses.CATEGORIES.join(', ')}`;
  }
  if (!isNonNegativeAmount(amount) || Number(amount) === 0) {
    return `amount inválido: "${amount}". Use um número maior que zero`;
  }
  return null;
}

// GET /api/expenses?month=YYYY-MM
router.get('/', (req, res) => {
  res.json(expenses.list({ month: req.query.month || undefined }));
});

// POST /api/expenses
router.post('/', (req, res) => {
  const error = validateExpense(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(expenses.create(req.body));
});

// PATCH /api/expenses/:id
router.patch('/:id', (req, res) => {
  const existing = expenses.findById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: `Despesa #${req.params.id} não encontrada` });
  }
  const merged = { ...existing, ...req.body };
  const error = validateExpense(merged);
  if (error) return res.status(400).json({ error });
  res.json(expenses.update(req.params.id, req.body));
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  if (!expenses.findById(req.params.id)) {
    return res.status(404).json({ error: `Despesa #${req.params.id} não encontrada` });
  }
  expenses.remove(req.params.id);
  res.status(204).end();
});

module.exports = router;
