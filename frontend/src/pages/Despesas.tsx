import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Expense, ExpenseCategory } from '../types';
import * as api from '../api';
import { CATEGORY_LABELS, CATEGORY_ORDER, currentMonth, formatMoney } from '../lib/format';
import { btnGhost, btnPrimary, btnSecondary, cardCls, inputCls, labelCls, surfaceCls } from '../lib/ui';
import MonthPicker from '../components/MonthPicker';
import Collapse from '../components/Collapse';

const EMPTY_FORM = { category: 'luz' as ExpenseCategory, amount: '', description: '' };

export default function Despesas() {
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listExpenses(month));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

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

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const payload = {
      month,
      category: form.category,
      amount: Number(form.amount) || 0,
      description: form.description.trim(),
    };
    try {
      if (editingId != null) {
        await api.updateExpense(editingId, payload);
        setMessage('Despesa atualizada.');
      } else {
        await api.createExpense(payload);
        setMessage('Despesa adicionada.');
      }
      closeForm();
      await load();
    } catch (e2) {
      setError((e2 as Error).message);
    }
  }

  async function handleDelete(expense: Expense) {
    const ok = window.confirm(
      `Excluir a despesa de ${CATEGORY_LABELS[expense.category]} (${formatMoney(expense.amount)})?`
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    try {
      await api.deleteExpense(expense.id);
      setItems((prev) => prev.filter((it) => it.id !== expense.id));
      setMessage('Despesa excluída.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const total = items.reduce((sum, it) => sum + it.amount, 0);

  // Ordena as despesas pela ordem canônica das categorias.
  const sorted = [...items].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
  );

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Despesas</h2>
        <div className="flex items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} />
          <button className={btnPrimary} onClick={openNew}>
            <Plus className="h-4 w-4" />
            Nova despesa
          </button>
        </div>
      </div>

      <Collapse show={showForm} className={`my-3 ${cardCls}`}>
        <form onSubmit={handleSubmit}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{editingId != null ? 'Editar despesa' : 'Nova despesa'}</h3>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full p-1.5 text-muted hover:bg-elevated"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <label className={labelCls}>
              Categoria
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
              >
                {CATEGORY_ORDER.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Valor (R$)
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </label>
            <label className={labelCls}>
              Descrição (opcional)
              <input
                className={inputCls}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="ex.: fatura de julho"
              />
            </label>
          </div>
          <button type="submit" className={btnPrimary}>
            <Check className="h-4 w-4" />
            Salvar
          </button>
        </form>
      </Collapse>

      <Collapse
        show={!!message}
        className="my-2 rounded-xl bg-success/12 px-3.5 py-2.5 text-sm text-success"
      >
        {message}
      </Collapse>
      <Collapse
        show={!!error}
        className="my-2 rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger"
      >
        {error}
      </Collapse>

      {loading ? (
        <p className="mt-3 text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className={`mt-3 rounded-2xl p-8 text-center text-muted ${surfaceCls}`}>
          Nenhuma despesa neste mês. Clique em “Nova despesa” para adicionar.
        </p>
      ) : (
        <div className={`mt-3 overflow-hidden rounded-2xl ${surfaceCls}`}>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line/50">
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-muted/80">
                  Categoria
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-muted/80">
                  Descrição
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-muted/80">
                  Valor
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40">
              {sorted.map((expense) => (
                <tr key={expense.id} className="transition-colors hover:bg-elevated/60">
                  <td className="px-4 py-3 font-medium">{CATEGORY_LABELS[expense.category]}</td>
                  <td className="px-4 py-3 text-muted">{expense.description || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(expense.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className={btnGhost} onClick={() => openEdit(expense)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                        onClick={() => handleDelete(expense)}
                        aria-label="Excluir despesa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className={`mt-3 flex items-center justify-between px-4 py-3.5 rounded-2xl ${surfaceCls}`}>
          <span className="text-sm font-medium text-muted">Total do mês</span>
          <span className="text-lg font-bold tabular-nums">{formatMoney(total)}</span>
        </div>
      )}
    </section>
  );
}
