import type { NewReservation, Reservation, Settings, SyncResult } from './types';

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
  return res.json() as Promise<T>;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function listReservations(
  params: { month?: string; pendingOnly?: boolean } = {}
): Promise<Reservation[]> {
  const qs = new URLSearchParams();
  if (params.month) qs.set('month', params.month);
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

export async function syncReservations(icalUrl?: string): Promise<SyncResult> {
  return handle(
    await fetch('/api/reservations/sync', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(icalUrl ? { icalUrl } : {}),
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
