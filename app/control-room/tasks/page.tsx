"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminShell from "../admin-shell";

type MiningTask = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  taskLink: string | null;
  sharePlatform: "WHATSAPP" | "FACEBOOK" | "SNAPCHAT" | "INSTAGRAM" | null;
  category: "REGULAR" | "SPONSORED";
  reward: number | string;
  minDurationSeconds: number;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  maxCompletions: number | null;
  totalCompletions: number;
  startsAt: string | null;
  endsAt: string | null;
  _count?: { submissions: number };
  createdAt: string;
};

type TaskForm = {
  title: string;
  description: string;
  instructions: string;
  taskLink: string;
  sharePlatform: "WHATSAPP" | "FACEBOOK" | "SNAPCHAT" | "INSTAGRAM";
  category: "REGULAR" | "SPONSORED";
  reward: string;
  minDurationSeconds: string;
};

const emptyForm: TaskForm = {
  title: "",
  description: "",
  instructions: "",
  taskLink: "",
  sharePlatform: "WHATSAPP",
  category: "REGULAR",
  reward: "",
  minDurationSeconds: "30",
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    plus: "M12 5v14 M5 12h14",
    search: "M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16 M21 21l-4.35-4.35",
    task: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    edit: "M12 20h9 M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z",
    pause: "M10 5H6v14h4z M18 5h-4v14h4z",
    play: "m7 4 14 8-14 8z",
    archive: "M3 4h18v4H3z M5 8v12h14V8 M10 12h4",
    close: "M18 6 6 18 M6 6l12 12",
  };

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.task} />
    </svg>
  );
}

