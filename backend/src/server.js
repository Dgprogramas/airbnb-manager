'use strict';

const express = require('express');
const cors = require('cors');

const reservationRoutes = require('./routes/reservations');
const expenseRoutes = require('./routes/expenses');
const settingsRoutes = require('./routes/settings');
const financeRoutes = require('./routes/finance');

const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors()); // app local, sem segredo a proteger
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/reservations', reservationRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/finance', financeRoutes);

// 404 para qualquer rota não registrada
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// Tratamento centralizado de erros: responde JSON com o status apropriado
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`Airbnb Manager API rodando em http://localhost:${PORT}`);
});
