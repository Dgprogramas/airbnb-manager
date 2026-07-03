import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel } from '../lib/format';

interface MonthPickerProps {
  value: string; // 'YYYY-MM'
  onChange: (month: string) => void;
}

// Soma `delta` meses a uma chave 'YYYY-MM', tratando a virada de ano.
function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Navegador de mês no estilo iOS: setas nas pontas, rótulo central.
export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-elevated p-1 ring-1 ring-black/5">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-content"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[130px] text-center text-sm font-medium capitalize">
        {monthLabel(value)}
      </span>
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-content"
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
