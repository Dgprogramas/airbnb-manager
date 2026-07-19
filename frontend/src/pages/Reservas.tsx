import { Fragment, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Check,
  ChevronDown,
  FileUp,
  Pencil,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { Reservation } from '../types';
import * as api from '../api';
import Switch from '../components/Switch';
import Collapse from '../components/Collapse';
import IconButton from '../components/IconButton';
import DateRangePicker from '../components/DateRangePicker';
import HeightCollapse from '../components/HeightCollapse';
import YearPicker from '../components/YearPicker';

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
  const checkout = new Date(`${r.checkoutDate}T${r.checkoutTime || '11:00'}:00`);
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

// 'YYYY-MM' do mês corrente — usado pra destacar e priorizar o mês atual.
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-full bg-elevated px-4 py-2.5 text-sm font-medium text-content hover:bg-line/60';
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
   
const EMPTY_FORM = {
  guestName: '',
  guestDocument: '',
  checkinDate: '',
  checkoutDate: '',
  checkinTime: '14:00',
  checkoutTime: '11:00',
  grossAmount: '',
};

export default function Reservas() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [pendingOnly, setPendingOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [closingPanel, setClosingPanel] = useState(false);
  const [completeForm, setCompleteForm] = useState({
    guestName: '',
    guestDocument: '',
    checkinDate: '',
    checkoutDate: '',
    checkinTime: '14:00',
    checkoutTime: '11:00',
    grossAmount: '',
  });

  const [showConfig, setShowConfig] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Meses expandidos (só o mês atual começa aberto — o histórico importado
  // do CSV fica recolhido, sem afogar a tela).
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([currentMonthKey()])
  );

  const [condoModalReservation, setCondoModalReservation] = useState<Reservation | null>(null);
  const [condoForm, setCondoForm] = useState({ vehicleModel: '', vehiclePlate: '', vehicleColor: '' });
  const [condoLoading, setCondoLoading] = useState(false);
  const [condoError, setCondoError] = useState<string | null>(null);

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
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
      setItems(await api.listReservations({ year, pendingOnly }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [year, pendingOnly]);

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

  // Importa o CSV de ganhos do Airbnb: completa reservas pendentes com
  // nome/valor e cria as que não existem (inclusive as já passadas, que o
  // iCal não traz mais).
  async function handleImportCsv(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reimportar o mesmo arquivo depois
    if (!file) return;
    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      const csv = await file.text();
      const result = await api.importCsv(csv);
      const parts = [
        `${result.createdCount} criada(s)`,
        `${result.updatedCount} completada(s)`,
        `${result.skippedCount} já existente(s)`,
      ];
      setMessage(`Importação concluída: ${parts.join(', ')}.`);
      if (result.createdCount > 0 || result.updatedCount > 0) {
        await load();
      }
    } catch (e2) {
      setError((e2 as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!form.checkinDate || !form.checkoutDate) {
      setError('Escolha o período da estadia (check-in e check-out).');
      return;
    }
    try {
      await api.createReservation({
        guestName: form.guestName,
        guestDocument: form.guestDocument.trim(),
        checkinDate: form.checkinDate,
        checkoutDate: form.checkoutDate,
        checkinTime: form.checkinTime,
        checkoutTime: form.checkoutTime,
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

  function missingCondoFields(r: Reservation): string[] {
    const missing: string[] = [];
    if (!r.guestDocument) missing.push('RG do hóspede');
    if (!r.checkinTime) missing.push('horário de check-in');
    if (!r.checkoutTime) missing.push('horário de check-out');
    return missing;
  }

  function openCondoModal(r: Reservation) {
    const missing = missingCondoFields(r);
    if (missing.length > 0) {
      setError(`Complete a reserva antes de cadastrar no condomínio — falta: ${missing.join(', ')}.`);
      return;
    }
    setCondoError(null);
    setCondoForm({ vehicleModel: '', vehiclePlate: '', vehicleColor: '' });
    setCondoModalReservation(r);
  }

  function closeCondoModal() {
    if (condoLoading) return; // não fecha durante a automação em andamento
    setCondoModalReservation(null);
  }

  async function handleRegisterCondo() {
    if (!condoModalReservation) return;
    setCondoLoading(true);
    setCondoError(null);
    try {
      const updated = await api.registerCondo(condoModalReservation.id, {
        vehicleModel: condoForm.vehicleModel.trim() || undefined,
        vehiclePlate: condoForm.vehiclePlate.trim() || undefined,
        vehicleColor: condoForm.vehicleColor.trim() || undefined,
      });
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      setCondoModalReservation(null);
      setMessage('Hóspede cadastrado no condomínio.');
    } catch (e) {
      setCondoError((e as Error).message);
    } finally {
      setCondoLoading(false);
    }
  }

  function startComplete(r: Reservation) {
    setClosingPanel(false);
    setCompletingId(r.id);
    setCompleteForm({
      guestName: r.guestName.startsWith('Reserva Airbnb') ? '' : r.guestName,
      guestDocument: r.guestDocument,
      checkinDate: r.checkinDate,
      checkoutDate: r.checkoutDate,
      checkinTime: r.checkinTime || '14:00',
      checkoutTime: r.checkoutTime || '11:00',
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
    if (!completeForm.checkinDate || !completeForm.checkoutDate) {
      setError('Escolha o período da estadia (check-in e check-out).');
      return;
    }
    try {
      await api.updateReservation(id, {
        guestName: completeForm.guestName,
        guestDocument: completeForm.guestDocument.trim(),
        checkinDate: completeForm.checkinDate,
        checkoutDate: completeForm.checkoutDate,
        checkinTime: completeForm.checkinTime,
        checkoutTime: completeForm.checkoutTime,
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
          className={`border-l-2 bg-elevated/20 transition-colors hover:bg-elevated/60 ${
            needsData ? 'border-warning' : 'border-transparent'
          } ${cancelled ? 'opacity-55' : ''}`}
        >
          <td className={td}>
            {r.guestName}
            {r.guestDocument && (
              <span className="mt-0.5 block text-[11px] text-muted">RG {r.guestDocument}</span>
            )}
          </td>
          <td className={tdNowrap}>
            {formatDate(r.checkinDate)}
            <span className="mt-0.5 block text-[11px] text-muted">{r.checkinTime}</span>
          </td>
          <td className={tdNowrap}>
            {formatDate(r.checkoutDate)}
            <span className="mt-0.5 block text-[11px] text-muted">{r.checkoutTime}</span>
          </td>
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
            <button
              type="button"
              onClick={() => toggleFlag(r, 'condoRegistered')}
              className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                r.condoRegistered
                  ? 'bg-success/12 text-success hover:bg-success/20'
                  : 'bg-muted/12 text-muted hover:bg-muted/20'
              }`}
            >
              {r.condoRegistered ? 'Cadastrado' : 'Pendente'}
            </button>
          </td>
          <td className={tdNowrap}>
            <div className="flex items-center justify-end gap-1.5">
              {!cancelled && (
                <IconButton
                  icon={<UserPlus className="h-3.5 w-3.5" />}
                  label={
                    r.condoRegistered ? 'Já cadastrado no condomínio' : 'Cadastrar no condomínio'
                  }
                  onClick={() => openCondoModal(r)}
                  disabled={r.condoRegistered}
                />
              )}
              {!cancelled && (
                <IconButton
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  label={needsData ? 'Completar reserva' : 'Editar reserva'}
                  onClick={() => toggleComplete(r)}
                />
              )}
              <IconButton
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Excluir reserva"
                onClick={() => handleDelete(r)}
                colorClass="bg-danger/10 text-danger hover:bg-danger/20"
                tooltipAlign="right"
              />
            </div>
          </td>
        </tr>
        {completingId === r.id && (
          <tr className={needsData ? 'bg-elevated/60' : 'bg-elevated/20'}>
            <td className="p-0" colSpan={7}>
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
                  <label className="flex w-44 flex-col gap-1 text-xs text-muted">
                    RG do hóspede
                    <input
                      className={inputCls}
                      value={completeForm.guestDocument}
                      onChange={(e) =>
                        setCompleteForm({ ...completeForm, guestDocument: e.target.value })
                      }
                      placeholder="Para o condomínio"
                    />
                  </label>
                  <label className="flex w-60 flex-col gap-1 text-xs text-muted">
                    Período (check-in → check-out)
                    <DateRangePicker
                      start={completeForm.checkinDate}
                      end={completeForm.checkoutDate}
                      onChange={(start, end) =>
                        setCompleteForm({ ...completeForm, checkinDate: start, checkoutDate: end })
                      }
                    />
                  </label>
                  <label className="flex w-32 flex-col gap-1 text-xs text-muted">
                    Hora check-in
                    <input
                      type="time"
                      className={inputCls}
                      value={completeForm.checkinTime}
                      onChange={(e) =>
                        setCompleteForm({ ...completeForm, checkinTime: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="flex w-32 flex-col gap-1 text-xs text-muted">
                    Hora check-out
                    <input
                      type="time"
                      className={inputCls}
                      value={completeForm.checkoutTime}
                      onChange={(e) =>
                        setCompleteForm({ ...completeForm, checkoutTime: e.target.value })
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

  // Tabela de um mês — usada tanto no card do mês atual quanto nas linhas do
  // arquivo de meses anteriores (evita duplicar o cabeçalho e o colgroup).
  function renderMonthTable(rows: Reservation[]) {
    return (
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[15%]" />
          <col className="w-[11%]" />
          <col className="w-[13%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-line/50">
            <th className={th}>Hóspede</th>
            <th className={th}>Check-in</th>
            <th className={th}>Check-out</th>
            <th className={th}>Valor</th>
            <th className={th}>Status</th>
            <th className={th}>Condomínio</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/40">{rows.map((r) => renderRow(r))}</tbody>
      </table>
    );
  }

  // Linha compacta de um mês (cabeçalho clicável + tabela colapsável). Mesma
  // aparência no "Mês atual" e no "Outros meses" — só o rótulo da seção muda.
  function renderMonthRow(g: { key: string; rows: Reservation[] }) {
    const collapsed = !expandedMonths.has(g.key);
    return (
      <div key={g.key}>
        <button
          type="button"
          onClick={() => toggleMonth(g.key)}
          aria-expanded={!collapsed}
          className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-elevated/50 ${
            collapsed ? '' : 'border-b border-line/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted/70 transition-transform duration-300 ${
                collapsed ? '-rotate-90' : ''
              }`}
            />
            <h3 className="text-sm font-medium capitalize text-content">{monthLabel(g.key)}</h3>
          </div>
          <span className="text-xs text-muted/80">
            {g.rows.length} {g.rows.length === 1 ? 'reserva' : 'reservas'}
          </span>
        </button>
        <HeightCollapse show={!collapsed}>
          <div>{renderMonthTable(g.rows)}</div>
        </HeightCollapse>
      </div>
    );
  }

  // Mês atual e demais meses seguem a mesma lista compacta, em seções
  // separadas; os "outros meses" vêm do mais recente pro mais antigo.
  const nowKey = currentMonthKey();
  const chronological = groupByMonth(items);
  const currentGroup = chronological.find((g) => g.key === nowKey) ?? null;
  const otherGroups = chronological.filter((g) => g.key !== nowKey).reverse();

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Reservas</h2>
        <div className="flex gap-2">
          <button className={btnPrimary} onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Sincronizar com Airbnb'}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportCsv}
          />
          <button
            className={btnSecondary}
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            title="Importar o relatório de ganhos do Airbnb (CSV) — traz nome, valor e reservas passadas"
          >
            <FileUp className="h-4 w-4" />
            {importing ? 'Importando…' : 'Importar CSV'}
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

      <div className="mb-4 mt-7 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-sm text-muted">
          <Switch checked={pendingOnly} onChange={() => setPendingOnly((v) => !v)} />
          Mostrar só com dados pendentes
        </label>
        <YearPicker value={year} onChange={setYear} />
      </div>

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
              RG do hóspede
              <input
                className={inputCls}
                value={form.guestDocument}
                onChange={(e) => setForm({ ...form, guestDocument: e.target.value })}
                placeholder="Para o condomínio"
              />
            </label>
            <label className={`${labelCls} min-w-[230px]`}>
              Período (check-in → check-out)
              <DateRangePicker
                start={form.checkinDate}
                end={form.checkoutDate}
                onChange={(start, end) =>
                  setForm({ ...form, checkinDate: start, checkoutDate: end })
                }
              />
            </label>
            <label className={labelCls}>
              Horário de check-in
              <input
                type="time"
                className={inputCls}
                value={form.checkinTime}
                onChange={(e) => setForm({ ...form, checkinTime: e.target.value })}
                required
              />
            </label>
            <label className={labelCls}>
              Horário de checkout
              <input
                type="time"
                className={inputCls}
                value={form.checkoutTime}
                onChange={(e) => setForm({ ...form, checkoutTime: e.target.value })}
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
          Nenhuma reserva em {year}. Clique em “Sincronizar com Airbnb”, “Importar CSV” ou “Nova
          reserva” — ou troque o ano ao lado do filtro.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Mês atual — mesma lista compacta, só com rótulo próprio */}
          {currentGroup && (
            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-brand/80">
                Mês atual
              </p>
              <div className={`divide-y divide-line/50 overflow-hidden rounded-2xl ${surfaceCls}`}>
                {renderMonthRow(currentGroup)}
              </div>
            </div>
          )}

          {/* Outros meses — do mais recente pro mais antigo */}
          {otherGroups.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted/70">
                Outros meses
              </p>
              <div className={`divide-y divide-line/50 overflow-hidden rounded-2xl ${surfaceCls}`}>
                {otherGroups.map((g) => renderMonthRow(g))}
              </div>
            </div>
          )}
        </div>
      )}

      {condoModalReservation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className={`w-full max-w-md rounded-2xl p-5 ${surfaceCls}`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Cadastrar no condomínio</h3>
              <button
                className="rounded-full p-1 text-muted hover:bg-elevated disabled:opacity-40"
                onClick={closeCondoModal}
                disabled={condoLoading}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-elevated/70 p-3 text-xs text-muted">
              <p className="mb-1.5 font-medium text-content">Dados que serão enviados ao portal:</p>
              <p>
                Hóspede: <strong className="text-content">{condoModalReservation.guestName}</strong>
              </p>
              <p>
                RG: <strong className="text-content">{condoModalReservation.guestDocument}</strong>
              </p>
              <p>
                Período:{' '}
                <strong className="text-content">
                  {formatDate(condoModalReservation.checkinDate)} {condoModalReservation.checkinTime}
                </strong>{' '}
                →{' '}
                <strong className="text-content">
                  {formatDate(condoModalReservation.checkoutDate)} {condoModalReservation.checkoutTime}
                </strong>
              </p>
            </div>

            <p className="mb-2 text-xs text-muted">
              Campos opcionais do veículo (preencha se o hóspede for de carro):
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              <label className={labelCls}>
                Modelo
                <input
                  className={inputCls}
                  value={condoForm.vehicleModel}
                  onChange={(e) => setCondoForm({ ...condoForm, vehicleModel: e.target.value })}
                />
              </label>
              <label className={labelCls}>
                Placa
                <input
                  className={inputCls}
                  value={condoForm.vehiclePlate}
                  onChange={(e) => setCondoForm({ ...condoForm, vehiclePlate: e.target.value })}
                />
              </label>
              <label className={labelCls}>
                Cor
                <input
                  className={inputCls}
                  value={condoForm.vehicleColor}
                  onChange={(e) => setCondoForm({ ...condoForm, vehicleColor: e.target.value })}
                />
              </label>
            </div>

            <Collapse
              show={!!condoError}
              className="mb-3 rounded-xl bg-danger/12 px-3 py-2 text-xs text-danger"
            >
              {condoError}
            </Collapse>

            <div className="flex justify-end gap-2">
              <button className={btnSecondary} onClick={closeCondoModal} disabled={condoLoading}>
                Cancelar
              </button>
              <button className={btnPrimary} onClick={handleRegisterCondo} disabled={condoLoading}>
                {condoLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Cadastrando… (~15-30s)
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirmar cadastro
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
