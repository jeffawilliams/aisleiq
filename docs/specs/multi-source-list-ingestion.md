# Feature Spec: Multi-Source Shopping List Ingestion
**Product:** ShoppingListAssist
**Author:** Jeff Williams
**Status:** Draft
**Date:** 2026-02-26

---

## Problem Statement

ShoppingListAssist currently supports only typed or pasted text for building a shopping list. That works fine at a desk — but the app's highest-value moments happen in the kitchen, the pantry, and standing in front of the fridge, phone in hand. Shoppers build lists from all kinds of sources: a product they're running low on, a meal plan printout, a sticky note on the counter, a photo they took at the store. The app needs to meet users where they actually are, which is primarily on mobile, and support getting items into a list from whatever source they happen to have in front of them.

---

## Goals

- Support camera-based item entry as a first-class input method alongside typing and pasting
- Allow items to be added incrementally from multiple sources into a single working list
- Design the experience mobile-first
- Keep items in a flat, editable staging list before submission for organization

---

## Non-Goals (This Release)

- User authentication and list persistence (tracked separately)
- Configurable auto-add without confirmation — deferred to a personalization setting post-auth
- Barcode / UPC lookup — this feature uses vision and OCR, not barcode parsing
- Multi-list management or list collaboration

---

## User Stories

**As a shopper in my kitchen:**
I want to take a photo of a product I'm running low on so it gets added to my list without typing — and I want to confirm or edit the product name before it lands, especially since brand and size matter.

**As a shopper transferring a list from another source:**
I want to photograph a handwritten grocery list, a meal plan printout, or a list on another app so I don't have to re-type everything. I want to review what was detected before anything gets added.

**As any shopper:**
I want to add items from different sources — type some, scan some, paste some — and have everything land in the same working list before I organize it.

---

## Functional Requirements

### FR1 — Floating Action Button (FAB)
- A "+" FAB is pinned to the lower-right corner of the list-building view
- It remains visible and accessible at all times without scrolling
- Tapping it opens a bottom sheet with input method options
- The FAB stays positioned above the keyboard when the keyboard is open

### FR2 — Bottom Sheet: Input Method Picker
- Bottom sheet slides up from the bottom on tap
- Four options:
  - **Type item**
  - **Paste from clipboard**
  - **Scan a product** — optimized for a single product label; returns full brand + size name
  - **Scan a list** — optimized for a written or printed list; returns multiple items for review
- Dismissible by swiping down or tapping the overlay behind it
- The distinction between the two scan modes is surfaced here in the UI — the user always knows which mode they're invoking, and the backend receives a deterministic `mode` value with no inference needed

### FR3 — Type Item
- Opens a text input field within or adjacent to the bottom sheet
- Pressing return/enter adds the item to the flat list and clears the field
- User can add multiple items before dismissing
- Behavior is consistent with existing typed-entry experience

### FR4 — Paste from Clipboard
- Reads the device clipboard on tap
- Splits content by newlines; each non-empty line becomes a separate item
- All items are appended to the flat list immediately
- A brief confirmation toast displays: "X items added from clipboard"

### FR5 — Camera Capture
- Triggered via `input[type=file][capture=environment]` — uses the device's native rear-facing camera
- No custom camera UI; relies on the OS camera for compatibility and familiarity
- After capture, the image is compressed/resized on the frontend before upload
- A loading state is shown while Claude processes the image

### FR6 — Product Scan Confirmation
- User selects "Scan a product" — intended for a single product label (box, can, jar, etc.)
- Claude returns the full product name: brand + product name + variety + size/quantity as shown on the package
- **If one item is returned:** A confirmation modal is displayed with the detected name pre-filled in an editable text field. User can edit before confirming. On confirm, item appends to the flat list.
- **If multiple items are returned** (e.g., user photographed a shelf or multi-product scene): Route directly to the list review screen (FR7). No error shown — the extra items become a review experience rather than a dead end.
- On cancel at either screen, nothing is added and user returns to the bottom sheet

### FR7 — List Scan Review
- User selects "Scan a list" — intended for handwritten or printed lists, another app's screen, a sticky note, etc.
- Claude returns an array of all detected items from the image
- A full review screen is displayed showing:
  - All detected items as a checklist, all pre-checked by default
  - User can uncheck items to exclude them (errors, duplicates)
  - **Add X items** button with a count that updates dynamically as items are checked/unchecked
  - **Cancel** option
