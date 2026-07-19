import type { ReactNode } from 'react';

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  colorClass?: string;
  /** Âncora do tooltip: 'center' (padrão) ou 'right' para botões encostados
   *  na borda direita do card (evita o balão ser cortado pelo overflow). */
  tooltipAlign?: 'center' | 'right';
  /** Desabilita o clique mantendo o botão visível (o tooltip continua
   *  funcionando — o hover fica no wrapper, não no botão). */
  disabled?: boolean;
}

const defaultColor = 'bg-muted/10 text-muted hover:bg-muted/20 hover:text-content';

// Botão de ícone com tooltip customizado (não depende do title nativo do
// navegador, que é pequeno, lento pra aparecer e alguns usuários nem notam).
export default function IconButton({
  icon,
  label,
  onClick,
  colorClass = defaultColor,
  tooltipAlign = 'center',
  disabled = false,
}: IconButtonProps) {
  const alignCls =
    tooltipAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  return (
    <div className="group/tip relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`rounded-full p-1.5 transition-colors ${colorClass} ${
          disabled ? 'cursor-not-allowed opacity-40' : ''
        }`}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full z-20 mb-1.5 whitespace-nowrap rounded-md bg-content px-2 py-1 text-[11px] font-medium text-surface opacity-0 shadow-md transition-opacity duration-150 group-hover/tip:opacity-100 ${alignCls}`}
      >
        {label}
      </span>
    </div>
  );
}
