import Reservas from './pages/Reservas';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1>🏠 Airbnb Manager</h1>
        <nav className="nav">
          <span className="nav-item active">Reservas</span>
          <span className="nav-item disabled">Despesas (em breve)</span>
          <span className="nav-item disabled">Fechamento (em breve)</span>
          <span className="nav-item disabled">Configurações (em breve)</span>
        </nav>
      </header>
      <main className="content">
        <Reservas />
      </main>
    </div>
  );
}
