"use client";

import { useEffect, useRef, useState } from "react";

type Col = { id: string; name: string; color: string };

const DEFAULT_COLS: Col[] = [
  { id: "backlog", name: "Backlog", color: "#9B9A97" },
  { id: "refinement", name: "Refinement", color: "#2383E2" },
  { id: "development", name: "Development", color: "#7C3AED" },
  { id: "review", name: "Review", color: "#D97706" },
  { id: "done", name: "Done", color: "#17A34A" },
];

const COL_COLORS = ["#9B9A97", "#2383E2", "#7C3AED", "#D97706", "#17A34A", "#DC2626", "#0891B2", "#4F46E5"];

const BEHAVIOR_KEYS = ["refinement", "development", "review", "done"] as const;
type BehaviorKey = (typeof BEHAVIOR_KEYS)[number];

const BEHAVIOR_PLACEHOLDERS: Record<BehaviorKey, string> = {
  refinement: "Ex: Faça perguntas ao usuário para clarificar escopo e contexto antes de prosseguir.",
  development: "Ex: Execute a tarefa. Divida em subtarefas se necessário. Reporte progresso a cada passo.",
  review: "Ex: Revise o resultado. Valide completude e qualidade. Solicite correções se necessário.",
  done: "Ex: Informe ao usuário que a tarefa foi concluída. Anexe resumo do que foi feito.",
};

export default function SettingsPage() {
  const [columns, setColumns] = useState<Col[]>(DEFAULT_COLS);
  const [behaviors, setBehaviors] = useState<Record<BehaviorKey, string>>({
    refinement: "",
    development: "",
    review: "",
    done: "",
  });
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const c = localStorage.getItem("agentboard-columns");
      if (c) setColumns(JSON.parse(c));
      const b = localStorage.getItem("agentboard-behaviors");
      if (b) setBehaviors(JSON.parse(b));
    } catch {}
  }, []);

  function showToast() {
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 2000);
  }

  function persistCols(next: Col[]) {
    setColumns(next);
    try {
      localStorage.setItem("agentboard-columns", JSON.stringify(next));
    } catch {}
    showToast();
  }

  function persistBehaviors(next: Record<BehaviorKey, string>) {
    setBehaviors(next);
    try {
      localStorage.setItem("agentboard-behaviors", JSON.stringify(next));
    } catch {}
    showToast();
  }

  function renameCol(id: string, val: string) {
    persistCols(columns.map((c) => (c.id === id ? { ...c, name: val.trim() || c.name } : c)));
  }

  function addColumn() {
    const used = columns.map((c) => c.color);
    const nextColor = COL_COLORS.find((c) => !used.includes(c)) || COL_COLORS[0];
    persistCols([...columns, { id: "col-" + Date.now(), name: "Coluna " + (columns.length + 1), color: nextColor }]);
  }

  function deleteCol(id: string) {
    if (columns.length <= 1) return;
    if (!confirm("Remover esta coluna?")) return;
    persistCols(columns.filter((c) => c.id !== id));
  }

  function exportData() {
    const data = { columns, behaviors, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agentboard-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(String(e.target?.result));
          if (data.columns) persistCols(data.columns);
          if (data.behaviors) persistBehaviors(data.behaviors);
        } catch (err) {
          alert("Arquivo inválido: " + (err as Error).message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function clearAll() {
    if (!confirm("Tem certeza? Todos os cards, agentes e configurações serão excluídos permanentemente.")) return;
    try {
      localStorage.clear();
    } catch {}
    setColumns(DEFAULT_COLS);
    setBehaviors({ refinement: "", development: "", review: "", done: "" });
    showToast();
  }

  return (
    <main className="main narrow">
      <div className="page-header">
        <h1>Configurações</h1>
        <p>Personalize colunas, comportamento e preferências do Agent Board.</p>
      </div>

      <div className="section">
        <div className="section-title">Colunas do Quadro</div>
        <div className="section-desc">
          Edite o nome das colunas. Dados persistidos localmente. (Em fase futura, sincroniza com o board no banco.)
        </div>
        <div className="col-list">
          {columns.map((col) => (
            <div className="col-item" key={col.id}>
              <span className="col-item-dot" style={{ background: col.color }} />
              <input
                className="col-item-input"
                defaultValue={col.name}
                onBlur={(e) => renameCol(col.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              <button className="col-item-delete" title="Remover" onClick={() => deleteCol(col.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="add-col-btn" onClick={addColumn}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Adicionar coluna
        </button>
      </div>

      <div className="section">
        <div className="section-title">Comportamento do Agente por Etapa</div>
        <div className="section-desc">
          Quando um card entra em uma coluna, o agente atribuído recebe automaticamente instruções específicas daquela etapa.
        </div>
        {BEHAVIOR_KEYS.map((key) => (
          <div className="field-group mb" key={key}>
            <label className="field-label">
              {key[0].toUpperCase() + key.slice(1)} — instrução padrão
            </label>
            <input
              className="field-input"
              placeholder={BEHAVIOR_PLACEHOLDERS[key]}
              value={behaviors[key]}
              onChange={(e) => setBehaviors((b) => ({ ...b, [key]: e.target.value }))}
              onBlur={() => persistBehaviors(behaviors)}
            />
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-title">Dados Locais</div>
        <div className="section-desc">
          Os cards do quadro são armazenados no SQLite local (~/.agent-kanban/data.db). Esta exportação cobre colunas e comportamentos.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-ghost" onClick={exportData}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Exportar dados
          </button>
          <button className="btn-ghost" onClick={importData}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar dados
          </button>
        </div>
      </div>

      <div className="section danger-zone">
        <div className="section-title">Zona de Perigo</div>
        <div className="section-desc">A exclusão de dados locais é permanente e não pode ser desfeita.</div>
        <button className="btn-danger" onClick={clearAll}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Limpar dados locais
        </button>
      </div>

      <div className={`save-msg${toast ? " show" : ""}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Salvo automaticamente
      </div>
    </main>
  );
}
