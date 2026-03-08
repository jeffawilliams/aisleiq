# Roles & Admin Dashboard

## Problem Statement

ShoppingListAssist currently has no concept of user roles — every authenticated user has the same capabilities and no visibility into platform-wide activity. As the app grows and gets shared with test users, there's an immediate need to (a) distinguish between standard users and admins, and (b) give admins a dashboard to understand how the app is being used. Without this, there's no way to observe real usage or make data-informed decisions about what to build next.

---

## Goals

1. Introduce a role system (Standard, Admin) with permissions enforced at the database level via RLS
2. Surface a Dashboard entry point in the hamburger menu for Admin users only
3. Build Phase 1 of the dashboard: Usage metrics — registered users, lists created, items added, organize calls
4. Track Organize events so they can be reported on (not currently persisted anywhere)
5. Lay the architectural groundwork for future dashboard phases without over-building now

---

## Non-Goals (Phase 1)

- Admin UI to promote/demote users (roles assigned manually in Supabase for now)
- Activity-over-time charts (Phase 2)
- Behavioral analytics — most common items, avg list length (Phase 2)
- Email or push notifications from the dashboard
- User management / impersonation
- Multi-tenancy or org-scoped views

---

## Roles

| Role | Capabilities |
|---|---|
| `standard` | Create/manage lists, organize, share — everything the app does today |
| `admin` | All standard capabilities + access to `/admin` dashboard with platform-wide data |

Role assignment is **manual via Supabase** for now — a developer sets `role = 'admin'` directly in the `profiles` table for specific users. No self-serve upgrade path in Phase 1.

---

## Architecture

### 1. Profiles Table

A new `profiles` table stores the role for each user. It is populated automatically via a Postgres trigger that fires on `auth.users` INSERT — meaning every new signup gets a `standard` profile row with no extra code needed in the frontend.

```sql
CREATE TABLE profiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'standard' CHECK (role IN ('standard', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

**Why a separate `profiles` table instead of Supabase `user_metadata`?**
User metadata lives in the JWT, is editable by the user client-side, and can't be enforced by RLS. A `profiles` table is controlled by the database, enforced by RLS, and queryable via standard SQL — the right home for anything security-relevant like role.

---

### 2. Role Helper Function

A `SECURITY DEFINER` function lets RLS policies check the current user's role without exposing the profiles table. This pattern avoids circular dependencies in RLS (a policy that queries a table that also has RLS).

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

This function is called inside RLS policies on any table where admins need cross-user access.

---

### 3. RLS on Profiles

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Every user can read their own profile (needed for role check on login)
CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin can read all profiles (needed for user count dashboard metric)
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT USING (get_my_role() = 'admin');
```

---

### 4. Admin Read Policy on Lists

Existing `lists` RLS policies are unchanged — standard users still only see their own rows. A new additive policy lets admins read all rows without touching the existing policies.

```sql
CREATE POLICY "admin_read_all_lists" ON lists
  FOR SELECT USING (get_my_role() = 'admin');
```

---

### 5. Organize Events Table

Organize calls (Claude API requests) are not currently persisted. This new table captures each call so they can be counted and eventually trended. It is written from the frontend immediately after a successful organize response.

```sql
CREATE TABLE organize_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  list_id    uuid REFERENCES lists(id) ON DELETE SET NULL,
  item_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organize_events ENABLE ROW LEVEL SECURITY;

-- Users can log their own events
CREATE POLICY "users_insert_own_events" ON organize_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin can read all events
CREATE POLICY "admin_read_all_events" ON organize_events
  FOR SELECT USING (get_my_role() = 'admin');
```

**Why client-side tracking instead of backend?**
The organize route lives in the Render backend, which has no user context (no Supabase session). Passing the user ID through the backend request is possible but adds complexity. Writing the event from the frontend after a successful API response is simpler and reliable — if the API call fails, no event is written, which is correct behavior.

---

## Database Migration Checklist (run in Supabase SQL editor)

Run in order:

1. Create `profiles` table + auto-create trigger
2. Create `get_my_role()` function
3. Add RLS policies to `profiles`
4. Add `admin_read_all_lists` policy to `lists`
5. Create `organize_events` table + RLS

All SQL is in the Architecture section above.

**Backfill existing users:**
```sql
-- Create profiles for any users who signed up before the trigger existed
INSERT INTO profiles (id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

---

## Frontend Changes

### `useAuth.ts` — expose role

Extend the existing auth hook to fetch the user's role from `profiles` after sign-in. Exposes `role: 'standard' | 'admin' | null` alongside the existing `user`.

```typescript
// After user is confirmed, fetch their profile
const { data } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single();

