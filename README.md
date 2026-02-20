# AisleIQ

Paste your shopping list. AisleIQ uses Claude AI to sort every item into the right aisle and category — organized the way your store is actually laid out.

## How it works

**Configure Store (admin)**
1. Define your store layout — aisles and the product categories inside each one
2. Customize aisle names to match your store (click any name to rename it inline)
3. Changes are saved automatically to the database

**Organize My List (customer)**
1. Paste your shopping list
2. Claude assigns every item to the correct category
3. Results display as a nested aisle → category → items hierarchy

## Stack

- **Frontend** — React 19, TypeScript, Vite
- **Backend** — Node.js, Express, TypeScript
- **AI** — Claude (`claude-sonnet-4-6`) via the Anthropic SDK, with structured JSON output enforced by Zod
- **Database** — Supabase (Postgres), used to persist the store layout across devices and sessions

## Project structure

```
AisleIQ/
├── backend/
│   └── src/
│       ├── index.ts                    # Express server (port 3001)
│       ├── routes/categorize.ts        # POST /api/categorize
│       ├── routes/layout.ts            # GET and PUT /api/layout
│       ├── schemas/aisleSchema.ts      # Zod request + output schemas
│       └── services/
│           ├── claudeService.ts        # Claude API call
│           └── supabaseClient.ts       # Supabase client initialization
└── frontend/
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── AisleManager.tsx        # Accordion layout editor (add, rename, remove aisles and categories)
        │   ├── AisleCard.tsx           # Result card (aisle → categories → items)
        │   ├── ResultsGrid.tsx
        │   ├── ShoppingListInput.tsx
        │   └── LoadingSpinner.tsx
        ├── hooks/useCategorize.ts
        └── types/index.ts
```

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- A [Supabase](https://supabase.com) project with the following table:

```sql
create table store_layout (
  id integer primary key default 1,
  aisles jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into store_layout (id, aisles) values (1, '[]'::jsonb);
```

### Install

```bash
cd AisleIQ
npm run install:all
```

### Configure

Create `backend/.env`:

```
ANTHROPIC_API_KEY=your_anthropic_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## API

### `GET /api/layout`

Returns the saved store layout.

**Response**
```json
{
  "aisles": [
    { "name": "Produce", "categories": ["Vegetables", "Fruits"] }
  ]
}
```

### `PUT /api/layout`

Saves the store layout.

**Request**
```json
{
  "aisles": [
    { "name": "Produce", "categories": ["Vegetables", "Fruits"] }
  ]
}
```

### `POST /api/categorize`

Categorizes a shopping list against the store layout.

**Request**
```json
{
  "aisles": [
    { "name": "Produce", "categories": ["Vegetables", "Fruits"] },
    { "name": "Dairy & Eggs", "categories": ["Milk & Cream", "Cheese"] }
  ],
  "items": "milk, apples, spinach, cheddar"
}
```

**Response**
```json
{
  "aisles": [
    {
      "name": "Produce",
      "categories": [
        { "name": "Vegetables", "items": ["spinach"] },
        { "name": "Fruits", "items": ["apples"] }
      ]
    },
    {
      "name": "Dairy & Eggs",
      "categories": [
        { "name": "Milk & Cream", "items": ["milk"] },
        { "name": "Cheese", "items": ["cheddar"] }
      ]
    }
  ]
}
```

Items that don't match any category are placed in an **Other** aisle.
