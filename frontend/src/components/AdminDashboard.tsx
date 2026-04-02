import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { supabase } from "../lib/supabaseClient.js";
import { LoadingSpinner } from "./LoadingSpinner.js";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
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
  weekly_organize_count: { week: string; count: number }[] | null;
  weekly_shopping_count: { week: string; count: number }[] | null;
  weekly_deals_active: { week: string; count: number }[] | null;
  weekly_deals_accepted: { week: string; count: number }[] | null;
  weekly_deal_savings: { week: string; count: number }[] | null;
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

const COLORS_GREEN    = ['#2d6a4f', '#52b788', '#95d5b2', '#40916c', '#74c69d', '#1b4332', '#b7e4c7', '#d8f3dc'];
const COLORS_USERS    = ['#1b4332', '#95d5b2'];     // registered dark green, anonymous light mint
const COLORS_ORGANIZE = ['#2d6a4f', '#74c69d'];     // Group dark, Sort light
const COLORS_DEAL     = ['#52b788', '#e76f51'];     // accepted green, declined orange
const COLORS_GROUP    = ['#52b788', '#f4a261'];     // categorized green, Other amber
const COLORS_SCAN     = ['#2d6a4f', '#52b788', '#95d5b2', '#e76f51'];

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

function KpiCard({ label, value, sub }: { label: string; value: string | null; sub?: string }) {
  return (
    <div className="admin-chart-panel admin-kpi-card">
      <div className="admin-chart-panel__label">{label}</div>
      <div className="admin-kpi-card__value">{value ?? "—"}</div>
      {sub && <div className="admin-kpi-card__sub">{sub}</div>}
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
        <Legend iconType="circle" iconSize={8} layout="vertical" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: "0.72rem", lineHeight: "1.6" }} />
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
  if (weeks.length < 1) return <p className="analytics-empty">No data yet.</p>;
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

function HorizontalBarChart({
  data,
  color = "#2d6a4f",
  yAxisWidth = 80,
}: {
  data: { name: string; value: number; pct?: number }[];
  color?: string;
  yAxisWidth?: number;
}) {
  const active = [...data.filter(d => d.value > 0)].sort((a, b) => b.value - a.value);
  if (active.length === 0) return <p className="analytics-empty">No data yet.</p>;
  const total = active.reduce((s, d) => s + d.value, 0);
  const withPct = active.map(d => ({
    ...d,
    pctLabel: `${d.pct != null ? d.pct : Math.round(d.value / total * 100)}%`,
  }));
  const height = Math.max(120, active.length * 38);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={withPct} margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#555" }} tickLine={false} axisLine={false} width={yAxisWidth} />
        <Tooltip
          formatter={(val: unknown, _: unknown, props: { payload?: { pctLabel?: string } }) => {
            const display = typeof val === "number" ? val.toLocaleString() : String(val);
            return [props.payload?.pctLabel ? `${display} (${props.payload.pctLabel})` : display, ""];
          }}
          contentStyle={{ fontSize: "0.8rem", borderRadius: "6px", border: "1px solid #eee" }}
        />
        <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]}>
          <LabelList dataKey="pctLabel" position="right" style={{ fontSize: "0.72rem", fill: "#777", fontWeight: 600 }} />
        </Bar>
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
  if (!data || data.length < 1) return <p className="analytics-empty">No data yet.</p>;
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
  if (!data || data.length < 1) return <p className="analytics-empty">No data yet.</p>;
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

