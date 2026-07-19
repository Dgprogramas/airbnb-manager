'use strict';

// Testes do RPA do condomínio com o Playwright MOCKADO — não abrem Chrome de
// verdade nem tocam o portal. Um "launcher" fake grava a sequência de ações e
// pode ser configurado pra falhar/travar num passo específico, exercitando o
// caminho feliz e o tratamento de erro (fase de login, mudança de layout,
// timeout global).

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { registerGuest, CondoRpaError, PHASE } = require('../src/services/condo-rpa');

// Fabrica um launcher fake. `failAt({action,target})` pode devolver um Error
// pra fazer aquele passo rejeitar; `hang(...)` devolve true pra travar (promise
// que nunca resolve), usado pra testar o timeout global.
function makeFake({ failAt = () => null, hang = () => false } = {}) {
  const calls = [];
  const record = (action, target, value) => {
    calls.push({ action, target, value });
    if (hang({ action, target, value })) return new Promise(() => {});
    const err = failAt({ action, target, value });
    if (err) return Promise.reject(err);
    return Promise.resolve();
  };
  const locator = (target) => ({
    fill: (v) => record('fill', target, v),
    click: () => record('click', target),
    selectOption: (v) => record('selectOption', target, v),
    waitFor: (opts) => record('waitFor', target, opts),
    // No código real, evaluate seta o value das datas via JS (2º arg) sem
    // focar o campo — o fake só grava o valor recebido.
    evaluate: (_fn, v) => record('evaluate', target, v),
  });
  const page = {
    setDefaultTimeout: (ms) => calls.push({ action: 'setDefaultTimeout', value: ms }),
    goto: (url) => record('goto', url),
    evaluate: () => record('evaluate', 'page'),
    waitForTimeout: () => Promise.resolve(), // sem esperas reais nos testes
    getByPlaceholder: (t) => locator(`placeholder:${t}`),
    getByRole: (role, opts) => locator(`role:${role}:${opts && opts.name}`),
    getByText: (t) => locator(`text:${t}`),
    locator: (sel) => locator(sel),
    screenshot: () => Promise.resolve(),
  };
  const browser = {
    newPage: async () => page,
    close: async () => calls.push({ action: 'close' }),
  };
  return { launcher: { launch: async () => browser }, calls };
}

const VALID = {
  guestName: 'Fulano de Tal',
  guestDocument: '12.345.678-9',
  checkinDate: '2026-08-01',
  checkoutDate: '2026-08-03',
  checkinTime: '14:00',
  checkoutTime: '11:00',
};

function withCreds(fn) {
  const prev = { email: process.env.CONDO_EMAIL, pass: process.env.CONDO_PASSWORD };
  process.env.CONDO_EMAIL = 'morador@example.com';
  process.env.CONDO_PASSWORD = 'segredo';
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev.email === undefined) delete process.env.CONDO_EMAIL;
      else process.env.CONDO_EMAIL = prev.email;
      if (prev.pass === undefined) delete process.env.CONDO_PASSWORD;
      else process.env.CONDO_PASSWORD = prev.pass;
    });
}

const has = (calls, action, target) =>
  calls.some((c) => c.action === action && c.target === target);

test('caminho feliz: preenche o formulário e confirma o salvamento', async () => {
  await withCreds(async () => {
    const { launcher, calls } = makeFake();
    await registerGuest(VALID, { launcher });

    // Login
    assert.ok(calls.some((c) => c.action === 'fill' && c.target === 'placeholder:E-mail...'));
    assert.ok(has(calls, 'fill', 'input[type="password"]'));
    // Campos obrigatórios
    const rg = calls.find((c) => c.action === 'fill' && c.target === '#nu_documento');
    assert.equal(rg.value, VALID.guestDocument);
    const nome = calls.find((c) => c.action === 'fill' && c.target === '#no_autorizacao');
    assert.equal(nome.value, VALID.guestName);
    const tipo = calls.find((c) => c.action === 'selectOption' && c.target === '#id_morador_autorizacao_tipo');
    assert.equal(tipo.value, '425'); // Acesso A Unidade
    // Datas convertidas para DD/MM/AAAA (setadas via evaluate, sem focar —
    // o datepicker do portal não pode abrir)
    const de = calls.find((c) => c.action === 'evaluate' && c.target === '#dt_periodo_inicio');
    assert.equal(de.value, '01/08/2026');
    // Salvou e fechou o browser
    assert.ok(has(calls, 'click', '#btn-option-save'));
    assert.ok(calls.some((c) => c.action === 'close'));
  });
});

