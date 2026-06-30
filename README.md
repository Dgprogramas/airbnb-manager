# Airbnb Manager

Aplicação local (com UI em React, a partir da Sprint 4) para automatizar a
gestão de reservas, cadastro no condomínio e fechamento financeiro do Airbnb.

## Status: Sprint 1 concluída — Backend com banco de dados + CRUD

O que existe até agora é só o **backend** (API). A interface visual entra
na Sprint 4. Por enquanto, testa-se via `curl` ou Postman.

### Stack desta sprint

- **Node.js 22.5+** (usa o módulo nativo `node:sqlite` — **zero dependências
  externas**, não precisa rodar `npm install`)
- Servidor HTTP nativo (`http` do Node), sem framework

### Como rodar

```bash
cd backend
node src/server.js
```

Servidor sobe em `http://localhost:3001`. O banco SQLite é criado
automaticamente em `backend/data/airbnb-manager.db` na primeira execução.

> Se aparecer `ExperimentalWarning: SQLite is an experimental feature`,
> é esperado — é uma feature nova do Node, mas estável o suficiente para
> uso local. Se sua versão do Node for anterior à 22.5, me avisa que troco
> para `better-sqlite3` via npm.

### Endpoints disponíveis

**Reservas**
```
GET    /api/reservations?month=2026-07&pendingOnly=true
POST   /api/reservations
  body: { guestName, checkinDate, checkoutDate, grossAmount }
PATCH  /api/reservations/:id
  body: campos a atualizar, ex: { condoRegistered: true }
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
├── data/                          # gerado automaticamente (banco SQLite)
└── src/
    ├── server.js                  # servidor HTTP + roteador
    ├── http-helpers.js            # resposta JSON e leitura do body
    ├── db/
    │   ├── schema.sql              # definição das tabelas
    │   └── connection.js           # conexão com o SQLite
    ├── repositories/
    │   ├── reservations.js
    │   ├── expenses.js
    │   └── settings.js
    └── routes/
        ├── reservations.js
        ├── expenses.js
        └── settings.js
```

## Próximas sprints

- **Sprint 2:** endpoint de fechamento financeiro (`GET /api/finance/closing`)
- **Sprint 3:** sincronização automática com o iCal do Airbnb
- **Sprint 4:** setup do React + primeira tela (Reservas)
