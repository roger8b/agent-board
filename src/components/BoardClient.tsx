"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BoardData, TaskData } from "@/lib/data";
import {
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  createSubTask,
  updateSubTask,
  toggleSubTask,
  deleteSubTask,
  createComment,
  deleteComment,
} from "@/lib/actions";

const AGENTS: Record<string, { label: string; short: string; color: string }> = {
  analyst: { label: "Analyst", short: "AN", color: "#2383E2" },
  coder: { label: "Coder", short: "CO", color: "#7C3AED" },
  reviewer: { label: "Reviewer", short: "RE", color: "#D97706" },
};

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export default function BoardClient({ board }: { board: BoardData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [pTitle, setPTitle] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pAgent, setPAgent] = useState("");
  const [openSub, setOpenSub] = useState<Record<string, boolean>>({});
  const [addingSub, setAddingSub] = useState(false);
  const [comment, setComment] = useState("");

  const tasksById = new Map<string, TaskData>();
  for (const c of board.columns) for (const t of c.tasks) tasksById.set(t.id, t);
  const openTask = openId ? tasksById.get(openId) ?? null : null;
  const openCol = openTask
    ? board.columns.find((c) => c.id === openTask.columnId) ?? null
    : null;

  useEffect(() => {
    if (openTask) {
      setPTitle(openTask.title);
      setPDesc(openTask.description ?? "");
      setPAgent(openTask.agent ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const refresh = () => startTransition(() => router.refresh());
  const run = (p: Promise<unknown>) => p.then(refresh);

  useEffect(() => {
    const es = new EventSource("/api/events");
    const TYPES = [
      "task:created", "task:updated", "task:moved", "task:deleted",
      "subtask:created", "subtask:updated", "subtask:deleted",
      "comment:created", "comment:deleted",
      "column:created", "column:updated", "column:deleted",
    ];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onEvent = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };
    TYPES.forEach((t) => es.addEventListener(t, onEvent));
    return () => {
      if (timer) clearTimeout(timer);
      es.close();
    };
  }, [router]);

  function openCard(id: string) {
    setOpenId(id);
    setAddingSub(false);
    setOpenSub({});
  }
  function closePanel() {
    setOpenId(null);
  }

  function submitAdd(columnId: string) {
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    setAddingCol(null);
    run(createTask(columnId, t));
  }

  function onDrop(columnId: string) {
    setDragOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const task = tasksById.get(id);
    if (!task || task.columnId === columnId) return;
    run(moveTask(id, columnId));
  }

  function saveCard() {
    if (!openId) return;
    run(
      updateTask(openId, {
        title: pTitle.trim() || openTask?.title,
        description: pDesc.trim() || null,
        agent: pAgent || null,
      }),
    );
    closePanel();
  }

  return (
    <div className="board-wrap">
      <div className="board-topbar">
        <h1>Quadro Kanban</h1>
        <div className="topbar-actions">
          <button
            className="btn-ghost"
            onClick={() => {
              const first = board.columns[0];
              if (first) {
                setAddingCol(first.id);
                setNewTitle("");
              }
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo Card
          </button>
        </div>
      </div>

      <div className="board-columns">
        {board.columns.map((col) => (
          <div className="column" key={col.id}>
            <div className="column-header">
              <h2>
                <span className="col-dot" style={{ background: col.color }} />
                {col.name}
              </h2>
              <span className="col-count">{col.tasks.length}</span>
            </div>
            <div
              className={`column-body${dragOver === col.id ? " drag-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={() => setDragOver((c) => (c === col.id ? null : c))}
              onDrop={() => onDrop(col.id)}
            >
              {col.tasks.length === 0 && dragOver !== col.id && (
                <span className="column-empty">Arraste cards aqui</span>
              )}
              {col.tasks.map((task) => {
                const a = task.agent ? AGENTS[task.agent] : null;
                const subDone = task.subtasks.filter((s) => s.done).length;
                return (
                  <div
                    className={`card${dragId === task.id ? " dragging" : ""}`}
                    key={task.id}
                    draggable
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => openCard(task.id)}
                  >
                    <button
                      className="card-delete"
                      title="Excluir"
                      onClick={(e) => {
                        e.stopPropagation();
                        run(deleteTask(task.id));
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                    <span className="card-id">{task.id}</span>
                    <div className="card-title">{task.title}</div>
                    {a && (
                      <div className="card-agent">
                        <span className="card-agent-avatar" style={{ background: a.color }}>
                          {a.short}
                        </span>
                        {a.label}
                      </div>
                    )}
                    {(task.subtasks.length > 0 || task.comments.length > 0) && (
                      <div className="card-footer">
                        {task.subtasks.length > 0 && (
                          <div className="card-footer-item">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M9 11l3 3L22 4" />
                              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                            </svg>
                            {subDone}/{task.subtasks.length}
                          </div>
                        )}
                        {task.comments.length > 0 && (
                          <div className="card-footer-item">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                            {task.comments.length}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {addingCol === col.id ? (
                <div className="inline-add-form">
                  <textarea
                    className="inline-add-input"
                    rows={2}
                    autoFocus
                    placeholder="Título da tarefa…"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitAdd(col.id);
                      }
                    }}
                  />
                  <div className="inline-add-actions">
                    <button className="btn-add-confirm" onClick={() => submitAdd(col.id)}>
                      Adicionar
                    </button>
                    <button
                      className="btn-add-cancel"
                      onClick={() => {
                        setAddingCol(null);
                        setNewTitle("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="add-card-btn"
                  onClick={() => {
                    setAddingCol(col.id);
                    setNewTitle("");
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Adicionar card
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`overlay${openId ? " open" : ""}`} onClick={closePanel} />

      <div className={`detail-panel${openId ? " open" : ""}`}>
        <div className="panel-header">
          <h2>
            Detalhes do Card
            {openTask && <span className="panel-id">{openTask.id}</span>}
          </h2>
          <button className="panel-close" onClick={closePanel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {openTask && (
          <div className="panel-body">
            <div className="panel-field">
              <label className="field-label">Título</label>
              <textarea
                className="panel-input card-title-input"
                rows={2}
                value={pTitle}
                placeholder="Descreva a tarefa…"
                onChange={(e) => {
                  setPTitle(e.target.value);
                  autoResize(e.target);
                }}
              />
            </div>

            <div className="panel-field">
              <label className="field-label">Descrição</label>
              <textarea
                className="panel-input"
                rows={3}
                value={pDesc}
                placeholder="Detalhes adicionais…"
                onChange={(e) => {
                  setPDesc(e.target.value);
                  autoResize(e.target);
                }}
              />
            </div>

            <div className="panel-field">
              <label className="field-label">Agente</label>
              <select
                className="panel-select"
                value={pAgent}
                onChange={(e) => setPAgent(e.target.value)}
              >
                <option value="">Nenhum agente</option>
                <option value="analyst">Analyst — Pesquisa e análise de dados</option>
                <option value="coder">Coder — Desenvolvimento de código</option>
                <option value="reviewer">Reviewer — Revisão e validação</option>
              </select>
            </div>

            <div className="panel-field">
              <label className="field-label">Status</label>
              <div className="status-row">
                <div className="status-pill">
                  <span className="col-dot" style={{ background: openCol?.color }} />
                  <span>{openCol?.name}</span>
                </div>
              </div>
            </div>

            <div className="panel-field">
              <label className="field-label">Subtarefas</label>
              <div>
                {openTask.subtasks.length === 0 && !addingSub && (
                  <div className="st-empty" onClick={() => setAddingSub(true)}>
                    Nenhuma subtarefa — clique para adicionar
                  </div>
                )}
                {openTask.subtasks.map((s) => {
                  const isOpen = !!openSub[s.id];
                  return (
                    <div className={`subtask-item${isOpen ? " open" : ""}`} key={s.id}>
                      <div
                        className="subtask-summary"
                        onClick={() => setOpenSub((o) => ({ ...o, [s.id]: !o[s.id] }))}
                      >
                        <input
                          type="checkbox"
                          checked={s.done}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => run(toggleSubTask(s.id))}
                        />
                        <span
                          className="subtask-status-dot"
                          style={{
                            background:
                              s.status === "done"
                                ? "var(--success)"
                                : s.status === "progress"
                                ? "var(--warn)"
                                : "var(--muted)",
                          }}
                        />
                        <span className="subtask-summary-text">{s.title}</span>
                        <svg className="subtask-expand-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                      {isOpen && (
                        <SubtaskEdit
                          key={s.id + "-edit"}
                          title={s.title}
                          desc={s.description ?? ""}
                          status={s.status}
                          onSave={(d) => {
                            run(
                              updateSubTask(s.id, {
                                title: d.title || s.title,
                                description: d.description || null,
                                status: d.status,
                                done: d.status === "done" ? true : s.done,
                              }),
                            );
                            setOpenSub((o) => ({ ...o, [s.id]: false }));
                          }}
                          onDelete={() => run(deleteSubTask(s.id))}
                        />
                      )}
                    </div>
                  );
                })}

                {addingSub && (
                  <SubtaskNew
                    onCancel={() => setAddingSub(false)}
                    onAdd={(d) => {
                      setAddingSub(false);
                      run(createSubTask(openTask.id, d));
                    }}
                  />
                )}
              </div>
              {!addingSub && openTask.subtasks.length > 0 && (
                <button className="add-subtask-btn" onClick={() => setAddingSub(true)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Adicionar subtarefa
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={saveCard}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Salvar
              </button>
              <button
                className="btn-ghost"
                style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
                onClick={() => {
                  run(deleteTask(openTask.id));
                  closePanel();
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Excluir
              </button>
            </div>

            <div style={{ height: 1, background: "var(--border)" }} />

            <div className="comments-section">
              <label className="field-label">Comentários</label>
              <div>
                {openTask.comments.length === 0 ? (
                  <div className="muted-note">
                    Nenhum comentário ainda. O agente pode enviar dúvidas aqui.
                  </div>
                ) : (
                  openTask.comments.map((c) => {
                    const isAgent = c.author === "agent";
                    return (
                      <div className="comment-item" key={c.id}>
                        <div className={`comment-avatar${isAgent ? " agent" : ""}`}>
                          {isAgent ? "AG" : "EU"}
                        </div>
                        <div className="comment-body">
                          <div className="comment-meta">
                            <span className="comment-author">{isAgent ? "Agente" : "Você"}</span>
                            <span className="comment-time">
                              {new Date(c.createdAt).toLocaleString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <button
                              className="card-delete"
                              style={{ position: "static", color: "var(--muted)" }}
                              title="Excluir"
                              onClick={() => run(deleteComment(c.id))}
                            >
                              ×
                            </button>
                          </div>
                          <div className="comment-text">{c.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="comment-input-row">
                <textarea
                  className="panel-input"
                  rows={1}
                  style={{ minHeight: 36 }}
                  placeholder="Responder ao agente…"
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    autoResize(e.target);
                  }}
                />
                <button
                  className="comment-send"
                  onClick={() => {
                    const t = comment.trim();
                    if (!t) return;
                    setComment("");
                    run(createComment(openTask.id, t));
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubtaskEdit({
  title,
  desc,
  status,
  onSave,
  onDelete,
}: {
  title: string;
  desc: string;
  status: string;
  onSave: (d: { title: string; description: string; status: string }) => void;
  onDelete: () => void;
}) {
  const [t, setT] = useState(title);
  const [d, setD] = useState(desc);
  const [s, setS] = useState(status);
  return (
    <div className="subtask-edit">
      <div className="subtask-edit-row">
        <span className="st-label">Título</span>
        <input className="st-input" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <div className="subtask-edit-row">
        <span className="st-label">Descrição</span>
        <input
          className="st-input"
          value={d}
          placeholder="Detalhes…"
          onChange={(e) => setD(e.target.value)}
        />
      </div>
      <div className="subtask-edit-row">
        <span className="st-label">Status</span>
        <div className="st-status-btns">
          <button
            className={`st-status-btn${s !== "done" && s !== "progress" ? " active-pending" : ""}`}
            onClick={() => setS("")}
          >
            Pendente
          </button>
          <button
            className={`st-status-btn${s === "progress" ? " active-progress" : ""}`}
            onClick={() => setS("progress")}
          >
            Em progresso
          </button>
          <button
            className={`st-status-btn${s === "done" ? " active-done" : ""}`}
            onClick={() => setS("done")}
          >
            Concluído
          </button>
        </div>
      </div>
      <div className="st-actions">
        <button className="st-save" onClick={() => onSave({ title: t.trim(), description: d.trim(), status: s })}>
          Salvar
        </button>
        <button className="st-delete" onClick={onDelete}>
          Excluir
        </button>
      </div>
    </div>
  );
}

function SubtaskNew({
  onAdd,
  onCancel,
}: {
  onAdd: (d: { title: string; description: string; status: string }) => void;
  onCancel: () => void;
}) {
  const [t, setT] = useState("");
  const [d, setD] = useState("");
  const [s, setS] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div className="st-new-form">
      <div className="subtask-edit-row">
        <span className="st-label">Título</span>
        <input
          className="st-input"
          ref={ref}
          value={t}
          placeholder="O que precisa ser feito?"
          onChange={(e) => setT(e.target.value)}
        />
      </div>
      <div className="subtask-edit-row">
        <span className="st-label">Descrição</span>
        <input
          className="st-input"
          value={d}
          placeholder="Detalhes adicionais…"
          onChange={(e) => setD(e.target.value)}
        />
      </div>
      <div className="subtask-edit-row">
        <span className="st-label">Status</span>
        <div className="st-new-status-btns">
          <button className={`st-new-status-btn${s === "" ? " selected" : ""}`} onClick={() => setS("")}>
            Pendente
          </button>
          <button
            className={`st-new-status-btn${s === "progress" ? " selected" : ""}`}
            onClick={() => setS("progress")}
          >
            Em progresso
          </button>
          <button
            className={`st-new-status-btn${s === "done" ? " selected" : ""}`}
            onClick={() => setS("done")}
          >
            Concluído
          </button>
        </div>
      </div>
      <div className="st-new-actions">
        <button className="btn-add-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn-add-confirm"
          onClick={() => {
            if (!t.trim()) return;
            onAdd({ title: t.trim(), description: d.trim(), status: s });
          }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}
