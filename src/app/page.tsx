import Link from "next/link";

const arrow = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default function HomePage() {
  return (
    <main className="main">
      <div className="page-header">
        <h1>Bem-vindo ao Agent Board</h1>
        <p>Gerencie tarefas delegando para agentes de IA — simples, visual e local.</p>
      </div>

      <div className="screen-grid">
        <Link href="/board" className="screen-card">
          <div className="screen-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="15" rx="1" />
            </svg>
          </div>
          <h3>Quadro Kanban</h3>
          <p>Suas tarefas em colunas. Arraste cards entre etapas, atribua agentes e acompanhe o progresso.</p>
          <div className="screen-card-arrow">Abrir quadro {arrow}</div>
        </Link>

        <Link href="/agents" className="screen-card">
          <div className="screen-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="8" r="4" /><path d="M3 20c0-3.3 2.7-6 6-6" />
              <circle cx="17" cy="7" r="3" /><path d="M15 14c.8 1.8 2.5 3 4.5 3" />
            </svg>
          </div>
          <h3>Agentes</h3>
          <p>Crie e gerencie os agentes de IA que vão executar suas tarefas. Defina nome e comportamento.</p>
          <div className="screen-card-arrow">Gerenciar agentes {arrow}</div>
        </Link>

        <Link href="/settings" className="screen-card">
          <div className="screen-card-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41" />
            </svg>
          </div>
          <h3>Configurações</h3>
          <p>Personalize as colunas do quadro, o comportamento dos agentes por etapa e preferências gerais.</p>
          <div className="screen-card-arrow">Ajustar {arrow}</div>
        </Link>
      </div>
    </main>
  );
}
