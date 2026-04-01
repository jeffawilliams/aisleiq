import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { supabase } from "../lib/supabaseClient.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";

// ── RPC response types ────────────────────────────────────────────────────────

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
  weekly_items_created: { week: string; count: number }[] | null;
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
  deal_items_count: number;
  deal_items_pct: number | null;
  deal_accept_count: number;
  deal_decline_count: number;
  deal_conversion_pct: number | null;
  accepted_savings: number;
  avg_accepted_savings: number | null;
  category_distribution: { category: string; item_count: number; pct: number }[] | null;
}

interface AnalyticsAI {
  items_total: number;
  items_with_photo_count: number;
  items_with_photo_pct: number | null;
  other_item_count: number;
  other_total_grouped: number;
  other_item_pct: number | null;
  scans_total: number;
  scans_high: number;
  scans_medium: number;
  scans_low: number;
  scans_classifier_error: number;
  scans_by_category: { category: string; count: number }[] | null;
}

// ── Chart colors ──────────────────────────────────────────────────────────────

const COLORS_GREEN = ['#2d6a4f', '#52b788', '#95d5b2', '#40916c', '#74c69d', '#1b4332', '#b7e4c7', '#d8f3dc'];
const COLORS_USERS = ['#1b4332', '#95d5b2'];        // registered dark green, anonymous light mint
const COLORS_DEAL  = ['#52b788', '#e76f51'];        // accepted green, declined orange
const COLORS_GROUP = ['#52b788', '#f4a261'];        // categorized green, Other amber
const COLORS_SCAN  = ['#2d6a4f', '#52b788', '#95d5b2', '#e76f51'];

// ── Display helpers ───────────────────────────────────────────────────────────

function fmt(n: number | null, prefix = "", suffix = ""): string | null {
  if (n == null) return null;
  return `${prefix}${Number(n).toLocaleString()}${suffix}`;
}

function fmtMoney(n: number | null): string {
  if (n == null || n === 0) return "—";
  return `$${Number(n).toFixed(2)}`;
}

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

function formatWeek(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return dateStr; }
}

