CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  checkin_date TEXT NOT NULL,      -- 'YYYY-MM-DD'
  checkout_date TEXT NOT NULL,     -- 'YYYY-MM-DD'
  gross_amount REAL NOT NULL DEFAULT 0,
  condo_registered INTEGER NOT NULL DEFAULT 0,   -- 0/1
  apartment_info_sent INTEGER NOT NULL DEFAULT 0, -- 0/1
  status TEXT NOT NULL DEFAULT 'complete',        -- 'pending' | 'complete'
  source TEXT NOT NULL DEFAULT 'manual',          -- 'manual' | 'airbnb-ical'
  ical_uid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_ical_uid
  ON reservations (ical_uid)
  WHERE ical_uid IS NOT NULL;

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,             -- 'YYYY-MM'
  category TEXT NOT NULL,          -- 'luz' | 'condominio' | 'internet' | 'funcionaria' | 'outro'
  amount REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- linha única
  host_split_percent REAL NOT NULL DEFAULT 30,
  owner_name TEXT NOT NULL DEFAULT 'Pai',
  ical_url TEXT
);

INSERT OR IGNORE INTO settings (id, host_split_percent, owner_name)
VALUES (1, 30, 'Pai');
