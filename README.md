# Airbnb Manager

Aplicação local (com UI em React, a partir da Sprint 4) para automatizar a
gestão de reservas, cadastro no condomínio e fechamento financeiro do Airbnb.

## Status: Sprint 4 concluída — Frontend (tela de Reservas)

Sprints 1 a 4 concluídas. **Backend** (API) com CRUD de reservas/despesas/
configurações, fechamento financeiro mensal e sincronização com o iCal do
Airbnb. **Frontend** em React + Vite + TypeScript com a primeira tela
(Reservas): listar, sincronizar com o Airbnb e completar pendências.

### Stack do backend

- **Node.js 22.5+**
- **Express** (roteamento) + **cors** + **node-ical** (parse do iCal)
- Banco **SQLite** via `node:sqlite` (`DatabaseSync`)

### Como rodar

Precisa de **dois terminais** (backend e frontend rodando ao mesmo tempo).

**Terminal 1 — backend:**

```bash
cd backend
npm install   # só na primeira vez
node src/server.js
```

Sobe em `http://localhost:3001`. O banco SQLite é criado automaticamente em
`backend/data/airbnb-manager.db` na primeira execução. Reinicie após alterar
o código do backend.

**Terminal 2 — frontend:**

```bash
cd frontend
npm install   # só na primeira vez
npm run dev
```

Abre em `http://localhost:5173`. É essa a tela que você usa; ela fala com o
backend via proxy `/api`. O Vite recarrega sozinho ao salvar.

> Se aparecer `ExperimentalWarning: SQLite is an experimental feature`,
> é esperado — é uma feature nova do Node, mas estável o suficiente para
> uso local.

### Stack do frontend

- **React 18 + Vite + TypeScript**
- CSS puro (sem biblioteca de UI)

### Endpoints disponíveis

**Reservas**
```
GET    /api/reservations?month=2026-07&pendingOnly=true
GET    /api/reservations/:id
POST   /api/reservations
  body: { guestName, checkinDate, checkoutDate, grossAmount }
PATCH  /api/reservations/:id
  body: campos a atualizar, ex: { condoRegistered: true }
POST   /api/reservations/sync
  body: { icalUrl? }  # usa settings.icalUrl se não informado
  lê o iCal do Airbnb e cria reservas 'pending' a partir das datas;
  não duplica (dedup pelo UID do evento)
```

**Despesas**
```
GET    /api/expenses?month=2026-07
POST   /api/expenses
  body: { month, category, amount, description? }
  categorias: luz | condominio | internet | funcionaria | outro
```

**Configurações**
```
GET    /api/settings
PATCH  /api/settings
  body: { hostSplitPercent?, ownerName?, icalUrl? }
```

**Fechamento financeiro**
```
GET    /api/finance/closing?month=2026-07
  retorna: receita bruta do mês, total de despesas (com breakdown por
  categoria), saldo, valor do anfitrião (saldo × hostSplitPercent) e
  valor do dono (saldo × restante)
```

### Exemplo rápido

```bash
curl -X POST http://localhost:3001/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"guestName":"Maria Silva","checkinDate":"2026-07-21","checkoutDate":"2026-07-25","grossAmount":800}'

curl "http://localhost:3001/api/reservations?month=2026-07"
```

## Estrutura do código

```
backend/
├── package.json
├── node_modules/                  # dependências (gitignored)
├── data/                          # gerado automaticamente (banco SQLite)
└── src/
    ├── server.js                  # app Express + middlewares + routers
    ├── db/
    │   ├── schema.sql              # definição das tabelas
    │   └── connection.js           # conexão com o SQLite
    ├── repositories/
    │   ├── reservations.js
    │   ├── expenses.js
    │   └── settings.js
    ├── services/
    │   ├── finance.js              # cálculo do fechamento mensal
    │   └── ical-sync.js            # busca e interpreta o iCal do Airbnb
    └── routes/
        ├── reservations.js
        ├── expenses.js
        ├── settings.js
        └── finance.js
```

## Próximas sprints

- **Sprint 4:** setup do React (Vite) + primeira tela (Reservas)
- **Sprint 5:** telas de Despesas e Fechamento Mensal
- **Sprint 6:** tela de Configurações + navegação
