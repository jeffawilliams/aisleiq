# AisleIQ — Project State

## Repo
https://github.com/jeffawilliams/aisleiq

## App name (UI)
ShoppingListAssist — the repo folder is still named AisleIQ but the displayed app name is ShoppingListAssist.

## Stack
- Frontend: React 19, TypeScript, Vite (port 5173 default; bumps to 5175 if lower ports in use)
- Backend: Node.js, Express, TypeScript (port 3001)
- AI: Claude `claude-sonnet-4-6` via Anthropic SDK, structured output via `zodOutputFormat`
- Database: Supabase (Postgres) — project URL: https://srufojbssogplbgauosk.supabase.co

## Architecture
- Single `store_layout` table in Supabase (id=1, single row upsert)
- Backend proxies all Supabase calls — credentials never exposed to frontend
- Input UI: flat list builder (FAB + bottom sheet) → Organize → ResultsGrid

## Key files

### Backend
- `backend/src/schemas/aisleSchema.ts` — Zod schemas: OrganizeRequest/Output + ScanRequest/Output
- `backend/src/services/claudeService.ts` — `organizeShoppingList()` + `scanImage()`
- `backend/src/routes/categorize.ts` — POST /api/categorize
- `backend/src/routes/scan.ts` — POST /api/scan (vision API, product + list modes)
- `backend/src/index.ts` — express.json limit set to 10mb for base64 image payloads

### Frontend
- `frontend/src/App.tsx` — listItems state, addItems/removeItem/handleOrganize handlers
- `frontend/src/components/ShoppingListInput.tsx` — flat list + FAB + AddItemSheet + Organize button
- `frontend/src/components/FAB.tsx` — fixed circular + button (bottom: 90px, right: 20px)
- `frontend/src/components/AddItemSheet.tsx` — bottom sheet; routes: menu / type / product-confirm / list-review
- `frontend/src/components/CameraCapture.tsx` — hidden dual file inputs; canvas compress to 1200px JPEG 0.8
- `frontend/src/components/ProductConfirm.tsx` — full-screen modal, editable product name
- `frontend/src/components/ListReview.tsx` — full-screen checklist, all items pre-checked
- `frontend/src/components/ResultsGrid.tsx` — renders organized categories after Organize
- `frontend/src/components/AisleManager.tsx` — accordion layout editor (legacy, pre-existing TS errors)
- `frontend/src/components/AisleCard.tsx` — result card (legacy, pre-existing TS errors)

## Scan flow
1. User taps FAB → bottom sheet → "Scan a product" or "Scan a list"
2. CameraCapture fires hidden file input (`capture="environment"`)
3. Image compressed → base64 → POST /api/scan { image, mode }
4. Claude vision returns `{ items: string[] }`
5. Single product result → ProductConfirm (editable); multiple → ListReview (checklist)
6. Confirmed items added to flat listItems state

## Known pre-existing issues
- `AisleCard.tsx` and `AisleManager.tsx` have TypeScript errors (missing type exports from `../types/index.ts`) — not introduced by recent work, not blocking

## Current feature state (as of 2026-02-26)
- Multi-source ingestion: type, paste clipboard, scan product, scan handwritten list
- Flat staging list with per-item remove button
- FAB + bottom sheet navigation
- Organize submits flat list joined by `\n` to existing categorize endpoint
- ResultsGrid renders organized output as before

## Planned next steps (from spec backlog)
1. **Clear all checks** button — reset cart for new shopping trip
2. **Print view** — clean printable organized list
3. **Multiple store layouts** — save/switch between store configs
4. **Mobile optimization** — responsive polish for in-store use
