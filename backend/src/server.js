'use strict';

const http = require('http');
const { URL } = require('url');
const { sendJson, readJsonBody } = require('./http-helpers');

const reservationRoutes = require('./routes/reservations');
const expenseRoutes = require('./routes/expenses');
const settingsRoutes = require('./routes/settings');
const financeRoutes = require('./routes/finance');

const PORT = process.env.PORT || 3001;

// Cada rota: [método, segmentos do path (':id' = parâmetro), handler]
const routes = [
  ['GET', ['api', 'health'], async (req, res) => sendJson(res, 200, { status: 'ok' })],

  ['GET', ['api', 'reservations'], reservationRoutes.listReservations],
  ['POST', ['api', 'reservations'], reservationRoutes.createReservation],
  ['POST', ['api', 'reservations', 'sync'], reservationRoutes.syncReservations],
  ['GET', ['api', 'reservations', ':id'], reservationRoutes.getReservation],
  ['PATCH', ['api', 'reservations', ':id'], reservationRoutes.updateReservation],

  ['GET', ['api', 'expenses'], expenseRoutes.listExpenses],
  ['POST', ['api', 'expenses'], expenseRoutes.createExpense],

  ['GET', ['api', 'settings'], settingsRoutes.getSettings],
  ['PATCH', ['api', 'settings'], settingsRoutes.updateSettings],

  ['GET', ['api', 'finance', 'closing'], financeRoutes.getClosing],
];

function matchRoute(method, pathSegments) {
  for (const [routeMethod, routeSegments, handler] of routes) {
    if (routeMethod !== method) continue;
    if (routeSegments.length !== pathSegments.length) continue;

    const params = {};
    let matched = true;

    for (let i = 0; i < routeSegments.length; i += 1) {
      const routeSeg = routeSegments[i];
      const pathSeg = pathSegments[i];
      if (routeSeg.startsWith(':')) {
        params[routeSeg.slice(1)] = pathSeg;
      } else if (routeSeg !== pathSeg) {
        matched = false;
        break;
      }
    }

    if (matched) return { handler, params };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const segments = url.pathname.split('/').filter(Boolean);

  if (req.method === 'OPTIONS') {
    // resposta simples para preflight de CORS (app local consumida pelo React)
    sendJson(res, 204, {});
    return;
  }

  const match = matchRoute(req.method, segments);
  if (!match) {
    sendJson(res, 404, { error: `Rota não encontrada: ${req.method} ${url.pathname}` });
    return;
  }

  try {
    await match.handler(
      req,
      res,
      { query: url.searchParams, params: match.params },
      { sendJson, readJsonBody }
    );
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Airbnb Manager API rodando em http://localhost:${PORT}`);
});
