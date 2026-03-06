# PRD: Multi-List Management + Hamburger Navigation

**Status:** Draft
**Author:** Jeff Williams
**Date:** 2026-03-06
**Target release:** Pre-sharing (must ship before list sharing feature)

---

## Problem Statement

ShoppingListAssist currently supports exactly one list per user with no way to name, save multiple, or delete lists. This limits real-world usefulness — users shop at multiple stores, plan different trips, and will soon need to share specific named lists with household members. Before building list sharing, the data model and navigation need to support named, multiple lists per user.

Additionally, the app has no navigation structure. As features grow (Deals, Preferences, sharing), the header will become cluttered without a proper home for secondary navigation. A hamburger menu addresses this now and scales forward.

---

## Goals

- Allow users to maintain multiple named lists and switch between them freely
- Establish a hamburger menu as the home for navigation — designed to grow
- Connect list saving to sign-in, with an explicit name confirmation step
- Keep the primary list-editing experience unchanged — this is a management layer on top of it, not a replacement

---

## User Stories

**As a user (unauthenticated),** I want my list to default to "My List" so I can start adding items immediately without any setup friction.

**As a user saving for the first time,** I want to confirm or rename my list when I sign in to save it, so the list is named something meaningful from the start.

**As a signed-in user,** I want to create additional named lists so I can manage a Costco run separately from my weekly grocery list.

**As a signed-in user,** I want to switch between my saved lists so I can quickly pick up where I left off on any list.

**As a signed-in user,** I want to delete a list I no longer need, with a confirmation step so I don't delete one accidentally.

**As a returning user,** I want the app to open on the last list I was viewing so I don't have to re-navigate every session.

---

## Feature Requirements

### 1. Hamburger Menu

**Placement:** Top-right corner of the app header.

**Unauthenticated state:**
- Menu contains one item: **My Lists**
- "My Lists" navigates to the list management view (see section 3)

**Authenticated state:**
- Menu contains two items: **My Lists** and **Sign Out**
- Sign Out replaces the current "Sign out" link in the header auth bar

**Header changes:**
- Unauthenticated: "Sign in to save your list" CTA remains visible in the header — this is the primary conversion action and must not be buried in the menu
- Authenticated: user's email address remains visible in the header as a signed-in signal; the "Sign out" link is removed from the header and moves into the hamburger

---

### 2. Default List + Naming on Save

**Default list:**
- On first use (including unauthenticated), the active list is named "My List" by default
- The name displays visibly in the main list view so the user always knows which list they're on

**Save / naming flow:**
1. User taps "Sign in to save your list"
2. Sign-in modal opens (existing magic link flow)
3. After successful authentication, a **Name Your List** dialog appears
   - Pre-filled with "My List"
   - User can edit inline
   - Name is required — cannot be blank
   - Single action: **Save** (confirms name and persists the list)
4. List saves to Supabase with the confirmed name
5. App returns to the list view

**Subsequent saves:** Auto-save continues via the existing `useList` hook. No re-prompting for name unless the user explicitly renames.

---

### 3. My Lists View

Accessible from the hamburger menu. Shows all of the signed-in user's saved lists.

**List item displays:**
- List name
- Item count — all items on the list, including checked-off items (e.g. "12 items")
- Last updated timestamp

**Actions per list:**
- **Tap** to switch to that list (sets it as active, navigates back to main view)
- **Rename** — tap the list name to edit it inline; name is required, cannot be blank
- **Delete** — shows a confirmation dialog before deleting (see section 4)

**Create new list:**
- A "New List" button at the top of the My Lists view
- Tapping it prompts for a name (required, cannot be blank)
- Creates a new empty list and sets it as active

**Unauthenticated state:**
- My Lists view prompts sign-in: "Sign in to save and manage multiple lists"
- User can still view their current (unsaved) list

---

### 4. Delete List

- Delete is available from the My Lists view
- Tapping delete on a list shows a confirmation dialog:
  > **Delete "[List Name]"?**
  > This can't be undone.
  > [Cancel] [Delete]
