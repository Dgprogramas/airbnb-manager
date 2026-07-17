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

**Atalho (recomendado):** na raiz do projeto, `npm install` (primeira vez) e
depois `npm run dev` — sobe backend e frontend juntos via `concurrently`.

**Backend** (terminal 1):

```bash
cd backend
npm install   # só na primeira vez (ou quando mudarem as dependências)
npm run dev   # node --watch: recarrega sozinho ao salvar (ou npm start, sem watch)
```

Sobe em `http://localhost:3001`. O banco é criado automaticamente em
`backend/data/airbnb-manager.db` na primeira execução (esse diretório está no
`.gitignore` — nunca commitar o `.db`). O aviso
`ExperimentalWarning: SQLite is an experimental feature` é esperado. A raiz `/`
não tem rota; os endpoints ficam sob `/api/...`. Com `npm start` (sem watch),
reinicie o servidor após mudar o código do backend.

No start, o servidor cria um **backup diário** do banco em
`backend/data/backups/` (via `VACUUM INTO`, mantém os últimos 7). A variável
`AIRBNB_DB_PATH` aponta o banco para outro arquivo (ou `:memory:`) — usada
pelos testes e útil para testar a API sem tocar nos dados reais.

**Testes do backend:** `cd backend && npm test` (usa `node:test` nativo e
banco em memória; não precisa de servidor rodando).

**Cuidado ao testar a API manualmente:** se já houver um servidor antigo na
porta 3001, um `node src/server.js` novo morre com `EADDRINUSE` — e os curls
vão bater no servidor velho (código desatualizado, banco real). Para testar,
use porta e banco próprios: `AIRBNB_DB_PATH=/tmp/teste.db PORT=3999 node
src/server.js`.

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
├── validation.js      # validadores compartilhados pelas rotas (datas, mês, valores)
├── db/
│   ├── schema.sql     # schema das tabelas
│   ├── connection.js  # conexão SQLite (singleton getDb() + migrações de coluna)
│   └── backup.js      # backup diário via VACUUM INTO (mantém os últimos 7)
├── repositories/      # 1 arquivo por entidade: create/list/update/get...
│   │                  # convertem snake_case (SQLite) ↔ camelCase (JS)
│   ├── reservations.js
│   ├── expenses.js
│   └── settings.js
├── services/          # regras de negócio que combinam repositórios
│   ├── finance.js     # fechamento financeiro (Sprint 2)
│   ├── ical-sync.js   # sync do iCal via node-ical (Sprint 3)
│   └── condo-rpa.js   # RPA Playwright do cadastro no condomínio (Sprint 8c)
└── routes/            # cada arquivo exporta um express.Router()
    ├── reservations.js
    ├── expenses.js
    ├── settings.js
    └── finance.js

