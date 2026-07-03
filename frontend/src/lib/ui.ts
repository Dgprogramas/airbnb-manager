// Classes Tailwind reaproveitadas entre as telas (mantêm o visual iOS coeso).

export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-full bg-elevated px-4 py-2.5 text-sm font-medium text-content hover:bg-line/60';
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-elevated/70 px-2.5 py-1.5 text-xs font-medium text-content hover:bg-elevated';
export const inputCls =
  'rounded-xl border-0 bg-elevated px-3 py-2.5 text-sm text-content outline-none ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand/50';
export const labelCls = 'flex flex-col gap-1 text-xs text-muted';
export const surfaceCls = 'bg-surface shadow-sm ring-1 ring-black/5';
export const cardCls = `rounded-2xl p-4 ${surfaceCls}`;
