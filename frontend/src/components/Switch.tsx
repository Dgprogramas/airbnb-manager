interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
}

// Toggle no estilo UISwitch da Apple: proporção ~1.7:1, trilho liso (sem
// borda) preenchido com cinza neutro no "off", bolinha branca com sombra
// de elevação e um slide seco (sem "overshoot") — igual ao real.
export default function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-[27px] w-[46px] shrink-0 items-center rounded-full ring-1 ring-inset ring-black/5 ${
        checked ? 'bg-success' : 'bg-muted/25'
      }`}
    >
      <span
        className={`inline-block h-[23px] w-[23px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out ${
          checked ? 'translate-x-[21px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  );
}
