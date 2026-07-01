'use strict';

const express = require('express');
const finance = require('../services/finance');

const router = express.Router();

// GET /api/finance/closing?month=YYYY-MM
router.get('/closing', (req, res) => {
  const month = req.query.month;
  if (!month) {
    return res.status(400).json({ error: 'O parâmetro "month" (YYYY-MM) é obrigatório' });
  }
  res.json(finance.closeMonth(month));
});

module.exports = router;
