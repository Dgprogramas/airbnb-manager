import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Plus, RefreshCw, X } from 'lucide-react';
import type { Reservation } from '../types';
import * as api from '../api';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Classes reaproveitadas (deixam o JSX mais limpo)
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg bg-elevated px-3.5 py-2 text-sm font-medium text-content hover:opacity-80';
const btnLink = 'inline-flex items-center gap-1 text-sm text-brand hover:underline';
const inputCls =
  'rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-content outline-none focus:ring-2 focus:ring-brand/40';
const labelCls = 'flex flex-col gap-1 text-xs text-muted';
const th =
  'border-b border-line bg-elevated px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted';
const td = 'border-b border-line px-3 py-2.5';

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reservas</h2>
        <div className="flex gap-2">
          <button className={btnPrimary} onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Sincronizar com Airbnb'}
          </button>
          <button className={btnSecondary} onClick={() => setShowForm((s) => !s)}>
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancelar' : 'Nova reserva'}
          </button>
        </div>
      </div>

      <label className="my-3.5 inline-flex items-center gap-1.5 text-sm text-muted">
        <input
          type="checkbox"
          checked={pendingOnly}
          onChange={(e) => setPendingOnly(e.target.checked)}
        />
        Mostrar só pendentes
      </label>

      {message && (
        <div className="my-2 rounded-lg bg-emerald-500/15 px-3.5 py-2.5 text-sm text-emerald-600">
          {message}
        </div>
      )}
      {error && (
        <div className="my-2 rounded-lg bg-red-500/15 px-3.5 py-2.5 text-sm text-red-500">
          {error}
        </div>
      )}

      {showForm && (
        <form className="my-3 rounded-xl border border-line bg-surface p-4" onSubmit={handleCreate}>
          <h3 className="mb-3 font-semibold">Nova reserva</h3>
          <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <label className={labelCls}>
              Hóspede
              <input
                className={inputCls}
                value={form.guestName}
                onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                required
              />
            </label>
            <label className={labelCls}>
              Check-in
              <input
                type="date"
                className={inputCls}
                value={form.checkinDate}
                onChange={(e) => setForm({ ...form, checkinDate: e.target.value })}
                required
              />
            </label>
            <label className={labelCls}>
              Check-out
              <input
                type="date"
                className={inputCls}
                value={form.checkoutDate}
                onChange={(e) => setForm({ ...form, checkoutDate: e.target.value })}
                required
              />
            </label>
            <label className={labelCls}>
              Valor (R$)
              <input
                type="number"
                step="0.01"
                className={inputCls}
                value={form.grossAmount}
                onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
              />
            </label>
          </div>
          <button type="submit" className={btnPrimary}>
            <Check className="h-4 w-4" />
            Salvar
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface p-6 text-center text-muted">
          Nenhuma reserva. Clique em “Sincronizar com Airbnb” ou “Nova reserva”.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>Hóspede</th>
                <th className={th}>Check-in</th>
                <th className={th}>Check-out</th>
                <th className={th}>Valor</th>
                <th className={th}>Status</th>
                <th className={th}>Condomínio</th>
                <th className={th}>Info enviada</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <Fragment key={r.id}>
                  <tr className={r.status === 'pending' ? 'bg-amber-500/5' : ''}>
                    <td className={td}>{r.guestName}</td>
                    <td className={td}>{formatDate(r.checkinDate)}</td>
                    <td className={td}>{formatDate(r.checkoutDate)}</td>
                    <td className={td}>{formatMoney(r.grossAmount)}</td>
                    <td className={td}>
                      {r.status === 'pending' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                          Pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-500">
                          Completa
                        </span>
                      )}
                      {r.source === 'airbnb-ical' && (
                        <span className="ml-1.5 rounded-full border border-brand px-1.5 py-px text-[11px] text-brand">
                          Airbnb
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-center`}>
                      <input
                        type="checkbox"
                        checked={r.condoRegistered}
                        onChange={() => toggleFlag(r, 'condoRegistered')}
                      />
                    </td>
                    <td className={`${td} text-center`}>
                      <input
                        type="checkbox"
                        checked={r.apartmentInfoSent}
                        onChange={() => toggleFlag(r, 'apartmentInfoSent')}
                      />
                    </td>
                    <td className={td}>
                      {r.status === 'pending' && (
                        <button className={btnLink} onClick={() => startComplete(r)}>
                          <Check className="h-3.5 w-3.5" />
                          Completar
                        </button>
                      )}
                    </td>
                  </tr>
                  {completingId === r.id && (
                    <tr className="bg-amber-500/5">
                      <td className={td} colSpan={8}>
                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={(e) => handleComplete(e, r.id)}
                        >
                          <span className="text-sm text-muted">Completar pendência:</span>
                          <input
                            className={inputCls}
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
                            className={inputCls}
                            placeholder="Valor (R$)"
                            value={completeForm.grossAmount}
                            onChange={(e) =>
                              setCompleteForm({ ...completeForm, grossAmount: e.target.value })
                            }
                          />
                          <button type="submit" className={btnPrimary}>
                            <Check className="h-4 w-4" />
                            Salvar
                          </button>
                          <button
                            type="button"
                            className={btnLink}
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
        </div>
      )}
    </section>
  );
}