- On confirm: list and all its items are permanently deleted
- **Edge case — deleting the last list:** If the user deletes their only list, a new empty "My List" is automatically created and set as active. The user is never left in a state with no list.
- **Edge case — deleting the active list:** If the deleted list was currently active, the app switches to the most recently updated remaining list (or auto-creates "My List" if none remain)

---

### 5. Active List Persistence

- The last-viewed list is restored on next app open
- Persistence mechanism: store `activeListId` in `localStorage` (fast, no server round-trip needed)
- On load: read `activeListId` from localStorage → fetch that list from Supabase → render
- Fallback: if the stored ID no longer exists (deleted), load the most recently updated list

---

## Data Model Changes

### `lists` table — add `name` column

```sql
ALTER TABLE lists ADD COLUMN name text NOT NULL DEFAULT 'My List';
```

The existing one-row-per-user assumption is replaced by multiple rows per user. The `owner_id` column remains the ownership FK.

### RLS policies — no changes needed for this feature

Existing policies (`auth.uid() = owner_id`) continue to work correctly for multi-list. Each user owns and accesses only their own rows.

### `useList` hook — significant changes

| Current behavior | New behavior |
|---|---|
| Loads the single list row for `auth.uid()` | Loads the list matching `activeListId` |
| Saves to the single list row | Saves to the active list row |
| No list selection concept | Tracks `activeListId` in state + localStorage |

A new `useLists` hook (or extension) handles: fetching all lists for the user, creating a new list, deleting a list, and switching the active list.

---

## Acceptance Criteria

- [ ] Hamburger menu renders in the header on all screen sizes
- [ ] Unauthenticated: hamburger shows "My Lists" only
- [ ] Authenticated: hamburger shows "My Lists" + "Sign Out"
- [ ] "Sign in to save your list" is visible in the header when unauthenticated; disappears after sign-in
- [ ] User email remains visible in the header when authenticated
- [ ] Active list name is visible in the main list view
- [ ] Default list name is "My List" for new/unauthenticated users
- [ ] On first save (sign-in), the Name Your List dialog appears pre-filled with "My List"
- [ ] Name Your List dialog does not accept a blank name
- [ ] My Lists view shows all saved lists with name, item count, and last updated
- [ ] Tapping a list in My Lists switches to it and returns to the main view
- [ ] New List creates an empty list with a required name and sets it as active
- [ ] Tapping a list name in My Lists allows inline rename; blank names are rejected
- [ ] Delete shows a confirmation dialog before destroying any data
- [ ] Deleting the last list auto-creates a new empty "My List"
- [ ] Deleting the active list switches to the next available list (or auto-creates)
- [ ] Returning to the app opens the last active list

---

## Out of Scope (v1)

- List sharing / collaboration — this PRD is the prerequisite; sharing is the next milestone
- Reordering lists
- List duplication / copy
- Archiving lists (as distinct from deleting)
- Renaming a list after creation — supported in v1 (see My Lists view requirements)
- Push notifications

---

## Dependencies & Sequencing

This feature must ship **before** list sharing. The sharing feature depends on:
- Named lists (so the share invitation can say "Jeff shared 'Weekly Groceries' with you")
- Multi-list data model (`list_members` references a specific `list_id`)

**Internal sequencing:**
1. Data model: add `name` column to `lists`, Supabase migration
2. `useList` / `useLists` hook refactor
3. Hamburger menu + header changes
4. My Lists view (create, switch, delete)
5. Name Your List dialog (post-sign-in flow)
6. Active list persistence via localStorage

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | What is the hamburger icon style — standard three-line, or a custom icon? | Design | Open |
| 2 | Does the My Lists view slide in as a panel, or navigate as a full-page view? | Design | Open |
| 3 | Should renaming a list be in v1? (One-tap on the name to edit inline) | Jeff | Resolved — yes, inline rename in v1 |
| 4 | Item count on list row — does it count all items or only unchecked? | Jeff | Resolved — all items |
