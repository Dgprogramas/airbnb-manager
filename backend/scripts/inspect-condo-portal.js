'use strict';

// Faz login e navega até Morador > Autorizações > Novo, depois salva um
// snapshot do HTML do formulário em backend/data/rpa-logs/form-snapshot.html
// — usado só para descobrir os seletores reais (id/name/options) do portal,
// já que a associação label->input não é confiável (ver falha registrada ao
// tentar usar getByLabel em condo-rpa.js).
//
// Uso:
//   cd backend
//   node --env-file=.env scripts/inspect-condo-portal.js
//
// O navegador fica pausado no fim (Playwright Inspector) para inspeção
// manual opcional; feche a janela ou dê Ctrl+C no terminal para encerrar.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const LOGIN_URL = 'https://app.condominiodedicado.com.br';
const OUT_DIR = path.join(__dirname, '..', 'data', 'rpa-logs');

async function main() {
  const email = process.env.CONDO_EMAIL;
  const password = process.env.CONDO_PASSWORD;
  if (!email || !password) {
    console.error('CONDO_EMAIL e CONDO_PASSWORD precisam estar definidos no .env');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(LOGIN_URL);
  await page.getByPlaceholder('E-mail...').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'ENTRAR' }).click();

  await page.getByText('Morador', { exact: true }).click();
  await page.getByText('Autorizações', { exact: true }).click();
  await page.getByRole('button', { name: /Novo/ }).click();

  // Espera o formulário de cadastro (não o de busca da listagem) renderizar
  // de fato antes de capturar o HTML.
  await page.getByText('Número do RG').waitFor({ timeout: 15000 });

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const htmlPath = path.join(OUT_DIR, 'form-snapshot.html');
  fs.writeFileSync(htmlPath, await page.content());
  console.log(`Snapshot da página salvo em: ${htmlPath}`);
  console.log('Navegador pausado (Playwright Inspector) — feche quando terminar.');

  await page.pause();
  await browser.close();
}

main();
