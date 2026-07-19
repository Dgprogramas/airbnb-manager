import { ChevronLeft, ChevronRight } from 'lucide-react';

interface YearPickerProps {
  value: number;
  onChange: (year: number) => void;
}

// Navegador de ano, no mesmo estilo do MonthPicker mas compacto — é um
// filtro secundário, não deve pesar mais que os botões de ação da tela.
export default function YearPicker({ value, onChange }: YearPickerProps) {
  return (
    <div className="inline-flex items-center rounded-full bg-elevated p-0.5 ring-1 ring-black/5">
      <button
        onClick={() => onChange(value - 1)}
        className="rounded-full p-1 text-muted hover:bg-surface hover:text-content"
        aria-label="Ano anterior"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[40px] text-center text-xs font-medium tabular-nums">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="rounded-full p-1 text-muted hover:bg-surface hover:text-content"
        aria-label="Próximo ano"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
