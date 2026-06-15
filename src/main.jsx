import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Accessibility,
  BarChart3,
  Building2,
  Camera,
  CheckCircle2,
  Clock3,
  EyeOff,
  Home,
  History,
  RefreshCw,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  Video,
} from "lucide-react";
import "./styles.css";

const initialData = {
  peopleCount: 0,
  limit: 8,
  status: "CARREGANDO",
  cameraOnline: false,
  updatedAt: null,
  error: null,
};

const navItems = [
  { label: "Inicio", icon: Home, active: true },
  { label: "Banheiros", icon: UsersRound },
  { label: "Historico", icon: History },
  { label: "Relatorios", icon: BarChart3 },
  { label: "Configuracoes", icon: Settings },
];

function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function estimateMinutes(count) {
  return Math.max(1, Math.round(count * 1.6 + 1));
}

function QueueCard({ bathroom, count, limit, online, updatedAt, onRefresh }) {
  const Icon = bathroom.icon;
  const tone = online ? bathroom.tone : "offline";
  const full = online && count >= limit;
  const statusText = online ? (full ? "fila cheia" : "ao vivo") : "aguardando sinal";

  return (
    <article className={`bathroom-card ${tone}`}>
      <div className="bathroom-title">
        <span className="bathroom-icon">
          <Icon size={24} />
        </span>
        <div>
          <h2>{bathroom.name}</h2>
          <p>{bathroom.location}</p>
        </div>
      </div>

      <div className="sensor-panel">
        <div className="live-badge">
          <span />
          {statusText}
        </div>
        <button className="ghost-button" type="button" onClick={onRefresh} aria-label="Atualizar leitura">
          <RefreshCw size={18} />
        </button>
        <div className="sensor-lines">
          <i />
          <i />
          <i />
        </div>
        <UsersRound className="sensor-users" size={82} />
        <EyeOff className="sensor-privacy" size={28} />
      </div>

      <div className="queue-details">
        <span>Pessoas na fila</span>
        <div className="queue-count">
          <strong>{count}</strong>
          <small>{count === 1 ? "pessoa" : "pessoas"}</small>
        </div>
      </div>

      <div className="wait-line">
        <span>Tempo estimado de espera</span>
        <strong>
          <Clock3 size={16} />
          ~ {estimateMinutes(count)} min
        </strong>
      </div>

      <footer>
        <span />
        Ultima atualizacao: {online ? formatTime(updatedAt) : "sem camera"}
      </footer>
    </article>
  );
}

function App() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);

  async function loadCount() {
    setLoading(true);
    try {
      const response = await fetch("/api/count");
      const payload = await response.json();
      setData({ ...initialData, ...payload });
    } catch (error) {
      setData((current) => ({
        ...current,
        status: "SEM SINAL",
        cameraOnline: false,
        error: "Nao foi possivel conectar ao BFF.",
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 1200);
    return () => clearInterval(timer);
  }, []);

  const bathrooms = useMemo(
    () => [
      {
        name: "Banheiro Principal",
        location: "Camera local conectada",
        icon: UserRound,
        tone: "blue",
        count: data.peopleCount,
        online: data.cameraOnline,
      },
      {
        name: "Banheiro Cantina",
        location: "Modulo preparado",
        icon: UserRound,
        tone: "rose",
        count: 0,
        online: false,
      },
      {
        name: "Banheiro Acessivel",
        location: "Modulo preparado",
        icon: Accessibility,
        tone: "green",
        count: 0,
        online: false,
      },
    ],
    [data.cameraOnline, data.peopleCount],
  );

  const totalPeople = bathrooms.reduce((sum, item) => sum + item.count, 0);
  const isFull = data.cameraOnline && data.peopleCount >= data.limit;
  const statusText = data.cameraOnline ? (isFull ? "Fila cheia" : "Pode liberar") : "Camera offline";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="school-brand">
          <Building2 size={48} />
          <strong>aura</strong>
          <span>Escola Maria Augusta Siqueira</span>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a className={item.active ? "active" : ""} href="#" key={item.label}>
                <Icon size={20} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="camera-note">
          <Video size={18} />
          <strong>Monitoramento por camera e IA</strong>
          <p>O sistema conta pessoas sem exibir ou armazenar imagens.</p>
          <span>
            <i />
            Sistema {data.cameraOnline ? "ativo" : "sem sinal"}
          </span>
        </div>
      </aside>

      <section className="dashboard">
        <header className="dashboard-header">
          <div>
            <p>Ola, estudante!</p>
            <h1>Monitoramento da Fila dos Banheiros</h1>
            <span>Acompanhe em tempo real o numero de pessoas detectadas pela camera local.</span>
          </div>
          <div className="time-card">
            <Clock3 size={24} />
            <strong>{formatTime(new Date())}</strong>
            <span>{todayLabel()}</span>
          </div>
        </header>

        <section className="summary-row">
          <div className="summary-card">
            <UsersRound size={24} />
            <span>Total agora</span>
            <strong>{totalPeople}</strong>
          </div>
          <div className={`summary-card ${isFull ? "danger" : "success"}`}>
            <CheckCircle2 size={24} />
            <span>Status</span>
            <strong>{statusText}</strong>
          </div>
          <button className="summary-card button-card" type="button" onClick={loadCount}>
            <RefreshCw size={24} className={loading ? "spin" : ""} />
            <span>Atualizar</span>
            <strong>Agora</strong>
          </button>
        </section>

        <section className="bathroom-grid">
          {bathrooms.map((bathroom) => (
            <QueueCard
              bathroom={bathroom}
              count={bathroom.count}
              key={bathroom.name}
              limit={data.limit}
              online={bathroom.online}
              updatedAt={data.updatedAt}
              onRefresh={loadCount}
            />
          ))}
        </section>

        <section className="privacy-banner">
          <div className="shield-mark">
            <ShieldCheck size={30} />
          </div>
          <div>
            <h2>Privacidade e Seguranca</h2>
            <p>
              A camera e acessada apenas pelo backend para contagem de pessoas. Nenhuma imagem aparece na
              interface.
            </p>
          </div>
          <div className="privacy-visual">
            <UsersRound size={46} />
            <Camera size={42} />
          </div>
        </section>

        <footer className="status-line">
          <span>{data.error || "BFF conectado ao detector local"}</span>
          <span>Ultima leitura: {formatTime(data.updatedAt)}</span>
        </footer>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
