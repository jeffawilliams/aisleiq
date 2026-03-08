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

export function AdminDashboard() {
  const { user, role, authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // Redirect non-admins back to the main app
    if (!user || role !== "admin") {
      window.location.replace("/");
      return;
    }

    supabase.rpc("get_admin_stats").then(({ data }) => {
      setStats(data as AdminStats);
      setStatsLoading(false);
    });
  }, [authLoading, user, role]);

  if (authLoading || statsLoading) {
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
    </div>
  );
}
