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

**Backend** (terminal 1):

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

**Frontend** (terminal 2, a partir da Sprint 4):

```bash
cd frontend
npm install   # só na primeira vez
npm run dev
```

Abre em `http://localhost:5173`. O Vite recarrega sozinho ao salvar. Chamadas
a `/api/...` são redirecionadas para o backend (3001) via proxy — por isso os
dois precisam estar rodando ao mesmo tempo.

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

## Padrão de código do frontend

```
frontend/
├── vite.config.ts     # proxy /api -> :3001
├── index.html
└── src/
    ├── main.tsx        # ponto de entrada (createRoot)
    ├── App.tsx         # layout + navegação (telas entram aqui)
    ├── index.css       # estilos globais (CSS puro, sem lib de UI)
    ├── types.ts        # interfaces espelhando as respostas da API
    ├── api.ts          # funções fetch para o backend (1 por endpoint)
    └── pages/          # 1 arquivo por tela
        └── Reservas.tsx
```

Telas em `pages/` chamam as funções de `api.ts`; sem gerenciador de estado
externo (só `useState`/`useEffect`). Novas telas: criar em `pages/` e ligar no
`App.tsx`.

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

**Importante — dois conceitos separados de "status":**

- O campo `status` ('pending'|'complete') é sobre **completude dos dados**:
  `pending` = reserva veio do iCal e ainda **falta preencher** nome/valor;
  `complete` = dados preenchidos. **Não** significa "estadia finalizada". A
  reserva é **sempre editável**.
- O **status da estadia** (Futura → Em andamento → Finalizada) é **derivado da
  data no frontend** (não é armazenado): vira **Finalizada** só após as **11:00
  do dia do checkout**. Não confundir com o campo `status`.

## Roadmap

| Sprint | Objetivo | Status |
|---|---|---|
| 1 | Backend: SQLite + CRUD de reservas/despesas/settings via API REST | ✅ Concluída |
| 2 | Backend: fechamento financeiro (`GET /api/finance/closing`) — receita − despesas, split host%/dono% | ✅ Concluída |
| 3 | Backend: sync com iCal do Airbnb (`POST /api/reservations/sync`) — cria reservas `pending` a partir das datas (iCal só traz datas, sem nome/valor) | ✅ Concluída |
| 4 | Frontend: React (Vite) + tela de Reservas (listar, sincronizar, completar pendências) | ✅ Concluída |
| 5 | Frontend: telas de Despesas e Fechamento Mensal | 🔜 Próxima |
| 6 | Frontend: tela de Configurações + navegação | Planejada |
| 7 | Geração de Pix copia-e-cola no fechamento, com valor do split | Planejada |
| 8 | RPA (Playwright) do cadastro de visitantes no portal do **Condomínio Dedicado**, disparado pela UI | Planejada |

Não implementar funcionalidades de sprints futuras antes da hora.

## Sprint 8 — RPA do Condomínio Dedicado (detalhes)

Automação do cadastro de hóspedes no app do condomínio (**Condomínio
Dedicado**), disparada pela UI. Ainda **não implementar** — documentação
levantada com antecedência.

- **Ferramenta:** **Playwright** (headless). O Condomínio Dedicado tem
  **portal web** (não só app mobile) — confirmado —, então não é preciso
  Appium nem engenharia reversa da API mobile.
- **URL de login:**
  `https://app.condominiodedicado.com.br/morador/default/seguranca/principal`
- **Formulário de login:** simples — campos **E-mail** e **Senha**, botão
  **ENTRAR**. Sem captcha visível na tela inicial (validar na prática na hora
  de implementar).
- **Funcionalidade alvo:** **"Registro de visitantes"**, dentro da área do
  morador logado.

### Fluxo planejado

1. Playwright abre o navegador (headless) e acessa a URL de login.
2. Preenche e-mail e senha lidos de **variáveis de ambiente** (nunca
   hardcoded no código nem versionados no Git).
3. Clica em **ENTRAR**.
4. Navega até **Registro de visitantes**.
5. Preenche os dados do hóspede (nome, datas) vindos de uma reserva já
   completa no banco (`status = 'complete'`).
6. Salva o cadastro.
7. Chama a própria API do projeto: `PATCH /api/reservations/:id`
   com `{ "condoRegistered": true }`.

### Pontos de atenção

- **Credenciais** do Condomínio Dedicado ficam em um `.env` local, **fora do
  controle de versão** (adicionar `.env` ao `.gitignore` quando chegarmos
  nesta sprint).
- **É o script mais frágil do projeto:** se o Condomínio Dedicado mudar o
  layout do login ou do formulário de registro de visitantes, os seletores do
  Playwright quebram e precisam de ajuste.
- **Termos de uso:** antes de implementar de fato, checar rapidamente os
  termos do Condomínio Dedicado quanto a automação de acesso. Como é acesso
  com credencial própria e vínculo legítimo com o condomínio, o risco é baixo,
  mas convém confirmar.

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
