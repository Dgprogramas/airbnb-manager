'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const LOGIN_URL = 'https://app.condominiodedicado.com.br';
const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'rpa-logs');

// Erro do robô, sempre com o caminho do screenshot da falha (quando possível
// tirá-lo) — é a única pista que sobra quando o portal muda o layout.
class CondoRpaError extends Error {
  constructor(message, { screenshotPath = null } = {}) {
    super(message);
    this.name = 'CondoRpaError';
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

// Value da option "Acesso A Unidade" no <select id="id_morador_autorizacao_tipo">
// (confirmado inspecionando o HTML real — ver backend/scripts/inspect-condo-portal.js)
const TIPO_ACESSO_A_UNIDADE = '425';

// Cadastra um hóspede como autorização de "Acesso A Unidade" no portal do
// Condomínio Dedicado (Morador > Autorizações > Novo). Os seletores dos
// campos do formulário (ids abaixo) vieram de um snapshot real do HTML do
// portal, não de suposição visual — ver form-snapshot.html gerado por
// inspect-condo-portal.js. Login e navegação até o formulário seguem por
// texto visível, que já se mostrou estável num teste real.
async function registerGuest(
  { guestName, guestDocument, checkinDate, checkoutDate, checkinTime, checkoutTime },
  { headless = true, timeoutMs = 60000 } = {}
) {
  const email = process.env.CONDO_EMAIL;
  const password = process.env.CONDO_PASSWORD;
  if (!email || !password) {
    throw new CondoRpaError('CONDO_EMAIL e CONDO_PASSWORD precisam estar definidos no ambiente (.env)');
  }
  if (!guestDocument) {
    throw new CondoRpaError('guestDocument (RG) é obrigatório para o cadastro no condomínio');
  }

  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    await page.goto(LOGIN_URL);
    await page.getByPlaceholder('E-mail...').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'ENTRAR' }).click();

    await page.getByText('Morador', { exact: true }).click();
    await page.getByText('Autorizações', { exact: true }).click();
    await page.locator('#btn-option-new').click();
    await page.locator('#nu_documento').waitFor(); // garante que o form de fato abriu

    await page.locator('#nu_documento').fill(guestDocument);
    await page.locator('#no_autorizacao').fill(guestName);
    await page.locator('#id_morador_autorizacao_tipo').selectOption(TIPO_ACESSO_A_UNIDADE);

    // Campos de data usam um datepicker (jQuery UI); preenchemos o valor
    // direto e fechamos o popup do calendário clicando fora dele (Escape
    // sozinho não fechou de forma confiável num teste real).
    await page.locator('#dt_periodo_inicio').fill(toPortalDate(checkinDate));
    await page.locator('#no_autorizacao').click();
    await page.locator('#dt_periodo_fim').fill(toPortalDate(checkoutDate));
    await page.locator('#no_autorizacao').click();

    await page.locator('#hr_periodo_inicio').fill(checkinTime);
    await page.locator('#hr_periodo_fim').fill(checkoutTime);

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
  } catch (err) {
    const screenshotPath = await saveFailureScreenshot(page);
    throw new CondoRpaError(`Falha ao cadastrar no portal do condomínio: ${err.message}`, {
      screenshotPath,
    });
  } finally {
    await browser.close();
  }
}

module.exports = { registerGuest, CondoRpaError, toPortalDate };