function OverlayLineChart({
  dataA,
  dataB,
  labelA,
  labelB,
  colorA = "#2d6a4f",
  colorB = "#52b788",
  tickInterval = 0,
}: {
  dataA: { week: string; count: number }[] | null;
  dataB: { week: string; count: number }[] | null;
  labelA: string;
  labelB: string;
  colorA?: string;
  colorB?: string;
  tickInterval?: number;
}) {
  const weeks = Array.from(new Set([
    ...(dataA ?? []).map(d => d.week),
    ...(dataB ?? []).map(d => d.week),
  ])).sort();
  if (weeks.length < 1) return <p className="analytics-empty">No data yet.</p>;
  const mapA = new Map((dataA ?? []).map(d => [d.week, d.count]));
  const mapB = new Map((dataB ?? []).map(d => [d.week, d.count]));
  const merged = weeks.map(w => ({
    label: formatWeek(w),
    a: mapA.get(w) ?? null,
    b: mapB.get(w) ?? null,
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={merged} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#bbb" }} tickLine={false} axisLine={false} interval={tickInterval || 0} />
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
        {dataA && dataA.length >= 1 && (
          <Line type="monotone" dataKey="a" name={labelA} stroke={colorA} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} connectNulls />
        )}
        {dataB && dataB.length >= 1 && (
          <Line type="monotone" dataKey="b" name={labelB} stroke={colorB} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} strokeDasharray="5 3" connectNulls />
        )}
      </LineChart>
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

  const totalOrganizeEvents = engagement.organized_sort_count + engagement.organized_group_count;
  const groupAdoptionPct = totalOrganizeEvents > 0
    ? Math.round(engagement.organized_group_count / totalOrganizeEvents * 100)
    : null;

  const organizeMethodData = [
    { name: "Group", value: engagement.organized_group_count },
    { name: "Sort",  value: engagement.organized_sort_count },
  ].filter(d => d.value > 0);

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
    .map(d => ({ name: d.category, value: d.item_count, pct: d.pct }));

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

        {/* KPI row */}
        <div className="admin-grid admin-grid--3col">
          <KpiCard
            label="Lists Organized"
            value={engagement.lists_organized_pct != null ? `${engagement.lists_organized_pct}%` : null}
            sub="of all lists"
          />
          <KpiCard
            label="Shopping Rate"
            value={engagement.lists_checked_pct != null ? `${engagement.lists_checked_pct}%` : null}
            sub={`${engagement.lists_checked_count.toLocaleString()} lists used in store`}
          />
          <KpiCard
            label="Lists Shared"
            value={engagement.lists_shared_pct != null ? `${engagement.lists_shared_pct}%` : null}
            sub="of all lists"
          />
        </div>

        {/* Organize donut + item origin bar */}
        <div className="admin-grid admin-grid--mt">
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">How Users Organize</div>
            <MiniDonut data={organizeMethodData} colors={COLORS_ORGANIZE} />
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">How Items Are Added</div>
            <HorizontalBarChart data={itemOriginData} color="#2d6a4f" yAxisWidth={70} />
          </div>
        </div>

        {/* Category distribution — full width horizontal bar */}
        {catData.length > 0 && (
          <div className="admin-grid--full admin-grid--mt">
            <div className="admin-chart-panel">
              <div className="admin-chart-panel__label">Shopping Category Distribution</div>
              <HorizontalBarChart data={catData} color="#52b788" yAxisWidth={150} />
            </div>
          </div>
        )}

        {/* Engagement over time */}
        <div className="admin-grid--full admin-grid--mt">
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">Engagement Over Time</div>
            <OverlayLineChart
              dataA={engagement.weekly_organize_count}
              dataB={engagement.weekly_shopping_count}
              labelA="Organize Events"
              labelB="Lists Used for Shopping"
              colorA="#2d6a4f"
              colorB="#52b788"
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Deals & Promotions ── */}
      <div className="admin-section">
        <h2 className="admin-section__title">Deals & Promotions</h2>

        {/* Deal Engagement KPIs */}
        <div className="admin-grid admin-grid--3col">
          <KpiCard
            label="Deals Enabled"
            value={engagement.lists_deals_shown_pct != null ? `${engagement.lists_deals_shown_pct}%` : null}
            sub={`${engagement.lists_deals_shown_count.toLocaleString()} lists`}
          />
          <KpiCard
            label="Items Matched"
            value={engagement.deal_items_pct != null ? `${engagement.deal_items_pct}%` : null}
            sub={`${engagement.deal_items_count.toLocaleString()} items found a deal`}
          />
          <KpiCard
            label="Acceptance Rate"
            value={engagement.deal_conversion_pct != null ? `${engagement.deal_conversion_pct}%` : null}
            sub={`${engagement.deal_accept_count} accepted · ${engagement.deal_decline_count} declined`}
          />
        </div>

        {/* Deal Savings KPIs */}
        <div className="admin-grid admin-grid--3col admin-grid--mt">
          <KpiCard
            label="Total Potential Savings"
            value={engagement.total_savings > 0 ? fmtMoney(engagement.total_savings) : null}
            sub="across all lists"
          />
          <KpiCard
            label="Total Actual Savings"
            value={engagement.accepted_savings > 0 ? fmtMoney(engagement.accepted_savings) : null}
            sub="from accepted deals"
          />
          <KpiCard
            label="Avg Actual Savings / List"
            value={engagement.avg_savings_per_list != null ? fmtMoney(engagement.avg_savings_per_list) : null}
            sub="across lists with deals"
          />
        </div>

        {/* Deals over time */}
        <div className="admin-grid admin-grid--mt">
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">Deal Activity / Week</div>
            <OverlayLineChart
              dataA={engagement.weekly_deals_active}
              dataB={engagement.weekly_deals_accepted}
              labelA="Deals Active"
              labelB="Deals Accepted"
              colorA="#2d6a4f"
              colorB="#52b788"
            />
          </div>
          <div className="admin-chart-panel">
            <div className="admin-chart-panel__label">Savings / Week</div>
            <SingleBarChart data={engagement.weekly_deal_savings} color="#52b788" />
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