test('campos de veículo: preenche só quando informados', async () => {
  await withCreds(async () => {
    const semVeiculo = makeFake();
    await registerGuest(VALID, { launcher: semVeiculo.launcher });
    assert.ok(!has(semVeiculo.calls, 'fill', '#no_modelo'));
    assert.ok(!has(semVeiculo.calls, 'fill', '#nu_placa'));

    const comVeiculo = makeFake();
    await registerGuest(
      { ...VALID, vehicleModel: 'Civic', vehiclePlate: 'ABC1D23', vehicleColor: 'Preto' },
      { launcher: comVeiculo.launcher }
    );
    assert.equal(
      comVeiculo.calls.find((c) => c.action === 'fill' && c.target === '#no_modelo').value,
      'Civic'
    );
    assert.ok(has(comVeiculo.calls, 'fill', '#nu_placa'));
    assert.ok(has(comVeiculo.calls, 'fill', '#no_cor'));
  });
});

test('sem credenciais: erro de config e o browser nem é aberto', async () => {
  const prev = { email: process.env.CONDO_EMAIL, pass: process.env.CONDO_PASSWORD };
  delete process.env.CONDO_EMAIL;
  delete process.env.CONDO_PASSWORD;
  try {
    let launched = false;
    const launcher = { launch: async () => ((launched = true), {}) };
    await assert.rejects(registerGuest(VALID, { launcher }), (err) => {
      assert.ok(err instanceof CondoRpaError);
      assert.equal(err.phase, PHASE.CONFIG);
      return true;
    });
    assert.equal(launched, false);
  } finally {
    if (prev.email !== undefined) process.env.CONDO_EMAIL = prev.email;
    if (prev.pass !== undefined) process.env.CONDO_PASSWORD = prev.pass;
  }
});

test('sem RG: erro de config', async () => {
  await withCreds(async () => {
    const { launcher } = makeFake();
    await assert.rejects(registerGuest({ ...VALID, guestDocument: '' }, { launcher }), (err) => {
      assert.equal(err.phase, PHASE.CONFIG);
      return true;
    });
  });
});

test('login não conclui: fase LOGIN e browser é fechado', async () => {
  await withCreds(async () => {
    const { launcher, calls } = makeFake({
      failAt: ({ action, target }) =>
        action === 'waitFor' && target === 'text:Morador'
          ? new Error('timeout esperando o menu')
          : null,
    });
    await assert.rejects(registerGuest(VALID, { launcher }), (err) => {
      assert.equal(err.phase, PHASE.LOGIN);
      assert.match(err.message, /Login|CONDO_EMAIL/);
      return true;
    });
    assert.ok(calls.some((c) => c.action === 'close'), 'browser deve ser fechado no finally');
  });
});

test('campo sumiu (layout mudou): fase FORM', async () => {
  await withCreds(async () => {
    const { launcher } = makeFake({
      failAt: ({ action, target }) =>
        action === 'selectOption' && target === '#id_morador_autorizacao_tipo'
          ? new Error('seletor não encontrado')
          : null,
    });
    await assert.rejects(registerGuest(VALID, { launcher }), (err) => {
      assert.equal(err.phase, PHASE.FORM);
      return true;
    });
  });
});

test('travamento: estoura o timeout global com fase TIMEOUT', async () => {
  await withCreds(async () => {
    const { launcher } = makeFake({ hang: ({ action }) => action === 'goto' });
    await assert.rejects(registerGuest(VALID, { launcher, globalTimeoutMs: 50 }), (err) => {
      assert.equal(err.phase, PHASE.TIMEOUT);
      return true;
    });
  });
});
