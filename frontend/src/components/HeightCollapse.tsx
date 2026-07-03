import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface HeightCollapseProps {
  show: boolean;
  children: ReactNode;
  className?: string;
  /** Chamado quando a animação de fechamento termina (conteúdo desmontado). */
  onClosed?: () => void;
}

// Animação de altura (abrir/fechar) via truque grid-rows 0fr↔1fr: suave mesmo
// sem saber a altura do conteúdo, e sem "pulo" no layout ao redor. Mantém o
// conteúdo montado durante o fechamento e só desmonta quando a transição acaba.
export default function HeightCollapse({
  show,
  children,
  className = '',
  onClosed,
}: HeightCollapseProps) {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(show); // se já nasce visível, não anima na 1ª renderização
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (show) {
      setMounted(true);
      // próximo frame: garante que o 0fr foi pintado antes de ir pra 1fr (senão não anima)
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
  }, [show]);

  if (!mounted) return null;

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      onTransitionEnd={(e) => {
        if (e.propertyName !== 'grid-template-rows') return;
        if (!open) {
          setMounted(false);
          onClosed?.();
        }
      }}
    >
      <div className={`overflow-hidden ${className}`}>{children}</div>
    </div>
  );
}
