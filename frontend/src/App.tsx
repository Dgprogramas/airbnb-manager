import { useEffect, useState } from 'react';
import { House, Moon, Sun } from 'lucide-react';
import Reservas from './pages/Reservas';

export default function App() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <House className="h-5 w-5 text-brand" />
              Airbnb Manager
            </h1>
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-lg p-2 text-muted hover:bg-elevated"
              title={dark ? 'Tema claro' : 'Tema escuro'}
              aria-label="Alternar tema"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
          <nav className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-brand">Reservas</span>
            <span className="text-muted/60">Despesas (em breve)</span>
            <span className="text-muted/60">Fechamento (em breve)</span>
            <span className="text-muted/60">Configurações (em breve)</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-6">
        <Reservas />
      </main>
    </div>
  );
}
