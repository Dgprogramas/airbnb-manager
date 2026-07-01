'use strict';

const express = require('express');
const expenses = require('../repositories/expenses');

const router = express.Router();

// GET /api/expenses?month=YYYY-MM
router.get('/', (req, res) => {
  res.json(expenses.list({ month: req.query.month || undefined }));
});

// POST /api/expenses
router.post('/', (req, res) => {
  const body = req.body;
  if (!body.month || !body.category || body.amount === undefined) {
    return res.status(400).json({ error: 'month, category e amount são obrigatórios' });
  }
  if (!expenses.CATEGORIES.includes(body.category)) {
    return res.status(400).json({
      error: `Categoria inválida "${body.category}". Use uma de: ${expenses.CATEGORIES.join(', ')}`,
    });
  }
  res.status(201).json(expenses.create(body));
});

module.exports = router;
