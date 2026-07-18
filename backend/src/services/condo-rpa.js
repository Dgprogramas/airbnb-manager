'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LOGIN_URL = 'https://app.condominiodedicado.com.br';
const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'rpa-logs');

// Fases do fluxo — o campo `phase` no erro deixa claro ONDE quebrou, o que
// muda a ação do usuário: 'login' pede pra conferir credenciais; 'form'/'nav'
// sugerem que o portal mudou o layout (seletor sumiu); 'timeout' é travamento.
const PHASE = {
  CONFIG: 'config',
  LOGIN: 'login',
  NAV: 'navigation',
  FORM: 'form',
  SUBMIT: 'submit',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown',
};

// Erro do robô, com a fase onde ocorreu e (quando dá) o screenshot da falha —
// é a única pista que sobra quando o portal muda o layout.
class CondoRpaError extends Error {
  constructor(message, { phase = PHASE.UNKNOWN, screenshotPath = null } = {}) {
    super(message);
    this.name = 'CondoRpaError';
    this.phase = phase;
    this.screenshotPath = screenshotPath;
  }
}

// 'YYYY-MM-DD' -> 'DD/MM/AAAA' (formato dos campos "De"/"Até" do portal,
// visto nos prints da Sprint 8b: docs/condo-portal-map.md)
function toPortalDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

