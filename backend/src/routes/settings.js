'use strict';

const express = require('express');
const settings = require('../repositories/settings');

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.json(settings.get());
});

// PATCH /api/settings
router.patch('/', (req, res) => {
  res.json(settings.update(req.body));
});

module.exports = router;
