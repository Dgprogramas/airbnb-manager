import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

// Checkbox no estilo iOS (Lembretes/Arquivos): quadrado arredondado que
// preenche e o check "pinga" (scale + fade) ao marcar.
export default function Checkbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] ring-1 ring-inset ${
        checked ? 'bg-success ring-success' : 'bg-muted/10 ring-black/15'
      }`}
    >
      <Check
        className={`h-4 w-4 text-white transition-all duration-150 ease-out ${
          checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        }`}
        strokeWidth={3}
      />
    </button>
  );
}
