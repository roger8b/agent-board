"use client";

import { useEffect, useState } from "react";

const AGENT_COLORS = ["#2383E2", "#7C3AED", "#D97706", "#17A34A", "#DC2626", "#0891B2", "#4F46E5", "#374151"];

type Agent = { id: number; name: string; prompt: string; color: string; active: boolean };

const SEED: Agent[] = [
  { id: 1, name: "Analyst", prompt: "Especialista em pesquisa e análise de dados. Responde com precisão, estrutura informações em tópicos claros e indica fontes quando aplicável.", color: "#2383E2", active: true },
  { id: 2, name: "Coder", prompt: "Desenvolvedor de código. Escreve soluções limpas, bem documentadas e seguindo boas práticas. Explica decisões técnicas quando solicitado.", color: "#7C3AED", active: true },
  { id: 3, name: "Reviewer", prompt: "Revisor e validador. Analisa resultados com olhar crítico, identifica lacunas e sugere melhorias concretas. Não aprova trabalho incompleto.", color: "#D97706", active: true },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(SEED);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [color, setColor] = useState(AGENT_COLORS[0]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("agentboard-agents");
      if (s) setAgents(JSON.parse(s));
    } catch {}
  }, []);

  function persist(next: Agent[]) {
    setAgents(next);
    try {
      localStorage.setItem("agentboard-agents", JSON.stringify(next));
    } catch {}
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setPrompt("");
    setColor(AGENT_COLORS[0]);
    setOpen(true);
  }

  function openEdit(a: Agent) {
    setEditingId(a.id);
    setName(a.name);
    setPrompt(a.prompt);
    setColor(a.color);
    setOpen(true);
  }

  function save() {
    if (!name.trim()) return;
    if (editingId) {
      persist(agents.map((a) => (a.id === editingId ? { ...a, name: name.trim(), prompt: prompt.trim(), color } : a)));
    } else {
      persist([...agents, { id: Date.now(), name: name.trim(), prompt: prompt.trim(), color, active: true }]);
    }
    setOpen(false);
  }

  function remove(id: number) {
    if (!confirm("Excluir este agente?")) return;
    persist(agents.filter((a) => a.id !== id));
    if (editingId === id) setOpen(false);
  }

  return (
    <main className="main">
      <div className="page-header row">
        <div>
          <h1>Agentes</h1>
          <p>Crie e gerencie os agentes de IA que executam suas tarefas.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo Agente
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
            <circle cx="9" cy="8" r="4" /><path d="M3 20c0-3.3 2.7-6 6-6" />
            <circle cx="17" cy="7" r="3" /><path d="M15 14c.8 1.8 2.5 3 4.5 3" />
          </svg>
          <p>Nenhum agente criado ainda. Clique em &quot;Novo Agente&quot; para começar.</p>
        </div>
      ) : (
        <div className="agent-grid">
          {agents.map((a) => (
            <div className="agent-card" key={a.id}>
              <div className="agent-card-header">
                <div className="agent-avatar-lg" style={{ background: a.color }}>
                  {initials(a.name)}
                </div>
                <div className="agent-card-actions">
                  <button className="icon-btn" title="Editar" onClick={() => openEdit(a)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button className="icon-btn danger" title="Excluir" onClick={() => remove(a.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <h3>{a.name}</h3>
              <p>{a.prompt}</p>
              <div className="agent-colors">
                <span className="color-dot" style={{ background: a.color }} />
                <span className="color-dot" style={{ background: a.color, opacity: 0.5 }} />
                <span className="color-dot" style={{ background: a.color, opacity: 0.25 }} />
              </div>
              <div className="agent-card-footer">
                <span className={`agent-status${a.active ? "" : " inactive"}`}>
                  {a.active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`overlay${open ? " open" : ""}`} onClick={() => setOpen(false)} />
      <div className={`modal${open ? " open" : ""}`}>
        <div className="modal-header">
          <h2>{editingId ? "Editar Agente" : "Criar Agente"}</h2>
          <button className="modal-close" onClick={() => setOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Nome</label>
            <input
              className="field-input"
              type="text"
              maxLength={60}
              placeholder="Ex: Analista de Dados"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Prompt / Comportamento</label>
            <textarea
              className="field-textarea"
              placeholder="Descreva o papel e o comportamento do agente."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Cor do agente</label>
            <div className="color-picker">
              {AGENT_COLORS.map((c) => (
                <div
                  key={c}
                  className={`color-option${color === c ? " selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {editingId && (
            <button className="btn-secondary" style={{ marginRight: "auto" }} onClick={() => remove(editingId)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Excluir
            </button>
          )}
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={save}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
            </svg>
            Salvar
          </button>
        </div>
      </div>
    </main>
  );
}
