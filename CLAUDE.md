# CLAUDE.md

Contexto do projeto para o Claude Code. Leia antes de mexer no código.

## Visão geral

Aplicação **local com interface (UI)** para automatizar dois fluxos manuais da
gestão de um Airbnb:

1. **Check-in de hóspedes:** pedir dados do hóspede, cadastrá-lo no app do
   condomínio e enviar informações do apartamento.
2. **Fechamento financeiro mensal:** pagar contas fixas (luz, condomínio,
   internet, funcionária), reter uma porcentagem do que sobra (hoje 30%) e
   repassar o restante ao dono do imóvel (o pai do host).

Construída em **sprints pequenas e incrementais**, cada uma com critério de
"pronto" testável. Não pular etapas; abordar uma sprint por vez.

## Decisões de arquitetura (não mudar sem perguntar)

- **Local, não em nuvem.** Backend e frontend rodam na máquina do usuário.
- **Dependências:** abordagem **pragmática** — usar bibliotecas npm quando
  ajudarem de verdade (não perseguir "zero dependências"). O projeto começou
  100% nativo e foi modernizado depois.
- **Backend:** Node.js + **Express** (roteamento), `cors` (CORS) e `node-ical`
  (parse do iCal). **Node.js 22.5+** obrigatório.
- **Banco:** SQLite via `node:sqlite` (`DatabaseSync`) — mantido por já
  funcionar; a API é igual à do `better-sqlite3`, então trocar depois é
  trivial se necessário.
- **Frontend:** **React + Vite + TypeScript** (a partir da Sprint 4),
  consumindo a API REST. Roda em `http://localhost:5173` com proxy `/api`
  para o backend.

## Como rodar

```bash
cd backend
npm install   # só na primeira vez (ou quando mudarem as dependências)
node src/server.js
```

Sobe em `http://localhost:3001`. O banco é criado automaticamente em
`backend/data/airbnb-manager.db` na primeira execução (esse diretório está no
`.gitignore` — nunca commitar o `.db`). O aviso
`ExperimentalWarning: SQLite is an experimental feature` é esperado. A raiz `/`
não tem rota; os endpoints ficam sob `/api/...`. Reinicie o servidor após
mudar o código do backend (o Node não recarrega sozinho).

## Padrão de código do backend

```
backend/src/
├── server.js          # app Express: middlewares + monta os routers em /api
├── db/
│   ├── schema.sql     # schema das tabelas
│   └── connection.js  # conexão SQLite (singleton getDb())
├── repositories/      # 1 arquivo por entidade: create/list/update/get...
│   │                  # convertem snake_case (SQLite) ↔ camelCase (JS)
│   ├── reservations.js
│   ├── expenses.js
│   └── settings.js
├── services/          # regras de negócio que combinam repositórios
│   ├── finance.js     # fechamento financeiro (Sprint 2)
│   └── ical-sync.js   # sync do iCal via node-ical (Sprint 3)
└── routes/            # cada arquivo exporta um express.Router()
    ├── reservations.js
    ├── expenses.js
    ├── settings.js
    └── finance.js
```

Fluxo: `routes/` (Express Router) → `services/` (quando há regra de negócio)
ou `repositories/` → banco. Erros lançados sobem para o handler de erro central
no `server.js`, que responde JSON com o status apropriado.

## Modelo de dados

```
reservations: id, guest_name, checkin_date, checkout_date, gross_amount,
              condo_registered, apartment_info_sent,
              status ('pending'|'complete'), source ('manual'|'airbnb-ical'),
              ical_uid, created_at

expenses:     id, month ('YYYY-MM'),
              category ('luz'|'condominio'|'internet'|'funcionaria'|'outro'),
              amount, description, created_at

settings:     host_split_percent (padrão 30), owner_name (padrão 'Pai'), ical_url
```

## Roadmap

| Sprint | Objetivo | Status |
|---|---|---|
| 1 | Backend: SQLite + CRUD de reservas/despesas/settings via API REST | ✅ Concluída |
| 2 | Backend: fechamento financeiro (`GET /api/finance/closing`) — receita − despesas, split host%/dono% | ✅ Concluída |
| 3 | Backend: sync com iCal do Airbnb (`POST /api/reservations/sync`) — cria reservas `pending` a partir das datas (iCal só traz datas, sem nome/valor) | ✅ Concluída |
| 4 | Frontend: React (Vite) + tela de Reservas (listar, sincronizar, completar pendências) | 🔜 Próxima |
| 5 | Frontend: telas de Despesas e Fechamento Mensal | Planejada |
| 6 | Frontend: tela de Configurações + navegação | Planejada |
| 7 | Geração de Pix copia-e-cola no fechamento, com valor do split | Planejada |
| 8 | RPA (Playwright) do cadastro no condomínio, disparado pela UI | Planejada |

Não implementar funcionalidades de sprints futuras antes da hora.

## Padrão de commits

Padrão do iuricode (https://github.com/iuricode/padroes-de-commits):
formato `emoji tipo: descrição`, descrição curta em português.

| tipo | emoji | uso |
|------|-------|-----|
| feat | ✨ | nova funcionalidade |
| fix | 🐛 | correção de bug |
| docs | 📚 | documentação |
| test | 🧪 | testes |
| build | 📦 | build / dependências |
| perf | ⚡ | performance |
| style | 👌 | formatação (sem mudar lógica) |
| refactor | ♻️ | refatoração sem mudar comportamento |
| chore | 🔧 | tarefas de build, configs, pacotes |
| ci | 🧱 | integração contínua |
| raw | 🗃️ | arquivos de config/dados/parâmetros |
| cleanup | 🧹 | remover código comentado/desnecessário |
| remove | 🗑️ | excluir arquivos/funcionalidades obsoletos |

Exemplos: `✨ feat: endpoint de fechamento`, `🐛 fix: corrige split`.
