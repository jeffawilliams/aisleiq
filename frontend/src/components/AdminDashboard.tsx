import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { supabase } from "../lib/supabaseClient.js";
import { LoadingSpinner } from "./LoadingSpinner.js";

interface AdminStats {
  user_count: number;
  list_count: number;
  item_count: number;
  organize_count: number;
}

interface FeedbackRow {
  id: string;
  email: string | null;
  category: string;
  message: string;
  created_at: string;
}

interface UserRow {
  id: string;
  email: string | null;
  role: string;
}

export function AdminDashboard() {
  const { user, role, authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // Not signed in — redirect immediately
    if (!user) {
      window.location.replace("/");
      return;
    }

    // Role still being fetched — wait for it before deciding
    if (role === null) return;

    // Signed in but not admin — redirect
    if (role !== "admin") {
      window.location.replace("/");
      return;
    }

    Promise.all([
      supabase.rpc("get_admin_stats"),
      supabase.from("feedback").select("id, email, category, message, created_at").order("created_at", { ascending: false }).limit(20),
      supabase.from("profiles").select("id, email, role").order("email", { ascending: true }),
    ]).then(([statsResult, feedbackResult, usersResult]) => {
      setStats(statsResult.data as AdminStats);
      setFeedback((feedbackResult.data ?? []) as FeedbackRow[]);
      setUsers((usersResult.data ?? []) as UserRow[]);
      setStatsLoading(false);
      setFeedbackLoading(false);
      setUsersLoading(false);
    });
  }, [authLoading, user, role]);

  if (authLoading || statsLoading || feedbackLoading || usersLoading) {
    return (
      <div className="admin-dashboard">
        <LoadingSpinner />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__header">
        <button
          className="admin-dashboard__back"
          onClick={() => { window.location.href = "/"; }}
        >
          ← Back
        </button>
        <h1 className="admin-dashboard__title">Dashboard</h1>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{stats.user_count.toLocaleString()}</div>
          <div className="admin-stat-card__label">Registered Users</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{stats.list_count.toLocaleString()}</div>
          <div className="admin-stat-card__label">Lists Created</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{stats.item_count.toLocaleString()}</div>
          <div className="admin-stat-card__label">Items Added</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-card__value">{stats.organize_count.toLocaleString()}</div>
          <div className="admin-stat-card__label">Organizes Run</div>
        </div>
      </div>

      <div className="admin-user-list">
        <h2 className="admin-user-list__title">Users</h2>
        {users.length === 0 ? (
          <p className="admin-user-list__empty">No users found.</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="admin-user-item">
              <span className="admin-user-item__email">{u.email ?? "—"}</span>
              {u.role === "admin" && (
                <span className="admin-user-badge admin-user-badge--admin">admin</span>
              )}
            </div>
          ))
        )}
      </div>

      <div className="admin-feedback-list">
        <h2 className="admin-feedback-list__title">Feedback</h2>
        {feedback.length === 0 ? (
          <p className="admin-feedback-list__empty">No submissions yet.</p>
        ) : (
          feedback.map((row) => (
            <div key={row.id} className="admin-feedback-item">
              <div className="admin-feedback-item__meta">
                <span className={`admin-feedback-badge admin-feedback-badge--${row.category}`}>
                  {row.category}
                </span>
                <span className="admin-feedback-item__email">
                  {row.email ?? "anonymous"}
                </span>
                <span className="admin-feedback-item__date">
                  {new Date(row.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="admin-feedback-item__message">{row.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
