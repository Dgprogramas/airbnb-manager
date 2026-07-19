# Mapa do portal Condomínio Dedicado (Sprint 8b)

Levantamento do fluxo de cadastro de visitante, feito a partir de prints
reais do portal (16/07/2026) e, depois, de um snapshot real do HTML gerado
por `backend/scripts/inspect-condo-portal.js` (confirma os seletores usados
em `backend/src/services/condo-rpa.js`).

## 1. Login

URL: `https://app.condominiodedicado.com.br` (redireciona para a tela
"Acesso do morador" quando não autenticado).

Campos:
- **E-mail** — input de texto, placeholder "E-mail...".
- **Senha** — input de senha (ícone de cadeado), sem placeholder visível no
  print (autofill do navegador escondeu).
- Botão **ENTRAR** — laranja, largura total do card.

Sem captcha nem 2FA visíveis nesse fluxo. Link "Outras senhas..." aparece
como sugestão de autofill do Safari, não faz parte do form do portal.

## 2. Navegação até o formulário

Após login, cai na Home ("Principal"). Menu lateral esquerdo:

```
Morador
├── Consultar
├── Animal de Estimação
├── Automóvel
├── Prestador de Serviço
└── Autorizações   ← é este
```

Clicar em **Morador** expande o submenu; clicar em **Autorizações** leva para
`Morador :: Autorizações` — uma lista das autorizações já cadastradas
(coluna Autorizado / Morador / Apartamento / Faixa de datas), com botão
azul **+ Novo** no topo que abre o formulário de cadastro.

## 3. Formulário "Morador :: Autorizações" (novo registro)

Título da seção: **Dados da autorização**.

| Campo | Obrigatório | Tipo | id/name real | Observação |
|---|---|---|---|---|
| Número do RG | Sim (*) | texto | `#nu_documento` | classe `validate[required]` confirma obrigatório |
| Nome do autorizado (a) | Sim (*) | texto | `#no_autorizacao` | classe `validate[required]` |
| Tipo da autorização | Sim (*) | `<select>` | `#id_morador_autorizacao_tipo` | opções (por `value`): `""`=Selecione, `"425"`=**Acesso A Unidade**, `"427"`=Outros, `"426"`=Retirar Correspondência. Usar sempre `"425"` para hóspedes |
| Modelo | Não | texto | `#no_modelo` | campo de veículo, fora do escopo |
| Placa | Não | texto | `#nu_placa` | idem |
| Cor | Não | texto | `#no_cor` | idem |
| Descrição de autorização | Não | textarea | `#ds_autorizacao` | não usado no fluxo automatizado |

Segunda seção: **Período da autorização**.

| Campo | Obrigatório | Tipo | id/name real | Observação |
|---|---|---|---|---|
| De | Sim (*) | data (DD/MM/AAAA) | `#dt_periodo_inicio` | data de início — check-in. Widget jQuery UI datepicker (classe `hasDatepicker`); vem pré-preenchido com a data de hoje por padrão |
| Até | Sim (*) | data (DD/MM/AAAA) | `#dt_periodo_fim` | data de fim — check-out. Mesmo widget |
| Das | Sim (*) | hora (texto livre, não `<input type="time">`) | `#hr_periodo_inicio` | horário de início — check-in |
| Às | Sim (*) | hora (texto livre) | `#hr_periodo_fim` | horário de fim — check-out |

Botões: **Voltar** (cinza), **Salvar** (`#btn-option-save`, verde). O botão
que abre este formulário a partir da listagem é `#btn-option-new` ("+ Novo").

## 4. Validação

Ao clicar em Salvar com campos obrigatórios vazios, o portal mostra tooltips
inline "Este campo é obrigatório" próximos a cada campo faltante — não há
alert/confirm de navegador (bom para automação: não bloqueia a página).

## 5. Após salvar

Volta para a lista de Autorizações, com o novo registro no topo, mostrando:
`#<id> — <nome> — de: DD/MM/AAAA até: DD/MM/AAAA - das: HH:MM às: HH:MM`,
associado ao morador logado e ao apartamento dele.

**O nome exibido na listagem é abreviado** (maiúsculas + nomes do meio
reduzidos a uma letra) — ex.: "Helenice Aparecida da Silva" aparece como
"HELENICE A DA SILVA". Confirmado em teste real: **não dá pra validar
sucesso comparando o nome enviado com o texto da listagem**. O sinal de
sucesso confiável usado em `condo-rpa.js` é o botão `#btn-option-new`
("+ Novo", escondido enquanto o formulário está aberto) voltar a ficar
visível — indica que voltamos pra listagem.

## Mapeamento reserva → formulário

| Campo do portal | Origem no nosso banco (`reservations`) |
|---|---|
| Número do RG | `guest_document` |
| Nome do autorizado (a) | `guest_name` |
| Tipo da autorização | fixo: "Acesso A Unidade" |
| De | `checkin_date` |
| Até | `checkout_date` |
| Das | `checkin_time` |
| Às | `checkout_time` |

## Pendências

- **Seletores DOM reais**: ✅ confirmados via `inspect-condo-portal.js` (ver
  tabelas acima). `getByLabel` não funcionava — a associação label→input do
  portal não é confiável (um teste real mostrou `getByLabel(/Tipo da
  autorização/i)` resolvendo para `#no_modelo`, o campo errado).
- **Confirmação de sucesso ao salvar**: ✅ resolvido — o sinal confiável é o
  `#btn-option-new` voltar a ficar visível (ver seção 5).
- **Datepicker (`#dt_periodo_inicio`/`#dt_periodo_fim`)**: ✅ resolvido — o
  script seta o valor direto via JS (`evaluate` + eventos `input`/`change`),
  **sem focar o campo**. Usar `.fill()` abria o popup do calendário
  (`#ui-datepicker-div`), que em headless fica por cima de outros campos e
  intercepta os cliques seguintes (falha real vista na 8e). Antes de clicar
  em Salvar, o script também esconde `#toast-container` e
  `#ui-datepicker-div`, que podem sobrepor o botão.
- **Nenhum termo de uso foi revisado ainda** quanto à automação de acesso —
  item do CLAUDE.md ainda pendente antes de rodar o robô em produção.
