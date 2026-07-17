'use strict';

// Testa o cadastro de uma reserva no portal do condomínio, de ponta a ponta,
// com o navegador visível (headless: false) para acompanhar o robô agindo.
// Ainda não toca no banco além de LER a reserva — marcar condoRegistered
// via API é a Sprint 8d.
//
// Uso:
//   cd backend
//   node --env-file=.env scripts/register-condo.js <reservationId>

const reservations = require('../src/repositories/reservations');
const { registerGuest, CondoRpaError } = require('../src/services/condo-rpa');

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Uso: node --env-file=.env scripts/register-condo.js <reservationId>');
    process.exit(1);
  }

  const reservation = reservations.findById(id);
  if (!reservation) {
    console.error(`Reserva #${id} não encontrada`);
    process.exit(1);
  }
  if (!reservation.guestDocument) {
    console.error(`Reserva #${id} não tem RG (guestDocument) preenchido — complete a reserva primeiro`);
    process.exit(1);
  }

  console.log(`Cadastrando "${reservation.guestName}" no portal do condomínio...`);
  try {
    await registerGuest(
      {
        guestName: reservation.guestName,
        guestDocument: reservation.guestDocument,
        checkinDate: reservation.checkinDate,
        checkoutDate: reservation.checkoutDate,
        checkinTime: reservation.checkinTime,
        checkoutTime: reservation.checkoutTime,
      },
      { headless: false }
    );
    console.log('Cadastro concluído com sucesso.');
  } catch (err) {
    console.error(err.message);
    if (err instanceof CondoRpaError && err.screenshotPath) {
      console.error(`Screenshot do erro salvo em: ${err.screenshotPath}`);
    }
    process.exit(1);
  }
}

main();
