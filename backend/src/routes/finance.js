'use strict';

const finance = require('../services/finance');

async function getClosing(req, res, { query }, { sendJson }) {
  const month = query.get('month') || undefined;
  if (!month) {
    return sendJson(res, 400, { error: 'O parâmetro "month" (YYYY-MM) é obrigatório' });
  }
  const closing = finance.closeMonth(month);
  sendJson(res, 200, closing);
}

module.exports = { getClosing };
