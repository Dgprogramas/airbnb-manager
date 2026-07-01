import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Reservation } from '../types';
import * as api from '../api';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const EMPTY_FORM = { guestName: '', checkinDate: '', checkoutDate: '', grossAmount: '' };

export default function Reservas() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [pendingOnly, setPendingOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completeForm, setCompleteForm] = useState({ guestName: '', grossAmount: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listReservations({ pendingOnly }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [pendingOnly]);

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.syncReservations();
      setMessage(
        `Sincronização concluída: ${result.createdCount} nova(s), ${result.skippedCount} já existente(s).`
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.createReservation({
        guestName: form.guestName,
        checkinDate: form.checkinDate,
        checkoutDate: form.checkoutDate,
        grossAmount: Number(form.grossAmount) || 0,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setMessage('Reserva criada.');
      await load();
    } catch (e2) {
      setError((e2 as Error).message);
    }
  }

  async function toggleFlag(r: Reservation, field: 'condoRegistered' | 'apartmentInfoSent') {
    setError(null);
    try {
      const updated = await api.updateReservation(r.id, { [field]: !r[field] });
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startComplete(r: Reservation) {
    setCompletingId(r.id);
    setCompleteForm({
      guestName: r.guestName.startsWith('Reserva Airbnb') ? '' : r.guestName,
      grossAmount: r.grossAmount ? String(r.grossAmount) : '',
    });
  }

  async function handleComplete(e: FormEvent, id: number) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.updateReservation(id, {
        guestName: completeForm.guestName,
        grossAmount: Number(completeForm.grossAmount) || 0,
        status: 'complete',
      });
      setCompletingId(null);
      setMessage('Reserva completada.');
      await load();
    } catch (e2) {
      setError((e2 as Error).message);
    }
  }

  return (
    <section>
      <div className="toolbar">
        <h2>Reservas</h2>
        <div className="toolbar-actions">
          <button onClick={handleSync} disabled={syncing}>
            {syncing ? 'Sincronizando…' : '🔄 Sincronizar com Airbnb'}
          </button>
          <button className="secondary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Cancelar' : '➕ Nova reserva'}
          </button>
        </div>
      </div>

      <label className="filter">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={(e) => setPendingOnly(e.target.checked)}
        />
        Mostrar só pendentes
      </label>

      {message && <div className="banner success">{message}</div>}
      {error && <div className="banner error">{error}</div>}

      {showForm && (
        <form className="card form" onSubmit={handleCreate}>
          <h3>Nova reserva</h3>
          <div className="grid">
            <label>
              Hóspede
              <input
                value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                required
              />
            </label>
            <label>
              Check-in
              <input
                type="date"
                value={form.checkinDate}
                onChange={(e) => setForm({ ...form, checkinDate: e.target.value })}
                required
              />
            </label>
            <label>
              Check-out
              <input
                type="date"
                value={form.checkoutDate}
                onChange={(e) => setForm({ ...form, checkoutDate: e.target.value })}
                required
              />
            </label>
            <label>
              Valor (R$)
              <input
                type="number"
                step="0.01"
                value={form.grossAmount}
                onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
              />
            </label>
          </div>
          <button type="submit">Salvar</button>
        </form>
      )}

      {loading ? (
        <p>Carregando…</p>
      ) : items.length === 0 ? (
        <p className="empty">
          Nenhuma reserva. Clique em “Sincronizar com Airbnb” ou “Nova reserva”.
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Hóspede</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Condomínio</th>
              <th>Info enviada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <Fragment key={r.id}>
                <tr className={r.status === 'pending' ? 'row-pending' : ''}>
                  <td>{r.guestName}</td>
                  <td>{formatDate(r.checkinDate)}</td>
                  <td>{formatDate(r.checkoutDate)}</td>
                  <td>{formatMoney(r.grossAmount)}</td>
                  <td>
                    <span className={`badge ${r.status}`}>
                      {r.status === 'pending' ? 'Pendente' : 'Completa'}
                    </span>
                    {r.source === 'airbnb-ical' && <span className="tag">Airbnb</span>}
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={r.condoRegistered}
                      onChange={() => toggleFlag(r, 'condoRegistered')}
                    />
                  </td>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={r.apartmentInfoSent}
                      onChange={() => toggleFlag(r, 'apartmentInfoSent')}
                    />
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <button className="link" onClick={() => startComplete(r)}>
                        Completar
                      </button>
                    )}
                  </td>
                </tr>
                {completingId === r.id && (
                  <tr>
                    <td colSpan={8}>
                      <form className="complete-form" onSubmit={(e) => handleComplete(e, r.id)}>
                        <span>Completar pendência:</span>
                        <input
                          placeholder="Nome do hóspede"
                          value={completeForm.guestName}
                          onChange={(e) =>
                            setCompleteForm({ ...completeForm, guestName: e.target.value })
                          }
                          required
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Valor (R$)"
                          value={completeForm.grossAmount}
                          onChange={(e) =>
                            setCompleteForm({ ...completeForm, grossAmount: e.target.value })
                          }
                        />
                        <button type="submit">Salvar</button>
                        <button
                          type="button"
                          className="link"
                          onClick={() => setCompletingId(null)}
                        >
                          Cancelar
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