- On confirm, all checked items append to the flat list
- On cancel, nothing is added

### FR8 — Flat List Staging Area
- The working list displays all items from all sources as a single flat list
- No source tags — items from typing, pasting, and scanning are visually identical
- Individual items can be deleted before organizing
- The existing **Organize my list** action submits the full combined list as before

### FR9 — Error Handling
- Unrecognizable product image → friendly error message with a retry option
- List scan returns no items → error message with retry and "type manually" fallback
- Backend/network failure → error toast with retry option
- No error state should leave the user without a path forward

### FR10 — Inline Tap-to-Type Input
- A persistent text input field is always visible at the bottom of the list area, above the FAB
- The field displays placeholder text: **"Add an item..."**
- Tapping the field focuses it immediately — no bottom sheet, no extra taps
- Pressing return/enter adds the item to the flat list and clears the field, keeping focus so the user can continue typing additional items
- The field is always present regardless of whether the list is empty or has items
- The existing empty state message ("Tap + to start adding items") is removed; the input field's placeholder text serves that purpose
- The FAB remains available at all times for scan, paste, and other multi-source entry methods
- These two entry points are complementary and non-exclusive: the inline input is optimized for fast sequential typing; the FAB is optimized for scanning and pasting

---

## UX / Screen Flows

### List Builder View (Updated)

```
┌─────────────────────────────────┐
│  My List                        │
│  ───────────────────────────    │
│  □  Milk                        │
│  □  Eggs                        │
│  □  Rao's Homemade Marinara 24oz│
│  □  Bread                       │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Add an item...           │    │  ← always-visible inline input
│  └─────────────────────────┘    │
│                             [+] │  ← FAB, always visible
└─────────────────────────────────┘
```

### Bottom Sheet — Input Method Picker

```
┌─────────────────────────────────┐
│         Add an item             │
│  ───────────────────────────    │
│  ⌨️   Type item                 │
│  📋  Paste from clipboard       │
│  📦  Scan a product             │
│  📄  Scan a list                │
└─────────────────────────────────┘
```

### Modal — Product Scan Confirmation

```
┌─────────────────────────────────┐
│  Does this look right?          │
│  ───────────────────────────    │
│  ┌─────────────────────────┐   │
│  │ Rao's Homemade Marinara  │   │
│  │ Sauce 24 oz              │   │
│  └─────────────────────────┘   │
│                                 │
│  [Cancel]       [Add to list]   │
└─────────────────────────────────┘
```

### Screen — List Scan Review

```
┌─────────────────────────────────┐
│  Review detected items          │
│  ───────────────────────────    │
│  ☑  Milk                        │
│  ☑  Eggs                        │
│  ☑  Bread                       │
│  ☑  Orange juice                │
│  ☑  Butter                      │
│                                 │
│  [Cancel]      [Add 5 items →]  │
└─────────────────────────────────┘
```

---

## Technical Requirements

### Backend — New Route: `POST /api/scan`

**Request:**
```typescript
{
  image: string;          // base64-encoded image data
  mode: 'product' | 'list';
}
```

**Response (both modes):**
```typescript
{ items: string[] }
```

Both modes return the same shape. Frontend routing logic determines which confirmation UI to show:
- `items.length === 1` → ProductConfirm modal
- `items.length > 1` → ListReview screen

**Error response:**
```typescript
{ error: string; retryable: boolean }
```

**Claude prompt — product scan:**
> *"Identify the product shown in this image. Return the full product name exactly as it appears on the package — include brand name, product name, flavor or variety, and size or quantity if visible. If you see multiple distinct products, return each as a separate item. Return a JSON array of strings. Return only the JSON array, nothing else."*

**Claude prompt — list scan:**
> *"This image contains a shopping list or list of items. Extract every item you can read from the list. Return them as a JSON array of strings. Return only the JSON array, nothing else."*

### Frontend — New Components

| Component | Responsibility |
|---|---|
| `FAB.tsx` | Floating action button; triggers bottom sheet |
| `AddItemSheet.tsx` | Bottom sheet with four input method options |
| `CameraCapture.tsx` | File input, camera trigger, image resize/compress, base64 encoding |
| `ProductConfirm.tsx` | Modal with editable text field for single-item product scan confirmation |
| `ListReview.tsx` | Full-screen checklist for multi-item review (list scan and multi-product scan) |

