import { useEffect, useState } from 'react';
import { House, Moon, Sun } from 'lucide-react';
import Reservas from './pages/Reservas';
import Despesas from './pages/Despesas';
import Fechamento from './pages/Fechamento';
import Configuracoes from './pages/Configuracoes';

type Screen = 'reservas' | 'despesas' | 'fechamento' | 'config';

const NAV: { id: Screen; label: string }[] = [
  { id: 'reservas', label: 'Reservas' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'fechamento', label: 'Fechamento' },
  { id: 'config', label: 'Configurações' },
];

export default function App() {
  const [dark, setDark] = useState(true);
  const [screen, setScreen] = useState<Screen>('reservas');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <House className="h-5 w-5 text-brand" />
              Airbnb Manager
            </h1>
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-full p-2 text-muted hover:bg-elevated"
              title={dark ? 'Tema claro' : 'Tema escuro'}
              aria-label="Alternar tema"
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
          <nav className="mt-3.5 inline-flex gap-1 rounded-full bg-elevated/50 p-1 text-sm ring-1 ring-black/5">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                  screen === item.id
                    ? 'bg-surface/90 text-content shadow-sm'
                    : 'text-muted hover:text-content'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        {screen === 'reservas' && <Reservas />}
        {screen === 'despesas' && <Despesas />}
        {screen === 'fechamento' && <Fechamento />}
        {screen === 'config' && <Configuracoes />}
      </main>
    </div>
  );
}
