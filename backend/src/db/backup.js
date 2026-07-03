'use strict';

const fs = require('fs');
const path = require('path');
const { getDb, DB_PATH } = require('./connection');

const KEEP_LAST = 7;

// Cria um backup diário do banco em data/backups/ usando VACUUM INTO
// (cópia consistente mesmo com o banco aberto) e mantém só os últimos
// KEEP_LAST arquivos. Retorna o caminho do backup criado, ou null se
// já existia um de hoje / não há o que copiar.
function runDailyBackup() {
  if (DB_PATH === ':memory:' || !fs.existsSync(DB_PATH)) return null;

  const backupDir = path.join(path.dirname(DB_PATH), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const target = path.join(backupDir, `airbnb-manager-${today}.db`);

  let created = null;
  if (!fs.existsSync(target)) {
    // VACUUM INTO falha se o destino existir, por isso o check acima.
    getDb().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    created = target;
  }

  // Nome do arquivo contém a data, então ordenar por nome = ordenar por data.
  const backups = fs
    .readdirSync(backupDir)
    .filter((f) => /^airbnb-manager-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  for (const old of backups.slice(0, -KEEP_LAST)) {
    fs.unlinkSync(path.join(backupDir, old));
  }

  return created;
}

module.exports = { runDailyBackup };
