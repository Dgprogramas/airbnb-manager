'use strict';

const express = require('express');
const settings = require('../repositories/settings');
const { isNonEmptyString } = require('../validation');

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.json(settings.get());
});

// PATCH /api/settings
router.patch('/', (req, res) => {
  const { hostSplitPercent, ownerName, icalUrl } = req.body;
  if (hostSplitPercent !== undefined) {
    const n = Number(hostSplitPercent);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return res.status(400).json({
        error: `hostSplitPercent inválido: "${hostSplitPercent}". Use um número entre 0 e 100`,
      });
    }
  }
  if (ownerName !== undefined && !isNonEmptyString(ownerName)) {
    return res.status(400).json({ error: 'ownerName não pode ser vazio' });
  }
  if (icalUrl !== undefined && icalUrl !== null && typeof icalUrl !== 'string') {
    return res.status(400).json({ error: 'icalUrl deve ser uma string ou null' });
  }
  res.json(settings.update(req.body));
});

module.exports = router;
