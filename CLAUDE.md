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
  (parse do iCal). **Node.js 22.9+** obrigatório (o `npm run dev`/`start`
  carrega o `backend/.env` via `--env-file-if-exists`).
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
| 8 | RPA (Playwright) do cadastro de visitantes no portal do **Condomínio Dedicado**, disparado pela UI | 🚧 Em andamento (8a–8d concluídas; 8e parcial — falta só acompanhantes) |
| 9 | Histórico de fechamentos persistido (tabela `closings`: mês, valores, pago/pendente) — protege contra recálculo retroativo se o split% mudar | Ideia |
| 10 | Template de mensagem de check-in p/ WhatsApp (placeholders + botão wa.me / copiar) — automatiza o "enviar infos do apê" sem RPA | Ideia |
| 11 | Dashboard: ocupação, receita por mês, diária média; alertas de check-in próximo sem condomínio/info | Ideia |
| 12 | Seção "Últimas reservas" na tela de Reservas: estadias já finalizadas saem da tabela principal e vão pra uma seção própria abaixo, agrupadas por mês e recolhidas por padrão — a tabela principal fica só com o que precisa de ação (futuras/em andamento). Frontend-only: separa client-side pelo status derivado da estadia (Finalizada), reusando groupByMonth/HeightCollapse | Ideia (planejada em 18/07) |
| 13 | Importação do relatório de ganhos do Airbnb (CSV) — `POST /api/reservations/import-csv` + botão "Importar CSV" na tela de Reservas. Complementa o iCal (que só traz datas e perde reservas passadas assim que saem do feed): o CSV traz nome e valor, e recupera histórico | ✅ Concluída (18/07) |

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
  form, usado pra descobrir os seletores certos).
- **8d — Integração API + UI** ✅ Concluída (18/07). Escopo implementado:
  - Rota `POST /api/reservations/:id/register-condo` (`routes/reservations.js`)
    valida que a reserva tem RG e horários preenchidos, rejeita se já estiver
    `condoRegistered`, chama `registerGuest` e, em caso de sucesso, faz o
    `update` interno marcando `condoRegistered = true`. Lock em memória
    (`Set` de ids) evita duas automações concorrentes na mesma reserva —
    responde `409` se já houver uma em andamento. Erros de RPA
    (`CondoRpaError`) voltam como `502` com a mensagem de erro.
  - `registerGuest` (`condo-rpa.js`) ganhou parâmetros opcionais
    `vehicleModel`/`vehiclePlate`/`vehicleColor`, preenchidos no formulário
    (`#no_modelo`/`#nu_placa`/`#no_cor`) só quando informados.
  - **UI:** o checkbox "Cadastrado no condomínio" na tabela de Reservas virou
    um **botão "Cadastrar"** (some quando `condoRegistered` já é `true`,
    voltando a mostrar o check verde). Clicar abre um **modal** (overlay na
    própria tela de Reservas, sem navegação) com: (1) resumo dos dados que
    serão usados (nome, RG, datas, horários — vindos da própria reserva,
    sem redigitar) e (2) campos opcionais de veículo (Modelo, Placa, Cor).
    Confirmar dispara a chamada à rota acima com estado de loading
    (~15–30s) e feedback de sucesso/erro dentro do próprio modal.
  - **Decisão:** Modelo/Placa/Cor ficam **transientes** — não viram colunas
    em `reservations`, só são enviados pro portal no momento do cadastro.
  - **Decisão:** a coluna "Info enviada" (`apartmentInfoSent`) **não muda**
    nessa sprint — continua checkbox manual (sem automação associada; isso
    é escopo da Sprint 10, template de WhatsApp).
  - **Validação:** front bloqueia a abertura do modal (mensagem de erro
    listando o que falta) se a reserva não tiver RG ou horários; o backend
    valida de novo por segurança.
- **8e — Robustez** 🚧 Parcial (18/07). **Feito:**
  - **Timeout global** (`globalTimeoutMs`, default 120s) além do per-action do
    Playwright — protege contra travamento fora de uma ação (aba presa).
  - **Fases nomeadas** no `CondoRpaError` (`phase`: `config`/`login`/
    `navigation`/`form`/`submit`/`timeout`) — distinguem erro de credencial
    (aponta pro `.env`) de mudança de layout (seletor sumiu). A rota mapeia
    `config` → HTTP 400 e o resto → 502, com a fase no corpo da resposta.
  - **Detecção de login**: confirma que o menu "Morador" aparece pós-login;
    se não, erro de fase `login` (credencial/portal fora do ar), não `form`.
  - **Testes mockados** (`backend/tests/condo-rpa.test.js`): launcher fake
    injetado via `options.launcher` grava a sequência de ações sem abrir o
    Chrome — cobre caminho feliz, campos de veículo, falta de credencial/RG,
    falha de login, mudança de layout e timeout global (7 casos).
  - **Falta (adiado):** acompanhantes — cadastrar vários hóspedes por reserva
    reusando `registerGuest` em loop; pendente decidir onde guardar os dados
    de cada acompanhante (tabela nova vs. JSON numa coluna).

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
- Ao terminar o cadastro no portal, `POST /api/reservations/:id/register-condo`
  marca `condoRegistered = true` automaticamente (Sprint 8d).

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

