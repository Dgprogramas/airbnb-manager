'use strict';

const reservations = require('../repositories/reservations');
const expenses = require('../repositories/expenses');
const settings = require('../repositories/settings');

// Arredonda para 2 casas decimais, evitando ruído de ponto flutuante.
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Calcula o fechamento financeiro de um mês ('YYYY-MM'):
// receita das reservas - despesas, e o split entre anfitrião e dono.
function closeMonth(month) {
  if (!month) throw new Error('Parâmetro "month" (YYYY-MM) é obrigatório');

  const monthReservations = reservations.list({ month });
  const monthExpenses = expenses.list({ month });
  const config = settings.get();

  const grossRevenue = round2(
    monthReservations.reduce((sum, r) => sum + (r.grossAmount || 0), 0)
  );

  const expensesByCategory = {};
  let totalExpenses = 0;
  for (const expense of monthExpenses) {
    const amount = expense.amount || 0;
    totalExpenses += amount;
    expensesByCategory[expense.category] =
      round2((expensesByCategory[expense.category] || 0) + amount);
  }
  totalExpenses = round2(totalExpenses);

  const balance = round2(grossRevenue - totalExpenses);
  const hostSplitPercent = config.hostSplitPercent;
  const ownerSplitPercent = 100 - hostSplitPercent;

  const hostAmount = round2((balance * hostSplitPercent) / 100);
  const ownerAmount = round2((balance * ownerSplitPercent) / 100);

  return {
    month,
    hostSplitPercent,
    ownerSplitPercent,
    ownerName: config.ownerName,
    reservationsCount: monthReservations.length,
    grossRevenue,
    totalExpenses,
    expensesByCategory,
    balance,
    hostAmount,
    ownerAmount,
  };
}

module.exports = { closeMonth };
