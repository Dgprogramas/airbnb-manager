'use strict';

const expenses = require('../repositories/expenses');

async function listExpenses(req, res, { query }, { sendJson }) {
  const month = query.get('month') || undefined;
  const result = expenses.list({ month });
  sendJson(res, 200, result);
}

async function createExpense(req, res, ctx, { sendJson, readJsonBody }) {
  const body = await readJsonBody(req);
  if (!body.month || !body.category || body.amount === undefined) {
    return sendJson(res, 400, { error: 'month, category e amount são obrigatórios' });
  }
  const created = expenses.create(body);
  sendJson(res, 201, created);
}

module.exports = { listExpenses, createExpense };