async function saveFailureScreenshot(page) {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `falha-${Date.now()}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } catch {
    return null; // uma screenshot que falha não pode mascarar o erro original
  }
}

// Roda `fn` e, se ele estourar com um erro cru do Playwright, re-etiqueta com
// a fase e uma mensagem amigável. Erros que já são CondoRpaError passam direto
// (não queremos mascarar uma classificação mais específica de dentro).
async function step(phase, message, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CondoRpaError) throw err;
    throw new CondoRpaError(`${message}: ${err.message}`, { phase });
  }
}

// Corre `promise` com um teto de tempo total. O per-action timeout do
// Playwright já limita cada passo, mas isso protege contra travamentos fora de
// uma ação (ex.: navegação presa, aba que não responde).
function withGlobalTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new CondoRpaError(
          `Tempo limite global de ${Math.round(ms / 1000)}s excedido — o portal pode estar fora do ar ou travado`,
          { phase: PHASE.TIMEOUT }
        )
      );
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Value da option "Acesso A Unidade" no <select id="id_morador_autorizacao_tipo">
// (confirmado inspecionando o HTML real — ver backend/scripts/inspect-condo-portal.js)
const TIPO_ACESSO_A_UNIDADE = '425';

// Executa a sequência de passos no portal. Separado de registerGuest pra caber
// dentro do withGlobalTimeout sem carregar a lógica de browser/screenshot.
async function runSteps(page, data) {
  const email = process.env.CONDO_EMAIL;
  const password = process.env.CONDO_PASSWORD;

  await step(PHASE.LOGIN, 'Falha ao abrir a tela de login', async () => {
    await page.goto(LOGIN_URL);
    await page.getByPlaceholder('E-mail...').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ENTRAR' }).click();
  });

  // Confirma que o login funcionou: o menu "Morador" só existe autenticado.
  // Se não aparecer, o mais provável é credencial errada / portal fora do ar —
  // não é mudança de layout, então a mensagem aponta pro .env.
  const moradorMenu = page.getByText('Morador', { exact: true });
  try {
    await moradorMenu.waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    throw new CondoRpaError(
      'Login não concluído — confira CONDO_EMAIL/CONDO_PASSWORD no .env, ou o portal pode estar fora do ar',
      { phase: PHASE.LOGIN }
    );
  }

  await step(PHASE.NAV, 'Não foi possível abrir o formulário de autorização (o portal pode ter mudado o layout)', async () => {
    await moradorMenu.click();
    await page.getByText('Autorizações', { exact: true }).click();
    await page.locator('#btn-option-new').click();
    await page.locator('#nu_documento').waitFor(); // garante que o form de fato abriu
  });

  await step(PHASE.FORM, 'Falha ao preencher o formulário (algum campo mudou de id — layout do portal)', async () => {
    await page.locator('#nu_documento').fill(data.guestDocument);
    await page.locator('#no_autorizacao').fill(data.guestName);
    await page.locator('#id_morador_autorizacao_tipo').selectOption(TIPO_ACESSO_A_UNIDADE);

    // Campos de veículo são opcionais no portal — preenche só o que veio.
    if (data.vehicleModel) await page.locator('#no_modelo').fill(data.vehicleModel);
    if (data.vehiclePlate) await page.locator('#nu_placa').fill(data.vehiclePlate);
    if (data.vehicleColor) await page.locator('#no_cor').fill(data.vehicleColor);

    // Campos de data usam um datepicker (jQuery UI); preenchemos o valor
    // direto e fechamos o popup do calendário clicando fora dele (Escape
    // sozinho não fechou de forma confiável num teste real).
    await page.locator('#dt_periodo_inicio').fill(toPortalDate(data.checkinDate));
    await page.locator('#no_autorizacao').click();
    await page.locator('#dt_periodo_fim').fill(toPortalDate(data.checkoutDate));
    await page.locator('#no_autorizacao').click();

    await page.locator('#hr_periodo_inicio').fill(data.checkinTime);
    await page.locator('#hr_periodo_fim').fill(data.checkoutTime);
  });

  await step(PHASE.SUBMIT, 'O cadastro foi enviado mas não foi possível confirmar que salvou', async () => {
    await page.locator('#btn-option-save').click();

    // Sucesso esperado: o formulário fecha e volta pra listagem, onde o
    // botão "+ Novo" (escondido enquanto o form está aberto) reaparece.
    // Não dá pra checar pelo nome do hóspede na lista: o portal abrevia o
    // nome ao exibir (ex.: "Helenice Aparecida da Silva" virou "HELENICE A
    // DA SILVA"), então uma comparação por texto exato falha mesmo com
    // sucesso real. Checar o #nu_documento sumir do DOM também não funciona
    // — ele só alterna visível/oculto por causa do popup do datepicker que
    // fica sobrando na tela. Ver docs/condo-portal-map.md.
    await page.locator('#btn-option-new').waitFor({ state: 'visible', timeout: 15000 });
  });
}

// Cadastra um hóspede como autorização de "Acesso A Unidade" no portal do
// Condomínio Dedicado (Morador > Autorizações > Novo). Os seletores dos
// campos do formulário (ids) vieram de um snapshot real do HTML do portal, não
// de suposição visual — ver form-snapshot.html gerado por inspect-condo-portal.js.
//
// options.launcher permite injetar um launcher fake nos testes (default:
// chromium do Playwright), pra exercitar a sequência sem abrir o Chrome.
async function registerGuest(
  {
    guestName,
    guestDocument,
    checkinDate,
    checkoutDate,
    checkinTime,
    checkoutTime,
    vehicleModel,
    vehiclePlate,
    vehicleColor,
  },
  { headless = true, timeoutMs = 60000, globalTimeoutMs = 120000, launcher = chromium } = {}
) {
  if (!process.env.CONDO_EMAIL || !process.env.CONDO_PASSWORD) {
    throw new CondoRpaError('CONDO_EMAIL e CONDO_PASSWORD precisam estar definidos no ambiente (.env)', {
      phase: PHASE.CONFIG,
    });
  }
  if (!guestDocument) {
    throw new CondoRpaError('guestDocument (RG) é obrigatório para o cadastro no condomínio', {
      phase: PHASE.CONFIG,
    });
  }

  const browser = await launcher.launch({ headless });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);

  const data = {
    guestName,
    guestDocument,
    checkinDate,
    checkoutDate,
    checkinTime,
    checkoutTime,
    vehicleModel,
    vehiclePlate,
    vehicleColor,
  };

  try {
    const work = runSteps(page, data);
    // Se o timeout global vencer primeiro, `work` pode rejeitar depois — o
    // .catch evita um unhandledRejection quando fecharmos o browser.
    work.catch(() => {});
    await withGlobalTimeout(work, globalTimeoutMs);
  } catch (err) {
    const screenshotPath = await saveFailureScreenshot(page);
    if (err instanceof CondoRpaError) {
      err.screenshotPath = screenshotPath;
      throw err;
    }
    throw new CondoRpaError(`Falha ao cadastrar no portal do condomínio: ${err.message}`, {
      phase: PHASE.UNKNOWN,
      screenshotPath,
    });
  } finally {
    await browser.close();
  }
}

module.exports = { registerGuest, CondoRpaError, toPortalDate, PHASE };
