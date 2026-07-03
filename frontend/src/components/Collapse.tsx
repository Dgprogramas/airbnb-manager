import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface CollapseProps {
  show: boolean;
  children: ReactNode;
  className?: string;
}

// Mantém o conteúdo montado durante a animação de saída (reveal-out) e só
// desmonta depois que ela termina — qualquer exibição condicional (painel,
// aviso, banner) ganha entrada E saída, nunca some seco.
export default function Collapse({ show, children, className = '' }: CollapseProps) {
  const [mounted, setMounted] = useState(show);
  const [closing, setClosing] = useState(false);
  const wasShown = useRef(show);
  // Guarda o último conteúdo visível: quando quem chama zera o valor (ex.:
  // setMessage(null)) no mesmo momento que esconde, a caixa ainda tem o que
  // mostrar enquanto anima a saída, em vez de ficar vazia.
  const lastChildren = useRef(children);
  if (show) lastChildren.current = children;

  useEffect(() => {
    if (show) {
      setMounted(true);
      setClosing(false);
    } else if (wasShown.current) {
      setClosing(true);
    }
    wasShown.current = show;
  }, [show]);

  if (!mounted) return null;

  return (
    <div
      className={`${className} ${closing ? 'animate-reveal-out' : 'animate-reveal'}`}
      onAnimationEnd={() => {
        if (closing) {
          setMounted(false);
          setClosing(false);
        }
      }}
    >
      {show ? children : lastChildren.current}
    </div>
  );
}