## Sprint 13 — Importação do CSV de ganhos do Airbnb (detalhes)

**Motivação:** o Airbnb não tem API pública para host individual (só para
parceiros de software com contrato). O único canal "oficial" é o iCal — mas
o feed do Airbnb só traz reservas atuais/futuras: assim que o checkout de
uma reserva passa, o evento **some do feed sozinho** (`ical-sync.js` já trata
isso como comportamento esperado, não cancelamento). Resultado: reservas já
finalizadas nunca são recuperadas por sync, e o iCal também não traz nome
nem valor (só datas) mesmo para as que ainda estão no feed.

RPA no painel do Airbnb foi descartado: diferente do portal do condomínio,
o Airbnb é um alvo muito mais hostil (2FA/captcha, detecção de automação) e
o ToS proíbe scraping — risco de suspensão de conta não compensa.

**Solução adotada:** o Airbnb permite exportar o **relatório de ganhos em
CSV** (Conta → Pagamentos → Relatórios de ganhos), que traz hóspede, datas
e valor — inclusive de reservas passadas. `backend/src/services/airbnb-csv-import.js`
(`importFromCsv`) faz o parse e casa cada linha com as reservas existentes
pela `checkin_date` (o apartamento é único — não há duas reservas ativas no
mesmo dia):

- Sem correspondente → cria reserva nova (`status: 'complete'`,
  `source: 'airbnb-csv'`).
- Correspondente `pending` (veio do iCal, faltava nome/valor) → completa
  com nome e valor do CSV, mantendo `source`/`icalUid` originais.
- Correspondente já `complete` → **não sobrescreve** (evita apagar edição
  manual do usuário). Reimportar o mesmo CSV é seguro (idempotente).
- Reservas `cancelledAt` não entram no casamento por data (uma reserva nova
  pode legitimamente ocupar a data de uma cancelada).

**Parser do CSV:** próprio (RFC 4180 — aspas, vírgula dentro de campo,
CRLF), sem depender de biblioteca externa, porque a necessidade é simples
(um arquivo pequeno, sem streaming). Cabeçalhos são mapeados por apelidos
em português e inglês (a conta do Airbnb pode estar em qualquer idioma).
Datas `DD/MM/YYYY` vs `MM/DD/YYYY` são desambiguadas por heurística
olhando o arquivo inteiro (se algum dia > 12, é `DD/MM`; senão assume
`MM/DD`, formato mais comum do relatório). Valor aceita `R$ 1.234,56` e
`$1,234.56`. Quando falta a coluna de término, calcula a partir de
"noites". Linhas do mesmo código de confirmação são agregadas (ajustes de
uma mesma reserva não viram reserva duplicada).

**API:** `POST /api/reservations/import-csv` recebe `{ csv: string }` (o
conteúdo do arquivo, lido no frontend com `File.text()` — não é upload
multipart). Retorna contagens (`createdCount`/`updatedCount`/
`skippedCount`/`ignoredRows`) e as reservas criadas/atualizadas. Erros de
formato (CSV vazio, sem colunas esperadas, só cabeçalho) voltam como `400`.
`server.js` aumentou o limite do `express.json()` para `2mb` por causa do
tamanho do CSV.

**UI:** botão "Importar CSV" na tela de Reservas, ao lado de "Sincronizar
com Airbnb" — abre o seletor de arquivo do sistema (`<input type="file">`
oculto) e mostra o resultado na mesma área de mensagem/erro já usada pelo
sync do iCal.

**Testes:** `backend/tests/airbnb-csv-import.test.js` cobre criação,
completar pendente, não sobrescrever completa, idempotência, cálculo de
checkout por noites, cabeçalho PT/EN, desambiguação de data, agregação por
código de confirmação, linhas ignoradas e CSVs inválidos.

**Decisão:** iCal e CSV coexistem — o iCal continua sendo o sync "quase em
tempo real" de datas (pending), e o CSV é o complemento pra enriquecer com
nome/valor e recuperar histórico. Nenhum dos dois substitui o outro.

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
