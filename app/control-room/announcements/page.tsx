"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "../admin-shell";
import {
  Megaphone, Plus, Search, RefreshCw, Edit3, Trash2,
  X, Send, FileText, CalendarDays, Clock, CheckCircle2
} from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Filter = "ALL" | "PUBLISHED" | "DRAFT" | "EXPIRED";

const dateLabel = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric"
      })
    : "No expiry";

const expiryValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
};

const getStatus = (item: Announcement) => {
  if (item.expiresAt && new Date(item.expiresAt) <= new Date()) return "EXPIRED";
  return item.status;
};

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [publishNow, setPublishNow] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/announcements", {
        cache: "no-store"
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to load announcements.");
      setItems(data.announcements || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setMessage("");
    setExpiresAt("");
    setPublishNow(false);
    setComposerOpen(false);
  };

  const startEdit = (item: Announcement) => {
    setEditing(item);
    setTitle(item.title);
    setMessage(item.message);
    setExpiresAt(expiryValue(item.expiresAt));
    setPublishNow(item.status === "PUBLISHED");
    setComposerOpen(true);
  };

  const saveAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        status: publishNow ? "PUBLISHED" : "DRAFT",
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      };

      const response = await fetch(
        editing ? `/api/admin/announcements/${editing.id}` : "/api/admin/announcements",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save announcement.");

      resetForm();
      setNotice(editing ? "Announcement updated successfully." : "Announcement created successfully.");
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save announcement.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (item: Announcement) => {
    const nextStatus = item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";

    if (nextStatus === "PUBLISHED" && item.expiresAt && new Date(item.expiresAt) <= new Date()) {
      setError("This announcement has expired. Edit its expiry date before publishing.");
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/announcements/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update status.");

      setNotice(nextStatus === "PUBLISHED" ? "Announcement published." : "Announcement moved to drafts.");
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
    }
  };

  const deleteAnnouncement = async (item: Announcement) => {
    if (!window.confirm(`Delete "${item.title}" permanently?`)) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/announcements/${item.id}`, {
        method: "DELETE"
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete announcement.");

      setNotice("Announcement deleted.");
      await loadAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete announcement.");
    }
  };

  const filtered = items.filter((item) => {
    const status = getStatus(item);
    const matchesFilter = filter === "ALL" || status === filter;
    const query = search.toLowerCase().trim();
    const matchesSearch = !query ||
      item.title.toLowerCase().includes(query) ||
      item.message.toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const counts = {
    all: items.length,
    published: items.filter((item) => getStatus(item) === "PUBLISHED").length,
    drafts: items.filter((item) => getStatus(item) === "DRAFT").length,
    expired: items.filter((item) => getStatus(item) === "EXPIRED").length
  };

  return (
    <AdminShell>
      <main className="announcements-admin-page">
        <header className="announcements-header">
          <div>
            <span className="announcements-eyebrow">COMMUNICATION CENTER</span>
            <h1>Announcements</h1>
            <p>Keep your StreamDao community informed with important updates.</p>
          </div>
          <button className="announcement-create-btn" onClick={() => {
            resetForm();
            setComposerOpen(true);
          }}>
            <Plus size={18} /> Create announcement
          </button>
        </header>

        {notice && <div className="announcement-notice success"><CheckCircle2 size={17} />{notice}</div>}
        {error && <div className="announcement-notice error">{error}</div>}

        <section className="announcement-stats">
          <div><span><Megaphone size={19} /></span><small>Total announcements</small><strong>{counts.all}</strong></div>
          <div><span><Send size={19} /></span><small>Published</small><strong>{counts.published}</strong></div>
          <div><span><FileText size={19} /></span><small>Drafts</small><strong>{counts.drafts}</strong></div>
          <div><span><Clock size={19} /></span><small>Expired</small><strong>{counts.expired}</strong></div>
        </section>

        <section className="announcement-workspace">
          <div className="announcement-toolbar">
            <div className="announcement-filters">
              {(["ALL", "PUBLISHED", "DRAFT", "EXPIRED"] as Filter[]).map((value) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                >
                  {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="announcement-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search announcements..."
              />
              <button onClick={loadAnnouncements} aria-label="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="announcement-empty"><RefreshCw className="announcement-spinner" size={25} /><p>Loading announcements...</p></div>
          ) : filtered.length === 0 ? (
            <div className="announcement-empty">
              <Megaphone size={35} />
              <h3>{search || filter !== "ALL" ? "No matching announcements" : "No announcements yet"}</h3>
              <p>Create your first announcement to communicate with your users.</p>
              {!search && filter === "ALL" && (
                <button className="announcement-create-btn" onClick={() => setComposerOpen(true)}>
                  <Plus size={17} /> Create announcement
                </button>
              )}
            </div>
          ) : (
            <div className="announcement-list">
              {filtered.map((item) => {
                const status = getStatus(item);
                return (
                  <article className="announcement-item" key={item.id}>
                    <div className="announcement-item-main">
                      <div className="announcement-item-top">
                        <span className={`announcement-status status-${status.toLowerCase()}`}>{status}</span>
                        <span className="announcement-date"><CalendarDays size={14} />{dateLabel(item.createdAt)}</span>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.message}</p>
                      <div className="announcement-expiry">
                        <Clock size={14} /> Expires: {dateLabel(item.expiresAt)}
                      </div>
                    </div>
                    <div className="announcement-actions">
                      <button onClick={() => startEdit(item)} aria-label="Edit announcement"><Edit3 size={17} /></button>
                      <button
                        className={item.status === "PUBLISHED" ? "unpublish" : "publish"}
                        onClick={() => togglePublish(item)}
                        disabled={status === "EXPIRED" && item.status !== "PUBLISHED"}
                      >
                        {item.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      <button className="delete" onClick={() => deleteAnnouncement(item)} aria-label="Delete announcement"><Trash2 size={17} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {composerOpen && (
          <div className="announcement-modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) resetForm();
          }}>
            <section className="announcement-modal">
              <header>
                <div>
                  <span className="announcements-eyebrow">COMMUNITY UPDATE</span>
                  <h2>{editing ? "Edit announcement" : "Create announcement"}</h2>
                </div>
                <button onClick={resetForm} disabled={saving} aria-label="Close"><X size={20} /></button>
              </header>

              <form onSubmit={saveAnnouncement}>
                <label>
                  Announcement title
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} minLength={3} required placeholder="Write a clear announcement title" />
                </label>
                <label>
                  Message
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={5} maxLength={10000} required rows={7} placeholder="Write the update you want your users to see..." />
                  <small>{message.length}/10,000 characters</small>
                </label>
                <label>
                  Expiry date <span className="announcement-optional">Optional</span>
                  <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
                </label>
                <label className="announcement-publish-toggle">
                  <input type="checkbox" checked={publishNow} onChange={(event) => setPublishNow(event.target.checked)} />
                  <span>
                    <strong>Publish immediately</strong>
                    <small>{publishNow ? "Users will see this announcement once saved." : "Save as a draft. Users will not see it yet."}</small>
                  </span>
                </label>
                <footer>
                  <button type="button" className="announcement-cancel-btn" onClick={resetForm} disabled={saving}>Cancel</button>
                  <button type="submit" className="announcement-create-btn" disabled={saving}>
                    {saving ? "Saving..." : publishNow ? <><Send size={16} /> {editing ? "Save and publish" : "Publish announcement"}</> : <><FileText size={16} /> Save draft</>}
                  </button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </main>
    </AdminShell>
  );
}