function MiniDonut({
  data,
  colors = COLORS_GREEN,
  height = 230,
  showLabels = false,
}: {
  data: { name: string; value: number }[];
  colors?: string[];
  height?: number;
  showLabels?: boolean;
}) {
  const active = data.filter(d => d.value > 0);
  if (active.length === 0) return <p className="analytics-empty">No data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={active}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={74}
          paddingAngle={2}
          dataKey="value"
          label={showLabels ? (({ value }: { value: number }) => value.toLocaleString()) : undefined}
          labelLine={showLabels}
        >
          {active.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(val: unknown) => typeof val === "number" ? val.toLocaleString() : String(val)}
          contentStyle={{ fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #eee" }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.75rem" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function GroupedBarChart({
  dataA,
  dataB,
  labelA,
  labelB,
  colorA = "#1b4332",
  colorB = "#52b788",
}: {
  dataA: { week: string; count: number }[] | null;
  dataB: { week: string; count: number }[] | null;
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
}) {
  const weeks = Array.from(new Set([
    ...(dataA ?? []).map(d => d.week),
    ...(dataB ?? []).map(d => d.week),
  ])).sort();
  if (weeks.length < 2) return <p className="analytics-empty">Not enough data yet.</p>;
  const mapA = new Map((dataA ?? []).map(d => [d.week, d.count]));
  const mapB = new Map((dataB ?? []).map(d => [d.week, d.count]));
  const merged = weeks.map(w => ({
    label: formatWeek(w),
    a: mapA.get(w) ?? 0,
    b: mapB.get(w) ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={merged} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%" barGap={3}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={{ fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #eee" }} labelStyle={{ color: "#555" }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: "0.75rem" }}
          content={({ payload }) => (
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", fontSize: "0.75rem" }}>
              {[...(payload ?? [])].reverse().map((entry, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: String(entry.color) }} />
                  {entry.value}
                </span>
              ))}
            </div>
          )}
        />
        <Bar dataKey="a" name={labelA} fill={colorA} radius={[3, 3, 0, 0]} />
        <Bar dataKey="b" name={labelB} fill={colorB} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function MiniLineChart({
  data,
  color = "#2d6a4f",
}: {
  data: { week: string; count: number }[] | null;
  color?: string;
}) {
  if (!data || data.length < 2) return <p className="analytics-empty">Not enough data yet.</p>;
  const sorted = [...data]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(d => ({ ...d, label: formatWeek(d.week) }));
  return (
    <ResponsiveContainer width="100%" height={150}>
      <LineChart data={sorted} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip
          contentStyle={{ fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #eee" }}
          labelStyle={{ color: "#555" }}
        />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function SingleBarChart({
  data,
  color = "#2d6a4f",
}: {
  data: { week: string; count: number }[] | null;
  color?: string;
}) {
  if (!data || data.length < 2) return <p className="analytics-empty">Not enough data yet.</p>;
  const sorted = [...data]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(d => ({ ...d, label: formatWeek(d.week) }));
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={sorted} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="40%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip contentStyle={{ fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #eee" }} labelStyle={{ color: "#555" }} />
        <Bar dataKey="count" name="Lists" fill={color} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const { user, role, authLoading } = useAuth();

  const [users, setAnalyticsUsers] = useState<AnalyticsUsers | null>(null);
  const [lists, setAnalyticsLists] = useState<AnalyticsLists | null>(null);
  const [engagement, setEngagement] = useState<AnalyticsEngagement | null>(null);
  const [ai, setAI] = useState<AnalyticsAI | null>(null);
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
    ]).then(([u, l, e, a]) => {
      setAnalyticsUsers(u.data as AnalyticsUsers);
      setAnalyticsLists(l.data as AnalyticsLists);
      setEngagement(e.data as AnalyticsEngagement);
      setAI(a.data as AnalyticsAI);
      setLastUpdated(new Date());
      setLoading(false);
    });
  }, [authLoading, user, role]);

  if (authLoading || loading) {
    return <div className="admin-dashboard"><LoadingSpinner /></div>;
  }

  if (!users || !lists || !engagement || !ai) return null;

  // ── Derived chart data ──────────────────────────────────────────────────────

  const itemOriginData = [
    { name: "Typed",    value: engagement.items_typed_count },
    { name: "Pasted",   value: engagement.items_pasted_count },
    { name: "Photo",    value: engagement.items_photo_count },
    { name: "Recipe",   value: engagement.items_recipe_count },
    { name: "List Scan", value: engagement.items_list_scan_count },
    ...(engagement.items_unknown_count > 0
      ? [{ name: "Pre-instrumentation", value: engagement.items_unknown_count }]
      : []),
  ].filter(d => d.value > 0);

  const catData = (engagement.category_distribution ?? [])
    .slice(0, 8)
    .map(d => ({ name: d.category, value: d.item_count }));

  const dealResponseData = [
    { name: "Accepted", value: engagement.deal_accept_count },
    { name: "Declined", value: engagement.deal_decline_count },
  ].filter(d => d.value > 0);

  const groupingData = ai.other_total_grouped > 0
    ? [
        { name: "Categorized", value: ai.other_total_grouped - ai.other_item_count },
        { name: "Other",       value: ai.other_item_count },
      ].filter(d => d.value > 0)
    : [];

  const scanData = ai.scans_total > 0
    ? [
        { name: "Classifier only",     value: ai.scans_high },
        { name: "Classifier + Claude", value: ai.scans_medium },
        { name: "Claude only",         value: ai.scans_low },
        ...(ai.scans_classifier_error > 0
          ? [{ name: "Classifier error", value: ai.scans_classifier_error }]
          : []),
      ].filter(d => d.value > 0)
    : [];

  return (
    <div className="admin-dashboard">

      {/* ── Header ── */}
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
      <div className="admin-section">
        <h2 className="admin-section__title">Usage</h2>

        {/* Users row */}
        <div className="admin-grid admin-grid--mt">
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">User Type</div>
            <MiniDonut
              data={[
                { name: `Registered`, value: users.total_registered },
                { name: `Anonymous`,  value: users.total_anonymous },
              ]}
              colors={COLORS_USERS}
              showLabels
            />
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">New Users / Week</div>
            <GroupedBarChart
              dataA={users.weekly_new_registered}
              dataB={users.weekly_new_anonymous}
              labelA="Registered"
              labelB="Anonymous"
              colorA="#1b4332"
              colorB="#52b788"
            />
          </div>
        </div>

        {/* Lists row */}
        <div className="admin-grid admin-grid--mt">
          <div className="admin-chart-panel">
            <StatCluster label="Lists">
              <StatCard label="Total"            value={lists.total_lists.toLocaleString()} />
              <StatCard label="Avg items / list" value={lists.avg_items_per_list ?? "—"} />
            </StatCluster>
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">Lists & Items / Week</div>
            <GroupedBarChart
              dataA={lists.weekly_lists_created}
              dataB={lists.weekly_items_created}
              labelA="Lists"
              labelB="Items"
              colorA="#1b4332"
              colorB="#52b788"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Engagement ── */}
      <div className="admin-section">
        <h2 className="admin-section__title">Engagement</h2>

        <div className="admin-grid">
          <div>
            <StatCluster label="List Organization">
              <StatCard label="Lists organized ≥1×" value={engagement.lists_organized_pct != null ? `${engagement.lists_organized_pct}%` : "—"} />
              <StatCard label="Sort"  value={engagement.organized_sort_count.toLocaleString()} />
              <StatCard label="Group" value={engagement.organized_group_count.toLocaleString()} />
              {engagement.organized_unclassified_count > 0 && (
                <StatCard label="Pre-instrumentation" value={engagement.organized_unclassified_count.toLocaleString()} />
              )}
            </StatCluster>
            <StatCluster label="List Activity">
              <StatCard label="Ever shared"      value={engagement.lists_shared_pct != null ? `${engagement.lists_shared_pct}%` : "—"} />
              <StatCard label="Has checked item" value={engagement.lists_checked_count > 0 ? `${engagement.lists_checked_count.toLocaleString()} (${engagement.lists_checked_pct ?? "—"}%)` : "—"} />
            </StatCluster>
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">How Items Are Added</div>
            <MiniDonut data={itemOriginData} colors={COLORS_GREEN} />
          </div>
        </div>

        {catData.length > 0 && (
          <div className="admin-grid admin-grid--mt">
            <div className="admin-chart-panel">
              <div className="admin-chart-panel__label">Shopping Category Distribution</div>
              <MiniDonut data={catData} colors={COLORS_GREEN} />
            </div>
            <div className="admin-chart-panel">
              <div className="admin-chart-panel__label">Category Breakdown</div>
              <table className="analytics-weekly-table">
                <thead><tr><th>Category</th><th>Items</th><th>%</th></tr></thead>
                <tbody>
                  {(engagement.category_distribution ?? []).map(row => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.item_count.toLocaleString()}</td>
                      <td>{row.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Deals & Promotions ── */}
      <div className="admin-section">
        <h2 className="admin-section__title">Deals & Promotions</h2>

        <div className="admin-grid">
          <div>
            <StatCluster label="Deal Reach">
              <StatCard label="Lists with deals shown"  value={engagement.lists_deals_shown_count > 0 ? `${engagement.lists_deals_shown_count.toLocaleString()} (${engagement.lists_deals_shown_pct ?? "—"}%)` : "—"} />
              <StatCard label="Items matched to a deal" value={engagement.deal_items_count > 0 ? `${engagement.deal_items_count.toLocaleString()} (${engagement.deal_items_pct ?? "—"}%)` : "—"} />
              <StatCard label="Conversion rate"         value={engagement.deal_conversion_pct != null ? `${engagement.deal_conversion_pct}%` : "—"} />
            </StatCluster>
            <StatCluster label="Savings">
              <StatCard label="Total savings shown"    value={fmtMoney(engagement.total_savings)} />
              <StatCard label="Avg / list"             value={fmtMoney(engagement.avg_savings_per_list)} />
              <StatCard label="Accepted savings"       value={fmtMoney(engagement.accepted_savings)} />
              <StatCard label="Avg accepted / list"    value={fmtMoney(engagement.avg_accepted_savings)} />
            </StatCluster>
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">Deal Response (Accepted vs. Declined)</div>
            <MiniDonut data={dealResponseData} colors={COLORS_DEAL} />
          </div>
        </div>
      </div>

      {/* ── Section 4: AI Performance ── */}
      <div className="admin-section">
        <h2 className="admin-section__title">AI Performance</h2>

        <div className="admin-grid">
          <div>
            <StatCluster label="Grouping Quality">
              <StatCard label="Total items grouped"  value={ai.other_total_grouped.toLocaleString()} />
              <StatCard label="Placed in 'Other'"    value={ai.other_item_count.toLocaleString()} />
              <StatCard label="Other rate"           value={ai.other_total_grouped > 0 ? `${ai.other_item_pct ?? 0}%` : "—"} />
            </StatCluster>
            <StatCluster label="Photo Recognition">
              <StatCard label="Items added via photo" value={ai.items_with_photo_count.toLocaleString()} />
              <StatCard label="% of all items"        value={ai.items_with_photo_pct != null ? `${ai.items_with_photo_pct}%` : "—"} />
            </StatCluster>
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">Grouped Items: Categorized vs. Other</div>
            <MiniDonut data={groupingData} colors={COLORS_GROUP} />
          </div>
        </div>

        {ai.scans_total > 0 && (
          <div className="admin-grid admin-grid--mt">
            <div className="admin-chart-panel">
              <div className="admin-chart-panel__label">Product Scan Resolution</div>
              <MiniDonut data={scanData} colors={COLORS_SCAN} />
            </div>
            {ai.scans_by_category && ai.scans_by_category.length > 0 && (
              <div className="admin-chart-panel">
                <div className="admin-chart-panel__label">Scans by Category</div>
                <table className="analytics-weekly-table">
                  <thead><tr><th>Category</th><th>Scans</th></tr></thead>
                  <tbody>
                    {ai.scans_by_category.map(row => (
                      <tr key={row.category}>
                        <td>{row.category}</td>
                        <td>{row.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