### Existing Files — Changes Required

| File | Change |
|---|---|
| `App.tsx` | Add flat list state; add item-append handlers for all input sources; wire up new components |
| Current text area | Repurpose into the "Type item" path within `AddItemSheet` — retain, relocate |
| `ShoppingListInput.tsx` | Add persistent inline text input above the FAB; remove empty state `<p>` element ("Tap + to start adding items") — the input's placeholder text replaces it |

### Image Handling Notes
- Resize images to max 1200px on the long edge before encoding
- Compress to JPEG at ~80% quality
- Keeps payload well under Claude's 5MB vision API limit while preserving OCR fidelity

---

## Acceptance Criteria

### FAB + Bottom Sheet
- [ ] FAB is visible on the list-builder view at 375px and above
- [ ] FAB stays above the keyboard when the keyboard is active
- [ ] Tapping FAB opens the bottom sheet with all four options visible
- [ ] Bottom sheet dismisses on swipe-down or tap-outside

### Type Item
- [ ] Pressing return adds the item to the flat list and clears the field
- [ ] Multiple items can be added before closing the sheet
- [ ] Empty input does not add a blank item

### Paste from Clipboard
- [ ] Clipboard content is split by newlines into individual items
- [ ] All non-empty lines are added to the flat list
- [ ] A toast confirms the count of items added
- [ ] Behavior validated on iOS Safari (clipboard permission prompt)

### Product Scan — Single Item
- [ ] Camera opens to the rear-facing camera on mobile
- [ ] Loading state is displayed while the image is processed
- [ ] Confirmation modal shows the Claude-returned name in an editable field
- [ ] User can edit the name before confirming
- [ ] Confirming adds the item to the flat list
- [ ] Canceling returns to the bottom sheet; nothing is added

### Product Scan — Multiple Items Returned
- [ ] Routes to the list review screen rather than the confirmation modal
- [ ] All detected items are shown pre-checked
- [ ] User can deselect items before confirming
- [ ] Confirming adds all checked items to the flat list

### List Scan
- [ ] Claude extracts all visible list items from the image
- [ ] Review screen shows all extracted items pre-checked
- [ ] User can uncheck individual items
- [ ] "Add X items" button count updates as items are checked/unchecked
- [ ] Confirming adds all checked items to the flat list
- [ ] Canceling returns without adding anything

### Error States
- [ ] Unrecognizable product image shows a user-friendly error with retry
- [ ] Empty list scan result shows an error with retry and manual-entry fallback
- [ ] Network or backend failure shows an error toast with retry option
- [ ] No error state leaves the user without a path forward

### Inline Tap-to-Type Input
- [ ] Persistent input field is visible at all times in the list-building view — empty state and populated state
- [ ] Empty state shows no hint text paragraph; input placeholder "Add an item..." serves that purpose
- [ ] Tapping the field focuses it without opening the bottom sheet
- [ ] Pressing return/enter adds the item to the flat list, clears the field, and keeps focus
- [ ] Empty input does not add a blank item
- [ ] FAB remains visible and functional while the inline input is focused
- [ ] Inline input and FAB-sourced items all land in the same flat list

### Flat List
- [ ] Items from typing, pasting, and scanning all appear in a single flat list
- [ ] Items can be individually deleted
- [ ] The Organize action submits the full combined list unchanged

---

## Open Questions

All open questions resolved.

| # | Question | Resolution |
|---|---|---|
| 1 | Explicit vs. inferred scan mode | **Explicit.** Bottom sheet presents "Scan a product" and "Scan a list" as distinct options. Backend receives `mode` from the frontend; no inference logic needed. |
| 2 | Clipboard permission on iOS | **Acknowledged.** Needs hands-on validation during implementation; no spec change required. |
| 3 | Multiple matches on product scan | **Multi-item review.** If more than one item is returned, route to the list review screen. No error shown to the user. |

---

## Future Considerations

- **Skip confirmation setting** — Post-auth personalization toggle: users who trust AI scan results can bypass the confirmation step
- **Barcode / UPC scanning** — Complement vision-based scanning with lookup by barcode for precise product identification
- **Autocomplete from history** — Previously scanned or entered items surfaced as suggestions
- **Scan to specific list** — Once multi-list support is in, allow the user to choose which saved list receives the scanned items