const role = data?.role ?? 'standard';
```

Role is `null` when unauthenticated, `'standard'` or `'admin'` when signed in.

---

### `HamburgerMenu.tsx` — conditional Dashboard link

Add a `role` prop. Render a "Dashboard" link above "Sign Out" only when `role === 'admin'`. Tapping it navigates to `/admin`.

```typescript
interface Props {
  // ... existing props
  role: 'standard' | 'admin' | null;
  onOpenDashboard: () => void;
}
```

```tsx
{role === 'admin' && (
  <button className="nav-dashboard-btn" onClick={onOpenDashboard}>
    Dashboard
  </button>
)}
```

---

### `App.tsx`

- Pass `role` from `useAuth` down to `HamburgerMenu`
- Add `onOpenDashboard` handler: sets `window.location.href = '/admin'`

---

### `AdminDashboard.tsx` (new component)

Full-screen view at `/admin`. Accessible only when `role === 'admin'` — if an unauthenticated or standard user navigates to `/admin` directly, redirect to `/`.

Fetches and displays Phase 1 stats:

| Metric | Query |
|---|---|
| Registered users | `SELECT count(*) FROM profiles` |
| Total lists created | `SELECT count(*) FROM lists` |
| Total items added | `SELECT sum(jsonb_array_length(items)) FROM lists` |
| Total organize calls | `SELECT count(*) FROM organize_events` |

Each stat displayed as a card with a label and large number. No charts in Phase 1.

---

### `main.tsx` — add `/admin` route

Extend the existing pathname-based routing to handle `/admin`:

```typescript
if (pathname === '/admin') {
  render(<AdminDashboard />);
} else if (sharedToken) {
  render(<SharedListView token={sharedToken} />);
} else {
  render(<App />);
}
```

`AdminDashboard` handles its own auth check internally (redirects non-admins).

---

### Event tracking in `useCategorize.ts`

After a successful organize call, insert a row into `organize_events`:

```typescript
// After organize() succeeds:
await supabase.from('organize_events').insert({
  user_id: user.id,
  list_id: activeListId,
  item_count: items.length,
});
```

This requires `useCategorize` (or the caller in `App.tsx`) to receive `user` and `activeListId` as arguments — both are already available in `App.tsx`.

---

## Phase 1 Dashboard UI

Simple stat cards — no charts, no tables, no user list. Just four numbers that answer "is this thing being used?"

```
┌─────────────────────────────────────────┐
│  Dashboard                              │
├──────────┬──────────┬──────────┬────────┤
│  Users   │  Lists   │  Items   │ Orgs   │
│    12    │    34    │   891    │  47    │
│          │ created  │  added   │  run   │
└──────────┴──────────┴──────────┴────────┘
```

A "← Back" link returns to the main app.

---

## Acceptance Criteria

- [ ] New user signup auto-creates a `standard` profile row (trigger fires correctly)
- [ ] Existing users get backfilled via the manual SQL
- [ ] A user manually set to `role = 'admin'` in Supabase sees a "Dashboard" link in the hamburger menu; standard users do not
- [ ] Navigating to `/admin` as a non-admin (or unauthenticated) redirects to `/`
- [ ] Dashboard displays correct counts for all 4 Phase 1 metrics
- [ ] Every successful Organize call writes a row to `organize_events`
- [ ] Failed Organize calls do not write a row
- [ ] Standard user RLS is unaffected — no cross-user data leakage

---

## Build Order

1. Run Supabase migration (user action — all SQL in Architecture section)
2. Run backfill SQL for existing users
3. Extend `useAuth` to fetch and expose role
4. Update `HamburgerMenu` with role prop + conditional Dashboard link
5. Update `App.tsx` to wire role through
6. Update `useCategorize` / `App.tsx` to track organize events
7. Create `AdminDashboard.tsx`
8. Update `main.tsx` routing for `/admin`
9. Add CSS for dashboard cards + nav dashboard link

---

## Future Phases

| Phase | Focus |
|---|---|
| 2 | Activity over time — usage charts by day/week (requires `created_at` indexing on `organize_events`) |
| 3 | Behavioral — most common grocery items, avg list length, organize frequency per user |
| 4 | User list in dashboard — admin sees registered users, their last active date, list count |
| 5 | Admin promotes/demotes users via UI (eliminates need for manual DB edits) |

---

## Open Questions

- Should the Dashboard link in the hamburger menu say "Dashboard" or "Admin" or "Reports"? Currently spec'd as "Dashboard."
- Should `/admin` be a full separate page (current spec) or a slide-in panel? A full page is strongly preferred given the data density that Phase 2+ will add.
- When `organize_events` grows large, will we need to introduce date-range filtering on the Phase 1 counts? Probably not until Phase 2, but worth noting.
