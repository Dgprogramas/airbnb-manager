'use strict';

// Validadores compartilhados pelas rotas. Retornam boolean; a mensagem de erro
// fica a cargo de cada rota (para manter o texto no contexto do endpoint).

// 'YYYY-MM-DD' com dia/mês reais (rejeita 2026-02-30, 2026-13-01 etc.)
function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}

// 'YYYY-MM' com mês entre 01 e 12
function isMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// Número finito >= 0 (aceita number ou string numérica, como os forms enviam)
function isNonNegativeAmount(value) {
  const n = Number(value);
  return typeof value !== 'boolean' && value !== '' && value !== null && Number.isFinite(n) && n >= 0;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = { isIsoDate, isMonth, isNonNegativeAmount, isNonEmptyString };
