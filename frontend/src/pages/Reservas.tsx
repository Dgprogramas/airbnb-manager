import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ChevronDown, Pencil, Plus, RefreshCw, Settings as SettingsIcon, Trash2, X } from 'lucide-react';
import type { Reservation } from '../types';
import * as api from '../api';
import Switch from '../components/Switch';
import Checkbox from '../components/Checkbox';
import Collapse from '../components/Collapse';
import HeightCollapse from '../components/HeightCollapse';

function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} de ${y}`;
}

function stayStatus(r: Reservation): { label: string; cls: string } {
  if (r.cancelledAt) return { label: 'Cancelada', cls: 'bg-danger/12 text-danger' };
  const now = new Date();
  const checkin = new Date(`${r.checkinDate}T00:00:00`);
  const checkout = new Date(`${r.checkoutDate}T11:00:00`);
  if (now >= checkout) return { label: 'Finalizada', cls: 'bg-success/12 text-success' };
  if (now >= checkin) return { label: 'Em andamento', cls: 'bg-warning/15 text-warning' };
  return { label: 'Futura', cls: 'bg-info/12 text-info' };
}
function groupByMonth(items: Reservation[]): { key: string; rows: Reservation[] }[] {
  const groups: { key: string; rows: Reservation[] }[] = [];
  for (const r of items) {
    const key = r.checkinDate.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else groups.push({ key, rows: [r] });
  }
  return groups;
}

const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-full bg-elevated px-4 py-2.5 text-sm font-medium text-content hover:bg-line/60';
const btnGhost =
  'inline-flex w-[108px] items-center justify-center gap-1.5 rounded-full bg-elevated/70 px-2.5 py-1.5 text-xs font-medium text-content hover:bg-elevated';
const inputCls =
  'rounded-xl border-0 bg-elevated px-3 py-2.5 text-sm text-content outline-none ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand/50';
const labelCls = 'flex flex-col gap-1 text-xs text-muted';

const surfaceCls = 'bg-surface shadow-sm ring-1 ring-black/5';
const cardCls = `rounded-2xl p-4 ${surfaceCls}`;
// break-words como rede de segurança: mesmo se a coluna ficar apertada, o
// texto quebra dentro da própria célula em vez de vazar pra célula vizinha.
// Só a coluna Hóspede pode quebrar linha (o nome pode ser longo); todas as
// outras usam nowrap — a largura das colunas é dimensionada pra caber.
const th =
  'whitespace-nowrap px-3 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-muted/80';
const td = 'align-top text-[12px] break-words px-3 py-3';
const tdNowrap = 'align-top whitespace-nowrap text-[12px] px-3 py-3';
   
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
  const [closingPanel, setClosingPanel] = useState(false);
  const [completeForm, setCompleteForm] = useState({ guestName: '', grossAmount: '' });

  const [showConfig, setShowConfig] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  function toggleMonth(key: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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

  useEffect(() => {
    api
      .getSettings()
      .then((s) => setIcalUrl(s.icalUrl ?? ''))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  async function handleSaveConfig() {
    setSavingConfig(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await api.updateSettings({ icalUrl: icalUrl.trim() || null });
      setIcalUrl(saved.icalUrl ?? '');
      setShowConfig(false);
      setMessage('URL do iCal salva. Agora é só clicar em “Sincronizar com Airbnb”.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.syncReservations();
      const parts = [
        `${result.createdCount} nova(s)`,
        `${result.skippedCount} já existente(s)`,
      ];
      if (result.cancelledCount > 0) parts.push(`${result.cancelledCount} cancelada(s)`);
      if (result.blockedCount > 0) parts.push(`${result.blockedCount} bloqueio(s) de data ignorado(s)`);
      setMessage(`Sincronização concluída: ${parts.join(', ')}.`);
      if (result.createdCount > 0 || result.cancelledCount > 0) {
        await load();
      }
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
    setClosingPanel(false);
    setCompletingId(r.id);
    setCompleteForm({
      guestName: r.guestName.startsWith('Reserva Airbnb') ? '' : r.guestName,
      grossAmount: r.grossAmount ? String(r.grossAmount) : '',
    });
  }

  // Fecha o painel com animação de saída (a remoção real ocorre no onAnimationEnd).
  function closePanel() {
    setClosingPanel(true);
  }

  // Clicar em "Completar": abre; se já estiver aberto naquela linha, fecha (toggle).
  function toggleComplete(r: Reservation) {
    if (completingId === r.id && !closingPanel) {
      closePanel();
    } else {
      startComplete(r);
    }
  }

  async function handleDelete(r: Reservation) {
    const ok = window.confirm(
      `Excluir a reserva de "${r.guestName}" (${formatDate(r.checkinDate)} → ${formatDate(
        r.checkoutDate
      )})? Essa ação não tem volta.`
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await api.deleteReservation(r.id);
      setItems((prev) => prev.filter((it) => it.id !== r.id));
      setMessage('Reserva excluída.');
    } catch (e) {
      setError((e as Error).message);
    }
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
      setClosingPanel(false);
      setMessage('Dados salvos.');
      await load();
    } catch (e2) {
      setError((e2 as Error).message);
    }
  }

  function renderRow(r: Reservation) {
    const stay = stayStatus(r);
    const cancelled = Boolean(r.cancelledAt);
    const needsData = r.status === 'pending' && !cancelled;
    return (
      <Fragment key={r.id}>
        <tr
          className={`transition-colors hover:bg-elevated/60 ${
            needsData ? 'bg-elevated/60' : 'bg-elevated/20'
          } ${cancelled ? 'opacity-55' : ''}`}
        >
          <td className={td}>{r.guestName}</td>
          <td className={tdNowrap}>{formatDate(r.checkinDate)}</td>
          <td className={tdNowrap}>{formatDate(r.checkoutDate)}</td>
          <td className={tdNowrap}>{formatMoney(r.grossAmount)}</td>
          <td className={tdNowrap}>
            <div className="flex flex-col items-start gap-1">
              <span
                className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${stay.cls}`}
              >
                {stay.label}
              </span>
              {needsData && (
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-muted/12 px-2.5 py-1 text-xs font-semibold text-muted">
                  Faltam dados
                </span>
              )}
            </div>
          </td>
          <td className={`${tdNowrap} text-center`}>
            <Checkbox
              checked={r.condoRegistered}
              onChange={() => toggleFlag(r, 'condoRegistered')}
              label="Cadastrado no condomínio"
            />
          </td>
          <td className={`${tdNowrap} text-center`}>
            <Checkbox
              checked={r.apartmentInfoSent}
              onChange={() => toggleFlag(r, 'apartmentInfoSent')}
              label="Informações do apartamento enviadas"
            />
          </td>
          <td className={tdNowrap}>
            <div className="flex items-center gap-1.5">
              {!cancelled && (
                <button className={btnGhost} onClick={() => toggleComplete(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {needsData ? 'Completar' : 'Editar'}
                </button>
              )}
              <button
                className="ml-auto rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                onClick={() => handleDelete(r)}
                title="Excluir reserva"
                aria-label="Excluir reserva"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>
        {completingId === r.id && (
          <tr className={needsData ? 'bg-elevated/60' : 'bg-elevated/20'}>
            <td className="p-0" colSpan={8}>
              <HeightCollapse
                show={!closingPanel}
                onClosed={() => {
                  setCompletingId(null);
                  setClosingPanel(false);
                }}
              >
                <div
                  className={`border-t border-line/40 px-4 py-4 ${
                    needsData ? 'bg-elevated/60' : 'bg-elevated/20'
                  }`}
                >
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted/80">
                  {needsData ? 'Completar reserva' : 'Editar reserva'}
                </p>
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(e) => handleComplete(e, r.id)}
                >
                  <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-muted">
                    Nome do hóspede
                    <input
                      className={inputCls}
                      value={completeForm.guestName}
                      onChange={(e) =>
                        setCompleteForm({ ...completeForm, guestName: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="flex w-40 flex-col gap-1 text-xs text-muted">
                    Valor (R$)
                    <input
                      type="number"
                      step="0.01"
                      className={inputCls}
                      value={completeForm.grossAmount}
                      onChange={(e) =>
                        setCompleteForm({ ...completeForm, grossAmount: e.target.value })
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" className={btnSecondary} onClick={closePanel}>
                      Cancelar
                    </button>
                    <button type="submit" className={btnPrimary}>
                      <Check className="h-4 w-4" />
                      Salvar
                    </button>
                  </div>
                </form>
                </div>
              </HeightCollapse>
            </td>
          </tr>
        )}
      </Fragment>
    );
  }

  const groups = groupByMonth(items);

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
          <button
            className={btnSecondary}
            onClick={() => setShowConfig((s) => !s)}
            title="Configurar URL do iCal do Airbnb"
          >
            <SettingsIcon className="h-4 w-4" />
            Configurar
          </button>
        </div>
      </div>

      <Collapse show={showConfig} className={`my-3 ${cardCls}`}>
        <h3 className="mb-1 font-semibold">Configuração do Airbnb</h3>
        <p className="mb-3 text-xs text-muted">
          Cole a URL do calendário (iCal) do seu anúncio. No Airbnb: Calendário → Disponibilidade →
          Conectar outro site / Exportar calendário.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs text-muted">
            URL do iCal
            <input
              className={inputCls}
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder="https://www.airbnb.com/calendar/ical/....ics"
            />
          </label>
          <button className={btnPrimary} onClick={handleSaveConfig} disabled={savingConfig}>
            <Check className="h-4 w-4" />
            {savingConfig ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Collapse>

      <label className="my-3.5 flex items-center gap-2.5 text-sm text-muted">
        <Switch checked={pendingOnly} onChange={() => setPendingOnly((v) => !v)} />
        Mostrar só com dados pendentes
      </label>

      <Collapse
        show={!!message}
        className="my-2 rounded-xl bg-success/12 px-3.5 py-2.5 text-sm text-success backdrop-blur-sm"
      >
        {message}
      </Collapse>
      <Collapse
        show={!!error}
        className="my-2 rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger backdrop-blur-sm"
      >
        {error}
      </Collapse>

      <Collapse show={showForm} className={`my-3 ${cardCls}`}>
        <form onSubmit={handleCreate}>
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
      </Collapse>

      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className={`rounded-2xl p-8 text-center text-muted ${surfaceCls}`}>
          Nenhuma reserva. Clique em “Sincronizar com Airbnb” ou “Nova reserva”.
        </p>
      ) : (
        /* Seção Tabela */
        <div className="mt-6 space-y-6">
          {groups.map((g) => {
            const collapsed = collapsedMonths.has(g.key);
            return (
            <div key={g.key} className={`overflow-hidden rounded-2xl ${surfaceCls}`}>
              <button
                type="button"
                onClick={() => toggleMonth(g.key)}
                aria-expanded={!collapsed}
                className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-elevated/50 ${
                  collapsed ? '' : 'border-b border-line/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-4 w-4 text-muted transition-transform duration-300 ${
                      collapsed ? '-rotate-90' : ''
                    }`}
                  />
                  <h3 className="text-sm font-semibold capitalize text-content">{monthLabel(g.key)}</h3>
                </div>
                <span className="text-xs text-muted">
                  {g.rows.length} {g.rows.length === 1 ? 'reserva' : 'reservas'}
                </span>
              </button>
              <HeightCollapse show={!collapsed}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] table-fixed border-collapse text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[95px]" />
                    <col className="w-[95px]" />
                    <col className="w-[90px]" />
                    <col className="w-[125px]" />
                    <col className="w-[100px]" />
                    <col className="w-[120px]" />
                    <col className="w-[170px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-line/50">
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
                  <tbody className="divide-y divide-line/40">{g.rows.map((r) => renderRow(r))}</tbody>
                </table>
              </div>
              </HeightCollapse>
            </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
