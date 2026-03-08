# PRD: Shareable List Links

**Status:** Draft
**Author:** Jeff Williams
**Date:** 2026-03-06
**Depends on:** Multi-List Management + Hamburger Navigation (shipped 2026-03-06)

---

## Problem Statement

ShoppingListAssist is currently single-user. Households — the primary use case — shop together. One person builds the list, another is at the store. Today that means texting a photo, sharing a Notes list, or using a separate app entirely. There is no way to hand off a live ShoppingListAssist list to another person and have both see changes as they happen.

This feature closes that gap. A list owner generates a link, shares it however they want (text, iMessage, AirDrop), and the recipient opens a fully functional, live view of the list — no account required.

---

## Goals

- Allow any authenticated user to generate a shareable link for any of their lists
- Recipients can open the link in a browser with no sign-in required
- Both owner and recipient see live updates as either party adds or removes items
- Owner can revoke the link at any time, immediately invalidating access
- No new backend infrastructure required — Supabase handles data access and real-time

---

## Non-Goals

- Permission levels (viewer vs. editor) — all recipients get edit access
- Email-based invites — link sharing only
- Link expiry — links are permanent until revoked
- Recipient account creation or list ownership transfer
- Conflict resolution beyond last-write-wins
- Push notifications for changes

---

## User Stories

**As an owner**, I want to generate a shareable link for a list so I can send it to my partner while they're shopping.

**As an owner**, I want to revoke a link so I can stop sharing a list I no longer want others to edit.

**As a recipient**, I want to open a link and immediately see the live list — and add or remove items — without creating an account.

**As an owner actively editing my list**, I want to see my partner's additions appear in real time so we don't duplicate items.

---

## Data Model

### Supabase migration (user runs in SQL editor)

```sql
-- 1. Add share_token column to lists
ALTER TABLE lists ADD COLUMN share_token uuid UNIQUE DEFAULT NULL;

-- 2. Allow anonymous users to read lists that are actively shared
--    Security: list IDs are UUIDs (unguessable). The RPC validates the token
--    before exposing the list ID. This policy only enables Realtime subscriptions
--    for anonymous users who have already validated their token.
CREATE POLICY "anon_shared_list_select" ON lists
  FOR SELECT TO anon
  USING (share_token IS NOT NULL);

-- 3. RPC: fetch a list by share token (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_list_by_share_token(token uuid)
RETURNS TABLE(id uuid, name text, items jsonb, updated_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, items, updated_at
  FROM lists
  WHERE share_token = token
  LIMIT 1;
$$;

-- 4. RPC: update a list's items by share token (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION update_list_by_share_token(token uuid, new_items jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE lists
  SET items = new_items, updated_at = now()
  WHERE share_token = token;
$$;
```

### Why RPC functions instead of direct table access

Anonymous users cannot satisfy the existing `auth.uid() = owner_id` RLS policies. Rather than relaxing those policies, two `SECURITY DEFINER` functions act as the access layer — they validate that a matching `share_token` exists before reading or writing. The anon SELECT policy is scoped only to lists with an active `share_token` and is required for Supabase Realtime to deliver live updates to unauthenticated subscribers.

---

## URL Structure

```
https://shoppinglistassist.jeffawilliams.com/shared/<uuid>
```

The `share_token` is a UUID v4 — 122 bits of entropy. Unguessable without the link. This is the same security model used by Google Docs, Notion, and Figma for "anyone with the link" sharing.

---

## Routing

The app has no router. `App.tsx` checks `window.location.pathname` on load:

```
/shared/<valid-uuid>  →  render <SharedListView token={token} />
anything else         →  render the main app
```

No React Router dependency needed. A single regex check in `App.tsx`.

**Vercel rewrite** — required so `/shared/*` paths return `index.html` rather than 404:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

## Feature: Generating and Revoking a Link

### Entry point

In the hamburger panel, each list row gains a **Share** button (link icon). It appears alongside the existing delete button.

### Generating

1. Owner taps Share on a list row
2. The list row expands inline to show the generated link + a **Copy Link** button + a **Stop Sharing** button
3. `generateShareLink(listId)` updates `share_token = gen_random_uuid()` on that list row via a standard authenticated Supabase `update()` call (no RPC needed — owner has RLS access)
4. The share URL is constructed client-side: `window.location.origin + '/shared/' + token`
5. **Copy Link** writes the URL to the clipboard

### Revoking

1. Owner taps **Stop Sharing** in the same expanded row (or on a row that already has a share_token)
2. `revokeShareLink(listId)` sets `share_token = null` via `update()`
3. The link immediately stops working — `get_list_by_share_token` returns no rows, `SharedListView` shows a "This list is no longer available" message

