import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import type { Closing, ExpenseCategory } from '../types';
import * as api from '../api';
import { CATEGORY_LABELS, currentMonth, formatMoney } from '../lib/format';
import { surfaceCls } from '../lib/ui';
import MonthPicker from '../components/MonthPicker';

export default function Fechamento() {
  const [month, setMonth] = useState(currentMonth());
  const [closing, setClosing] = useState<Closing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getClosing(month)
      .then((c) => {
        if (active) setClosing(c);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month]);

  const categories = closing
    ? (Object.entries(closing.expensesByCategory) as [ExpenseCategory, number][])
    : [];

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Fechamento mensal</h2>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <p className="mt-3 text-muted">Carregando…</p>
      ) : error ? (
        <p className="mt-3 rounded-xl bg-danger/12 px-3.5 py-2.5 text-sm text-danger">{error}</p>
      ) : closing ? (
        <div className="mt-3 space-y-3">
          {closing.pendingCount > 0 && (
            <div className="flex items-start gap-2 rounded-2xl bg-warning/12 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {closing.pendingCount} reserva(s) deste mês ainda sem valor preenchido. A receita
                abaixo pode estar incompleta.
              </span>
            </div>
          )}

          {/* Receita, despesas e saldo */}
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              icon={<ArrowUpRight className="h-4 w-4 text-success" />}
              label="Receita bruta"
              value={formatMoney(closing.grossRevenue)}
              hint={`${closing.reservationsCount} reserva(s)`}
            />
            <SummaryTile
              icon={<ArrowDownRight className="h-4 w-4 text-danger" />}
              label="Despesas"
              value={formatMoney(closing.totalExpenses)}
            />
            <SummaryTile
              icon={<Wallet className="h-4 w-4 text-info" />}
              label="Saldo"
              value={formatMoney(closing.balance)}
              emphasis
            />
          </div>

          {/* Detalhe das despesas por categoria */}
          {categories.length > 0 && (
            <div className={`overflow-hidden rounded-2xl ${surfaceCls}`}>
              <h3 className="border-b border-line/50 px-4 py-3 text-sm font-semibold">
                Despesas por categoria
              </h3>
              <table className="w-full border-collapse text-sm">
                <tbody className="divide-y divide-line/40">
                  {categories.map(([cat, amount]) => (
                    <tr key={cat}>
                      <td className="px-4 py-2.5">{CATEGORY_LABELS[cat]}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Divisão do saldo */}
          <div className={`overflow-hidden rounded-2xl ${surfaceCls}`}>
            <h3 className="border-b border-line/50 px-4 py-3 text-sm font-semibold">
              Divisão do saldo
            </h3>
            <div className="divide-y divide-line/40">
              <SplitRow
                label={`Você (anfitrião) — ${closing.hostSplitPercent}%`}
                value={closing.hostAmount}
              />
              <SplitRow
                label={`${closing.ownerName} (dono) — ${closing.ownerSplitPercent}%`}
                value={closing.ownerAmount}
                emphasis
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
  emphasis,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 ${surfaceCls}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-1.5 tabular-nums ${emphasis ? 'text-2xl font-bold' : 'text-xl font-semibold'}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

function SplitRow({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={emphasis ? 'font-semibold' : ''}>{label}</span>
      <span className={`tabular-nums ${emphasis ? 'text-lg font-bold text-content' : 'font-medium'}`}>
        {formatMoney(value)}
      </span>
    </div>
  );
}
