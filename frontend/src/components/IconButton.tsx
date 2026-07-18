import type { ReactNode } from 'react';

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  colorClass?: string;
}

const defaultColor = 'bg-muted/10 text-muted hover:bg-muted/20 hover:text-content';

// Botão de ícone com tooltip customizado (não depende do title nativo do
// navegador, que é pequeno, lento pra aparecer e alguns usuários nem notam).
export default function IconButton({ icon, label, onClick, colorClass = defaultColor }: IconButtonProps) {
  return (
    <div className="group/tip relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`rounded-full p-1.5 transition-colors ${colorClass}`}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-content px-2 py-1 text-[11px] font-medium text-surface opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </div>
  );
}
