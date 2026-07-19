import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  start: string; // 'YYYY-MM-DD' ou ''
  end: string; // 'YYYY-MM-DD' ou ''
  onChange: (start: string, end: string) => void;
  placeholder?: string;
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // semana começa no domingo

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function formatBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

// Seletor de período (check-in → check-out) num calendário único, no estilo
// iOS do projeto: primeiro clique marca o início, segundo marca o fim, e o
// intervalo fica destacado em coral. Clicar num dia anterior ao início
// recomeça a seleção dali.
export default function DateRangePicker({
  start,
  end,
  onChange,
  placeholder = 'Selecionar período',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [hoverIso, setHoverIso] = useState('');
  const initial = start ? start.split('-').map(Number) : null;
  const [viewYear, setViewYear] = useState(initial ? initial[0] : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initial ? initial[1] - 1 : new Date().getMonth());
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Ao abrir, mostra o mês do check-in escolhido (ou o atual).
  useEffect(() => {
    if (open && start) {
      const [y, m] = start.split('-').map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [open, start]);

  function shift(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function pick(day: number) {
    const iso = toIso(viewYear, viewMonth, day);
    const selectingEnd = start && !end;
    if (selectingEnd && iso > start) {
      onChange(start, iso);
      setOpen(false);
    } else {
      // Sem início ainda, ou clicou antes/em cima do início, ou período já
      // completo: (re)começa a seleção a partir deste dia.
      onChange(iso, '');
    }
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0=domingo
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayIso();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Fim do destaque: o check-out escolhido ou, enquanto escolhe, o dia sob o
  // mouse (pré-visualização do intervalo).
  const previewEnd = end || (start && hoverIso > start ? hoverIso : '');

  const triggerCls =
    'flex w-full items-center justify-between gap-2 rounded-xl border-0 bg-elevated px-3 py-2.5 text-sm text-content outline-none ring-1 ring-inset ring-line focus:ring-2 focus:ring-brand/50';

  const triggerText = start
    ? `${formatBr(start)} → ${end ? formatBr(end) : '…'}`
    : placeholder;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerCls}>
        <span className={start ? '' : 'text-muted'}>{triggerText}</span>
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[280px] animate-reveal rounded-2xl bg-surface p-3 shadow-lg ring-1 ring-black/5">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded-full p-1.5 text-muted hover:bg-brand/10 hover:text-brand"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-content">
              {MONTHS[viewMonth]} de {viewYear}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded-full p-1.5 text-muted hover:bg-brand/10 hover:text-brand"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 border-b border-line pb-2">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-1 text-center text-[11px] font-semibold text-muted">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 pt-2" onMouseLeave={() => setHoverIso('')}>
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const iso = toIso(viewYear, viewMonth, day);
              const isStart = iso === start;
              const isEnd = iso === end;
              const inRange = Boolean(
                start && previewEnd && iso > start && iso < previewEnd
              );
              const isPreviewEnd = Boolean(!end && previewEnd && iso === previewEnd);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(day)}
                  onMouseEnter={() => setHoverIso(iso)}
                  className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors ${
                    isStart || isEnd
                      ? 'bg-brand font-semibold text-white'
                      : inRange
                        ? 'bg-brand/15 text-content'
                        : isPreviewEnd
                          ? 'bg-brand/30 text-content'
                          : 'text-content hover:bg-elevated'
                  }`}
                >
                  {day}
                  {iso === today && !isStart && !isEnd && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-line pt-2 text-center text-xs text-muted">
            {!start ? 'Escolha o check-in' : !end ? 'Agora o check-out' : 'Período escolhido'}
          </div>
        </div>
      )}
    </div>
  );
}