### State in `HamburgerMenu`

`sharingListId` — tracks which list row (if any) is in the expanded share UI state. One row open at a time.

---

## Feature: SharedListView (recipient experience)

### Load sequence

1. `SharedListView` mounts with `token` prop (from URL)
2. Calls `supabase.rpc('get_list_by_share_token', { token })`
3. If no result → renders "This list is no longer available"
4. If result → sets `listId`, `listName`, `listItems` in local state
5. Subscribes to Supabase Realtime `postgres_changes` on `lists WHERE id = listId`

### What the recipient sees

The shared view is the full app experience — identical to what the owner sees, scoped to one list. All input methods and features are available:

- List name as `<h2>` heading
- **"Shared list"** badge below the heading so the recipient understands the context
- Inline add input, FAB, AddItemSheet (type / paste / scan)
- Per-item remove buttons
- **Organize button** — calls the same `/api/categorize` backend endpoint; no auth required there
- ResultsGrid rendered after organize (full organized output with aisle cards, checklist, print)
- No hamburger menu
- No auth bar / sign-in prompt

### Adding and removing items

- Recipient uses all the same input methods as the owner (inline, FAB, AddItemSheet)
- Item changes save via `supabase.rpc('update_list_by_share_token', { token, new_items })` — debounced 800ms, same pattern as `useLists`

### Real-time updates

- Both owner (`useLists`) and recipient (`SharedListView`) subscribe to `postgres_changes` on the `lists` table filtered by `id`
- When an inbound Realtime event arrives with a newer `updated_at` than the local state, `listItems` is updated
- If a debounced save is pending when an inbound change arrives, the save timer is cancelled and local state is replaced with the inbound data (last-write-wins)
- Supabase channel is cleaned up on component unmount

---

## Real-Time: Owner Side

`useLists` currently has no inbound Realtime subscription. This feature adds one for the active list:

- When `activeListId` is set, open a `postgres_changes` subscription on `lists WHERE id = activeListId`
- On inbound change: if `updated_at` is newer than the last known value, update `listItems` and cancel any pending debounce timer
- Clean up subscription when `activeListId` changes or user signs out

This ensures the owner sees their partner's additions in real time without refreshing.

---

## Acceptance Criteria

### Link generation
- [ ] Share button visible on each list row in the hamburger panel (authenticated users only)
- [ ] Tapping Share generates a UUID token and saves it to the list row
- [ ] Share URL displayed inline in the list row; Copy Link writes it to clipboard
- [ ] If the list already has a share_token, Share shows the existing link (not a new one)

### Revocation
- [ ] Stop Sharing sets share_token to null
- [ ] Opening the old link after revocation shows "This list is no longer available"
- [ ] Revocation takes effect immediately (no cache delay)

### Recipient experience
- [ ] Link opens SharedListView without requiring sign-in
- [ ] List name and all current items displayed on load
- [ ] Recipient can add items via inline input, FAB, and AddItemSheet (type / paste / scan)
- [ ] Recipient can remove items (× button)
- [ ] Recipient can tap Organize and receive a full organized result
- [ ] "Shared list" badge visible below the list name
- [ ] Invalid or revoked token shows the unavailable message, not an error state

### Real-time sync
- [ ] Owner adds an item → appears on recipient's screen within 2 seconds (no refresh)
- [ ] Recipient adds an item → appears on owner's screen within 2 seconds
- [ ] Owner removes an item → disappears from recipient's screen within 2 seconds
- [ ] Recipient removes an item → disappears from owner's screen within 2 seconds
- [ ] No duplicate items created by simultaneous edits (last-write-wins is acceptable)

### Routing
- [ ] `/shared/<valid-uuid>` renders SharedListView, not the main app
- [ ] Any other path renders the main app
- [ ] Direct navigation to `/shared/<uuid>` works (Vercel rewrite handles it)
- [ ] Navigating to `/shared/<uuid>` while authenticated does not sign the user out

---

## File Summary

| File | Action |
|---|---|
| Supabase | Migration: `share_token` column + anon RLS policy + 2 RPC functions |
| `vercel.json` | Create — SPA rewrite rule |
| `frontend/src/components/SharedListView.tsx` | Create |
| `frontend/src/hooks/useLists.ts` | Add `generateShareLink`, `revokeShareLink`, Realtime subscription on active list |
| `frontend/src/components/HamburgerMenu.tsx` | Add share UI to each list row |
| `frontend/src/App.tsx` | Add pathname check; route to `SharedListView` if `/shared/<uuid>` |

No backend changes required.

---

## Open Questions

- Should a signed-in user opening a shared link see their own hamburger menu alongside the shared list? (Current thinking: no — keep the shared view isolated from the viewer's own account)
