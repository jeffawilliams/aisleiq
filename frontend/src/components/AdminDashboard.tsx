import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { supabase } from "../lib/supabaseClient.js";
import { LoadingSpinner } from "./LoadingSpinner.js";

// ── RPC response types ───────────────────────────────────────────────────────

interface AnalyticsUsers {
  total_registered: number;
  total_anonymous: number;
  weekly_new_registered: { week: string; count: number }[] | null;
  weekly_new_anonymous: { week: string; count: number }[] | null;
}

interface AnalyticsLists {
  total_lists: number;
  avg_lists_per_registered_user: number | null;
  avg_items_per_list: number | null;
  max_items_in_list: number | null;
  min_items_in_nonempty_list: number | null;
  weekly_lists_created: { week: string; count: number }[] | null;
}

interface AnalyticsEngagement {
  lists_organized_pct: number | null;
  organized_sort_count: number;
  organized_group_count: number;
  organized_unclassified_count: number;
  items_total: number;
  items_recipe_count: number;
  items_photo_count: number;
  items_typed_count: number;
  items_pasted_count: number;
  items_list_scan_count: number;
  items_unknown_count: number;
  lists_shared_pct: number | null;
  lists_checked_count: number;
  lists_checked_pct: number | null;
  lists_deals_shown_pct: number | null;
  lists_deals_shown_count: number;
  total_savings: number;
  avg_savings_per_list: number | null;
}

interface AnalyticsAI {
  items_total: number;
  items_with_photo_count: number;
  items_with_photo_pct: number | null;
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

// ── Small display helpers ────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="admin-analytics-stat">
      <div className="admin-analytics-stat__value">{value ?? "—"}</div>
      <div className="admin-analytics-stat__label">{label}</div>
    </div>
  );
}

function StatCluster({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="admin-analytics-cluster">
      <div className="admin-analytics-cluster__label">{label}</div>
      <div className="admin-analytics-cluster__stats">{children}</div>
    </div>
  );
}

