import Reservas from './pages/Reservas';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="mb-3 text-xl font-semibold">🏠 Airbnb Manager</h1>
        <nav className="flex flex-wrap gap-4 text-sm">
          <span className="font-semibold text-brand">Reservas</span>
          <span className="text-neutral-400">Despesas (em breve)</span>
          <span className="text-neutral-400">Fechamento (em breve)</span>
          <span className="text-neutral-400">Configurações (em breve)</span>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-6">
        <Reservas />
      </main>
    </div>
  );
}
