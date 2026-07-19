import type {
  Closing,
  Expense,
  ImportCsvResult,
  NewExpense,
  NewReservation,
  Reservation,
  Settings,
  SyncResult,
} from './types';

// Trata a resposta: se não for 2xx, extrai a mensagem de erro do backend.
async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* corpo não-JSON: mantém a mensagem padrão */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T; // DELETE não tem corpo
  return res.json() as Promise<T>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function listReservations(
  params: { month?: string; year?: number; pendingOnly?: boolean } = {}
): Promise<Reservation[]> {
  const qs = new URLSearchParams();
  if (params.month) qs.set('month', params.month);
  if (params.year) qs.set('year', String(params.year));
  if (params.pendingOnly) qs.set('pendingOnly', 'true');
  const query = qs.toString();
  return handle(await fetch(`/api/reservations${query ? `?${query}` : ''}`));
}

export async function createReservation(body: NewReservation): Promise<Reservation> {
  return handle(
    await fetch('/api/reservations', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    })
  );
}

export async function updateReservation(
  id: number,
  patch: Partial<Reservation>
): Promise<Reservation> {
  return handle(
    await fetch(`/api/reservations/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteReservation(id: number): Promise<void> {
  return handle(await fetch(`/api/reservations/${id}`, { method: 'DELETE' }));
}

export async function registerCondo(
  id: number,
  vehicle: { vehicleModel?: string; vehiclePlate?: string; vehicleColor?: string } = {}
): Promise<Reservation> {
  return handle(
    await fetch(`/api/reservations/${id}/register-condo`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(vehicle),
    })
  );
}

export async function syncReservations(icalUrl?: string): Promise<SyncResult> {
  return handle(
    await fetch('/api/reservations/sync', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(icalUrl ? { icalUrl } : {}),
    })
  );
}

export async function importCsv(csv: string): Promise<ImportCsvResult> {
  return handle(
    await fetch('/api/reservations/import-csv', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ csv }),
    })
  );
}

export async function getSettings(): Promise<Settings> {
  return handle(await fetch('/api/settings'));
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return handle(
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    })
  );
}

export async function listExpenses(month?: string): Promise<Expense[]> {
  const query = month ? `?month=${month}` : '';
  return handle(await fetch(`/api/expenses${query}`));
}

export async function createExpense(body: NewExpense): Promise<Expense> {
  return handle(
    await fetch('/api/expenses', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
    })
  );
}

export async function updateExpense(id: number, patch: Partial<Expense>): Promise<Expense> {
  return handle(
    await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(patch),
    })
  );
}

export async function deleteExpense(id: number): Promise<void> {
  return handle(await fetch(`/api/expenses/${id}`, { method: 'DELETE' }));
}

export async function getClosing(month: string): Promise<Closing> {
  return handle(await fetch(`/api/finance/closing?month=${month}`));
}