export default function MiningTasksPage() {
  const [tasks, setTasks] = useState<MiningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyForm);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/mining-tasks", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to load tasks.");

      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function updateField<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEdit(task: MiningTask) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      instructions: task.instructions,
      taskLink: task.taskLink || "",
      sharePlatform: task.sharePlatform || "WHATSAPP",
      category: task.category,
      reward: String(task.reward),
      minDurationSeconds: String(task.minDurationSeconds ?? 30),
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      ...form,
      reward: Number(form.reward),
      minDurationSeconds: Number(form.minDurationSeconds),
      taskLink: form.category === "REGULAR" ? form.taskLink.trim() : "",
      sharePlatform: form.category === "SPONSORED" ? form.sharePlatform : null,
    };

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/mining-tasks/${editingId}`
          : "/api/admin/mining-tasks",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save task.");
      }

      setShowForm(false);
      setNotice(editingId ? "Task updated successfully." : "Task created successfully.");
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save task.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task: MiningTask, status: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    const message = status === "ARCHIVED"
      ? "Archive this task? Its submission history will be preserved."
      : `${status === "PAUSED" ? "Pause" : "Activate"} this task?`;

    if (!window.confirm(message)) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/mining-tasks/${task.id}`, {
        method: status === "ARCHIVED" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(status !== "ARCHIVED" ? { body: JSON.stringify({ status }) } : {}),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update task.");

      setNotice(status === "ARCHIVED" ? "Task archived." : `Task ${status.toLowerCase()}.`);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.description.toLowerCase().includes(search.toLowerCase());

    const matchesFilter = filter === "ALL" ||
      (filter === "REGULAR" && task.category === "REGULAR") ||
      (filter === "SPONSORED" && task.category === "SPONSORED") ||
      task.status === filter;

    return matchesSearch && matchesFilter;
  });

  const activeCount = tasks.filter((task) => task.status === "ACTIVE").length;
  const sponsoredCount = tasks.filter((task) => task.category === "SPONSORED" && task.status !== "ARCHIVED").length;
  const claimCount = tasks.reduce((sum, task) => sum + task.totalCompletions, 0);

  return (
    <AdminShell>
      <main className="admin-dashboard mining-admin-page">
        <header className="mining-page-header">
          <div>
            <span className="admin-eyebrow">EARNING MANAGEMENT</span>
            <h1>Mining Tasks</h1>
            <p>Create tasks, manage rewards and control what users can earn.</p>
          </div>
          <button className="mining-create-button" onClick={openCreate}>
            <Icon name="plus" /> Create new task
          </button>
        </header>

        {error && !showForm && <div className="mining-alert mining-alert-error">{error}</div>}
        {notice && <div className="mining-alert mining-alert-success">{notice}</div>}

        <section className="mining-overview-cards">
          <article>
            <div className="mining-overview-icon"><Icon name="task" /></div>
            <span>Total tasks</span>
            <strong>{tasks.length}</strong>
            <small>All created tasks</small>
          </article>
          <article>
            <div className="mining-overview-icon"><Icon name="play" /></div>
            <span>Active tasks</span>
            <strong>{activeCount}</strong>
            <small>Currently available</small>
          </article>
          <article>
            <div className="mining-overview-icon"><Icon name="archive" /></div>
            <span>Sponsored tasks</span>
            <strong>{sponsoredCount}</strong>
            <small>Sponsored campaigns</small>
          </article>
          <article>
            <div className="mining-overview-icon"><Icon name="edit" /></div>
            <span>Total claims</span>
            <strong>{claimCount}</strong>
            <small>Rewards successfully claimed</small>
          </article>
        </section>

        <section className="mining-task-panel">
          <div className="mining-toolbar">
            <div>
              <h2>All tasks</h2>
              <p>Manage every mining opportunity on StreamDao.</p>
            </div>
            <div className="mining-search">
              <Icon name="search" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
              />
            </div>
          </div>

          <div className="mining-filters">
            {["ALL", "ACTIVE", "PAUSED", "ARCHIVED", "REGULAR", "SPONSORED"].map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={filter === item ? "mining-filter-active" : ""}
              >
                {item === "ALL" ? "All tasks" : item.charAt(0) + item.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mining-empty-state">Loading mining tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="mining-empty-state">
              <div><Icon name="task" /></div>
              <strong>No tasks found</strong>
              <p>Create your first mining task or change your filters.</p>
              <button onClick={openCreate}>Create a task</button>
            </div>
          ) : (
            <div className="mining-table-wrap">
              <table className="mining-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Category</th>
                    <th>Reward</th>
                    <th>Claims</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <div className="mining-task-name">{task.title}</div>
                        <div className="mining-task-description">{task.description}</div>
                      </td>
                      <td><span className={`mining-category mining-${task.category.toLowerCase()}`}>{task.category}</span></td>
                      <td className="mining-reward">€{Number(task.reward).toFixed(2)}</td>
                      <td>{task.totalCompletions}</td>
                      <td><span className={`mining-status mining-status-${task.status.toLowerCase()}`}>{task.status}</span></td>
                      <td>
                        <div className="mining-row-actions">
                          <button title="Edit task" onClick={() => openEdit(task)}><Icon name="edit" /></button>
                          {task.status !== "ARCHIVED" && (
                            <>
                              <button
                                title={task.status === "ACTIVE" ? "Pause task" : "Activate task"}
                                onClick={() => changeStatus(task, task.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
                              >
                                <Icon name={task.status === "ACTIVE" ? "pause" : "play"} />
                              </button>
                              <button title="Archive task" onClick={() => changeStatus(task, "ARCHIVED")}><Icon name="archive" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showForm && (
          <div className="mining-modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setShowForm(false);
          }}>
            <section className="mining-modal" role="dialog" aria-modal="true" aria-labelledby="mining-form-title">
              <header className="mining-modal-header">
                <div>
                  <span className="admin-eyebrow">TASK CONFIGURATION</span>
                  <h2 id="mining-form-title">{editingId ? "Edit mining task" : "Create mining task"}</h2>
                  <p>Configure the task users will see and complete.</p>
                </div>
                <button type="button" className="mining-modal-close" onClick={() => setShowForm(false)} disabled={saving}><Icon name="close" /></button>
              </header>

              <form onSubmit={saveTask} className="mining-form">
                <label>
                  Task title
                  <input required minLength={3} maxLength={120} value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="e.g. Follow our social page" />
                </label>

                <label>
                  Short description
                  <textarea required value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Explain what users will do..." rows={2} />
                </label>

                <label>
                  Task instructions
                  <textarea required value={form.instructions} onChange={(e) => updateField("instructions", e.target.value)} placeholder="Give users step-by-step instructions..." rows={3} />
                </label>

                <div className="mining-form-grid">
                  <label>
                    Task category
                    <select value={form.category} onChange={(e) => updateField("category", e.target.value as TaskForm["category"])}>
                      <option value="REGULAR">Regular task</option>
                      <option value="SPONSORED">Sponsored task</option>
                    </select>
                  </label>
                  <label>
                    Reward (€)
                    <input type="number" required min="0.01" step="0.01" value={form.reward} onChange={(e) => updateField("reward", e.target.value)} placeholder="0.50" />
                  </label>
                </div>

                {form.category === "REGULAR" ? (
                  <label>
                    Task destination link
                    <input
                      type="url"
                      required
                      value={form.taskLink}
                      onChange={(e) => updateField("taskLink", e.target.value)}
                      placeholder="https://example.com/task"
                    />
                  </label>
                ) : (
                  <label>
                    Sharing platform
                    <select
                      value={form.sharePlatform}
                      onChange={(e) => updateField("sharePlatform", e.target.value as TaskForm["sharePlatform"])}
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="FACEBOOK">Facebook</option>
                      <option value="SNAPCHAT">Snapchat</option>
                      <option value="INSTAGRAM">Instagram</option>
                    </select>
                  </label>
                )}

                <label>
                  Minimum completion time
                  <select
                    value={form.minDurationSeconds}
                    onChange={(e) => updateField("minDurationSeconds", e.target.value)}
                  >
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                    <option value="180">3 minutes</option>
                    <option value="300">5 minutes</option>
                    <option value="600">10 minutes</option>
                    <option value="900">15 minutes</option>
                    <option value="1800">30 minutes</option>
                  </select>
                  <small>Users can claim their reward after this time has elapsed.</small>
                </label>
                {error && <div className="mining-alert mining-alert-error">{error}</div>}

                <div className="mining-form-actions">
                  <button type="button" className="mining-cancel-button" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                  <button type="submit" className="mining-create-button" disabled={saving}>
                    {saving ? "Saving..." : editingId ? "Save changes" : "Create task"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>
    </AdminShell>
  );
}