function WeeklyTable({ data }: { data: { week: string; count: number }[] | null }) {
  if (!data || data.length === 0) return <p className="analytics-empty">No data yet.</p>;
  return (
    <table className="analytics-weekly-table">
      <thead>
        <tr>
          <th>Week of</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        {[...data].reverse().map(row => (
          <tr key={row.week}>
            <td>{new Date(row.week).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
            <td>{row.count.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Phase2Placeholder({ label }: { label: string }) {
  return (
    <div className="analytics-placeholder">
      <span className="analytics-placeholder__label">{label}</span>
      <span className="analytics-placeholder__badge">Phase 2 — instrumentation required</span>
    </div>
  );
}

function fmt(n: number | null, prefix = "", suffix = ""): string | null {
  if (n == null) return null;
  return `${prefix}${Number(n).toLocaleString()}${suffix}`;
}

// ── Main component ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { user, role, authLoading } = useAuth();

  const [users, setAnalyticsUsers] = useState<AnalyticsUsers | null>(null);
  const [lists, setAnalyticsLists] = useState<AnalyticsLists | null>(null);
  const [engagement, setEngagement] = useState<AnalyticsEngagement | null>(null);
  const [ai, setAI] = useState<AnalyticsAI | null>(null);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { window.location.replace("/"); return; }
    if (role === null) return;
    if (role !== "admin") { window.location.replace("/"); return; }

    Promise.all([
      supabase.rpc("get_analytics_users"),
      supabase.rpc("get_analytics_lists"),
      supabase.rpc("get_analytics_engagement"),
      supabase.rpc("get_analytics_ai"),
      supabase.from("feedback").select("id, email, category, message, created_at").order("created_at", { ascending: false }).limit(20),
      supabase.rpc("get_admin_users"),
    ]).then(([u, l, e, a, fb, au]) => {
      setAnalyticsUsers(u.data as AnalyticsUsers);
      setAnalyticsLists(l.data as AnalyticsLists);
      setEngagement(e.data as AnalyticsEngagement);
      setAI(a.data as AnalyticsAI);
      setFeedback((fb.data ?? []) as FeedbackRow[]);
      setAdminUsers((au.data ?? []) as UserRow[]);
      setLastUpdated(new Date());
      setLoading(false);
    });
  }, [authLoading, user, role]);

  if (authLoading || loading) {
    return <div className="admin-dashboard"><LoadingSpinner /></div>;
  }

  if (!users || !lists || !engagement || !ai) return null;

  // E2 derived percentages
  const itemsTotal = engagement.items_total || 1; // guard against /0
  const pct = (n: number) => `${((n / itemsTotal) * 100).toFixed(1)}%`;

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__header">
        <button className="admin-dashboard__back" onClick={() => { window.location.href = "/"; }}>
          ← Back
        </button>
        <h1 className="admin-dashboard__title">Analytics</h1>
        {lastUpdated && (
          <span className="admin-dashboard__updated">
            Updated {lastUpdated.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* ── Section 1: Usage ── */}
      <div className="admin-analytics">
        <h2 className="admin-analytics__title">Usage</h2>

        <StatCluster label="Total Users">
          <StatCard label="Registered" value={users.total_registered.toLocaleString()} />
          <StatCard label="Anonymous" value={users.total_anonymous.toLocaleString()} />
        </StatCluster>

        <StatCluster label="Total Lists">
          <StatCard label="All time" value={lists.total_lists.toLocaleString()} />
        </StatCluster>

        <StatCluster label="Lists per Registered User">
          <StatCard label="Avg" value={lists.avg_lists_per_registered_user ?? "—"} />
        </StatCluster>

        <StatCluster label="Items per List">
          <StatCard label="Avg" value={lists.avg_items_per_list ?? "—"} />
          <StatCard label="Max" value={lists.max_items_in_list ?? "—"} />
          <StatCard label="Min (non-empty)" value={lists.min_items_in_nonempty_list ?? "—"} />
        </StatCluster>

        <div className="analytics-weekly">
          <div className="analytics-weekly__section">
            <div className="analytics-weekly__label">New Registered Users by Week</div>
            <WeeklyTable data={users.weekly_new_registered} />
          </div>
          <div className="analytics-weekly__section">
            <div className="analytics-weekly__label">New Anonymous Users by Week</div>
            <p className="analytics-tracking-note">Tracking begins 2026-03-29</p>
            <WeeklyTable data={users.weekly_new_anonymous} />
          </div>
          <div className="analytics-weekly__section">
            <div className="analytics-weekly__label">Lists Created by Week</div>
            <WeeklyTable data={lists.weekly_lists_created} />
          </div>
        </div>
      </div>

      {/* ── Section 2: Engagement ── */}
      <div className="admin-analytics">
        <h2 className="admin-analytics__title">Engagement</h2>

        <StatCluster label="List Organization Conversion">
          <StatCard label="Lists organized ≥1×" value={engagement.lists_organized_pct != null ? `${engagement.lists_organized_pct}%` : "—"} />
          <StatCard label="Sort" value={engagement.organized_sort_count.toLocaleString()} />
          <StatCard label="Group" value={engagement.organized_group_count.toLocaleString()} />
          {engagement.organized_unclassified_count > 0 && (
            <StatCard label="Pre-instrumentation" value={engagement.organized_unclassified_count.toLocaleString()} />
          )}
        </StatCluster>

        <StatCluster label="Item Origin Breakdown">
          <StatCard label="Total items" value={engagement.items_total.toLocaleString()} />
          <StatCard label="Typed" value={`${engagement.items_typed_count.toLocaleString()} (${pct(engagement.items_typed_count)})`} />
          <StatCard label="Pasted" value={`${engagement.items_pasted_count.toLocaleString()} (${pct(engagement.items_pasted_count)})`} />
          <StatCard label="Photo" value={`${engagement.items_photo_count.toLocaleString()} (${pct(engagement.items_photo_count)})`} />
          <StatCard label="List Scan" value={`${engagement.items_list_scan_count.toLocaleString()} (${pct(engagement.items_list_scan_count)})`} />
          <StatCard label="Recipe" value={`${engagement.items_recipe_count.toLocaleString()} (${pct(engagement.items_recipe_count)})`} />
          {engagement.items_unknown_count > 0 && (
            <StatCard label="Pre-instrumentation" value={`${engagement.items_unknown_count.toLocaleString()} (${pct(engagement.items_unknown_count)})`} />
          )}
        </StatCluster>

        <StatCluster label="Shared Lists">
          <StatCard label="Lists ever shared" value={engagement.lists_shared_pct != null ? `${engagement.lists_shared_pct}%` : "—"} />
        </StatCluster>

        <StatCluster label="Lists with Any Checked Item">
          <StatCard label="Count" value={engagement.lists_checked_count.toLocaleString()} />
          <StatCard label="% of all lists" value={engagement.lists_checked_pct != null ? `${engagement.lists_checked_pct}%` : "—"} />
        </StatCluster>

        <StatCluster label="Lists with Deals Enabled">
          <StatCard label="Count" value={engagement.lists_deals_shown_count.toLocaleString()} />
          <StatCard label="% of all lists" value={engagement.lists_deals_shown_pct != null ? `${engagement.lists_deals_shown_pct}%` : "—"} />
        </StatCluster>

        <StatCluster label="Savings">
          <StatCard label="Total lifetime" value={fmt(engagement.total_savings, "$")} />
          <StatCard label="Avg per list" value={engagement.avg_savings_per_list != null ? `$${Number(engagement.avg_savings_per_list).toFixed(2)}` : "—"} />
        </StatCluster>
      </div>

      {/* ── Section 3: AI Performance ── */}
      <div className="admin-analytics">
        <h2 className="admin-analytics__title">AI Performance</h2>

        <StatCluster label="Items Added via Photo">
          <StatCard label="Count" value={ai.items_with_photo_count.toLocaleString()} />
          <StatCard label="% of all items" value={ai.items_with_photo_pct != null ? `${ai.items_with_photo_pct}%` : "—"} />
        </StatCluster>
        <p className="analytics-note">Using photo field presence as proxy. Standardized source tagging begins Phase 2.</p>

        <Phase2Placeholder label="Grouping category breakdown (requires group_categories on organize_events)" />
        <Phase2Placeholder label="Classifier vs. Claude resolution split (requires scan_events writes)" />
        <Phase2Placeholder label="Resolution breakdown by category (requires scan_events writes)" />
      </div>

      {/* ── Users ── */}
      <div className="admin-user-list">
        <h2 className="admin-user-list__title">Users</h2>
        {adminUsers.length === 0 ? (
          <p className="admin-user-list__empty">No users found.</p>
        ) : (
          adminUsers.map((u) => (
            <div key={u.id} className="admin-user-item">
              <span className="admin-user-item__email">{u.email ?? "—"}</span>
              {u.role === "admin" && (
                <span className="admin-user-badge admin-user-badge--admin">admin</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Feedback ── */}
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
                <span className="admin-feedback-item__email">{row.email ?? "anonymous"}</span>
                <span className="admin-feedback-item__date">
                  {new Date(row.created_at).toLocaleDateString(undefined, {
                    month: "short", day: "numeric", year: "numeric",
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