backend/scripts/
└── register-condo.js  # teste manual do condo-rpa.js com navegador visível
```

Testes em `backend/tests/*.test.js` (`node:test` + banco em memória via
`AIRBNB_DB_PATH=':memory:'`, setado **antes** de qualquer require).

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
reservations: id, guest_name, guest_document, checkin_date, checkout_date,
              checkin_time, checkout_time, gross_amount,
              condo_registered, apartment_info_sent,
              status ('pending'|'complete'), source ('manual'|'airbnb-ical'),
              ical_uid, cancelled_at, created_at

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
  data no frontend** (não é armazenado): vira **Finalizada** só após o horário
  de `checkout_time` (padrão `11:00`) do dia do checkout. Não confundir com o
  campo `status`.
- **`cancelled_at`** é um terceiro conceito: o sync marca a reserva como
  cancelada quando o evento dela **some do feed iCal** (só reservas de
  `source='airbnb-ical'` com check-in de hoje em diante — eventos passados
  saem do feed naturalmente e não são cancelamento). Reserva cancelada fica
  fora do fechamento financeiro e aparece esmaecida na UI com selo
  "Cancelada".

**Sync do iCal:** o feed do Airbnb traz eventos "Reserved" (reservas) e
"Airbnb (Not available)" (datas bloqueadas manualmente). O sync **ignora os
bloqueios** (não viram reserva) e reporta `blockedCount`/`cancelledCount` além
de `createdCount`/`skippedCount`.

## Roadmap

| Sprint | Objetivo | Status |
|---|---|---|
| 1 | Backend: SQLite + CRUD de reservas/despesas/settings via API REST | ✅ Concluída |
| 2 | Backend: fechamento financeiro (`GET /api/finance/closing`) — receita − despesas, split host%/dono% | ✅ Concluída |
| 3 | Backend: sync com iCal do Airbnb (`POST /api/reservations/sync`) — cria reservas `pending` a partir das datas (iCal só traz datas, sem nome/valor) | ✅ Concluída |
| 4 | Frontend: React (Vite) + tela de Reservas (listar, sincronizar, completar pendências) | ✅ Concluída |
| 5 | Frontend: telas de Despesas e Fechamento Mensal | ✅ Concluída |
| 6 | Frontend: tela de Configurações + navegação entre abas | ✅ Concluída |
| 7 | Geração de Pix copia-e-cola no fechamento, com valor do split | 🔜 Próxima |
| 8 | RPA (Playwright) do cadastro de visitantes no portal do **Condomínio Dedicado**, disparado pela UI | 🚧 Em andamento (8a/8b/8c concluídas — falta 8d/8e) |
| 9 | Histórico de fechamentos persistido (tabela `closings`: mês, valores, pago/pendente) — protege contra recálculo retroativo se o split% mudar | Ideia |
| 10 | Template de mensagem de check-in p/ WhatsApp (placeholders + botão wa.me / copiar) — automatiza o "enviar infos do apê" sem RPA | Ideia |
| 11 | Dashboard: ocupação, receita por mês, diária média; alertas de check-in próximo sem condomínio/info | Ideia |

Não implementar funcionalidades de sprints futuras antes da hora.

## Sprint 8 — RPA do Condomínio Dedicado (detalhes)

Automação do cadastro de hóspedes no portal do condomínio (**Condomínio
Dedicado**), disparada pela UI. Dividida em sub-sprints; progresso abaixo.

- **8a — Modelo de dados + formulário** ✅ Concluída. `reservations` ganhou
  `guest_document` (RG), `checkin_time`/`checkout_time` (defaults `14:00`/
  `11:00`). Formulário de Reservas no frontend preenche esses campos.
- **8b — Mapeamento do portal** ✅ Concluída. Ver `docs/condo-portal-map.md`
  — fluxo de telas, campos e seus mapeamentos para `reservations`, levantado
  a partir de prints reais (sem inspeção de DOM ainda).
- **8c — Script Playwright standalone** ✅ Concluída e **testada ao vivo com
  sucesso** (cadastro real de hóspede sem acompanhante, 1 pessoa).
  `backend/src/services/condo-rpa.js` (`registerGuest`) + script manual
  `backend/scripts/register-condo.js` + script de inspeção
  `backend/scripts/inspect-condo-portal.js` (gera snapshot do HTML real do
  form, usado pra descobrir os seletores certos). Ainda não toca no banco
  além de ler a reserva — `condoRegistered` continua manual até a 8d.
- **8d — Integração API + UI** 🔜 Próxima. Escopo combinado em 16/07:
  - Rota `POST /api/reservations/:id/register-condo` — valida que a reserva
    tem RG/horários preenchidos, chama `registerGuest`, e em caso de sucesso
    faz o `PATCH` interno pra marcar `condoRegistered = true`. Lock em
    memória pra não rodar duas automações ao mesmo tempo.
  - **UI:** o checkbox "Cadastrado no condomínio" na tabela de Reservas vira
    um **botão "Cadastrar"**. Ao clicar, abre um **modal** com: (1) aviso
    resumindo os dados que serão usados (nome, RG, datas, horários — vindos
    da própria reserva, sem redigitar), e (2) campos opcionais extras que o
    portal aceita (Modelo, Placa, Cor do veículo — não persistidos em
    `reservations` hoje, então precisa decidir se viram colunas novas ou só
    inputs transientes do modal). Confirmar no modal dispara a chamada à
    rota acima, com estado de loading (~15–30s) e feedback de sucesso/erro.
  - **Validação:** o botão "Cadastrar" (ou a confirmação no modal) precisa
    bloquear o cadastro se faltar RG/horários na reserva, com mensagem clara
    do que falta preencher.
  - Em aberto: a coluna "Info enviada" (`apartmentInfoSent`) muda também?
    Hoje não tem automação associada a ela (isso é a Sprint 10, sem RPA) —
    confirmar se ela continua como checkbox manual ou se essa sprint mexe
    nela também.
- **8e — Robustez** Planejada. Timeout global, testes com Playwright
  mockado, distinguir erro de sessão/credencial de mudança de layout, lidar
  com acompanhantes (a `registerGuest` já é reaproveitável em loop — falta
  decidir onde guardar os dados de cada acompanhante no banco).

### Como o portal funciona (resumo — detalhes em `docs/condo-portal-map.md`)

- **Ferramenta:** Playwright (Chromium). O Condomínio Dedicado tem portal web
  em `https://app.condominiodedicado.com.br` — não precisa Appium.
- **Login:** tela "Acesso do morador" — campos **E-mail** e **Senha**, botão
  **ENTRAR**. Sem captcha/2FA observado.
- **Funcionalidade usada:** **Morador → Autorizações → + Novo** (não
  "Registro de visitantes" — nome revisado após ver o portal de verdade).
  Tipo de autorização usado: **"Acesso A Unidade"**.
- **Campos do formulário:** Número do RG, Nome do autorizado, Tipo da
  autorização, período (De/Até) e horário (Das/Às) — todos obrigatórios.
- Ao terminar o cadastro no portal, o próximo passo (Sprint 8d) chama
  `PATCH /api/reservations/:id` com `{ "condoRegistered": true }`.

### Pontos de atenção

- **Credenciais** ficam em `backend/.env` (copiar de `backend/.env.example`),
  fora do controle de versão. Rodar com
  `cd backend && npm run register-condo -- <reservationId>`.
- **É o script mais frágil do projeto:** os seletores de `condo-rpa.js` são
  ids reais confirmados via `inspect-condo-portal.js` (não mais suposição
  visual), mas ainda podem quebrar se o Condomínio Dedicado mudar o HTML.
  Rodar com `headless: false` (como faz o `register-condo.js`) pra
  acompanhar. Falhas salvam screenshot em `backend/data/rpa-logs/` (fora do
  Git). **Detalhe já mapeado:** o nome do hóspede aparece **abreviado** na
  listagem do portal (maiúsculas + nomes do meio viram uma letra) — não usar
  o nome pra validar sucesso, usar `#btn-option-new` voltando a ficar
  visível.
- **Termos de uso:** ainda não revisados formalmente quanto a automação de
  acesso. Risco considerado baixo (credencial própria, vínculo legítimo com o
  condomínio), mas confirmar antes de rodar em produção com frequência.

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
