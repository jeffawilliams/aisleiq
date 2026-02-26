# ShoppingListAssist

Paste your grocery list. ShoppingListAssist uses Claude AI to organize every item into standard grocery store categories — no setup, no configuration required.

## How it works

1. Paste your grocery list in any format — brand names, quantities, shorthand, all fine
2. Claude organizes every item into standard grocery categories using its own knowledge
3. Results display as a categorized checklist — tap any item to check it off as you shop

Items that don't fit a standard category are placed in **Other**. Unrecognized items are never dropped.

## Stack

- **Frontend** — React 19, TypeScript, Vite
- **Backend** — Node.js, Express, TypeScript
- **AI** — Claude (`claude-sonnet-4-6`) via the Anthropic SDK, with structured JSON output enforced by Zod

## Project structure

```
ShoppingListAssist/
├── backend/
│   └── src/
│       ├── index.ts                    # Express server (port 3001)
│       ├── routes/categorize.ts        # POST /api/categorize
│       ├── schemas/aisleSchema.ts      # Zod request + output schemas
│       └── services/claudeService.ts  # Claude API call
└── frontend/
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── CategoryCard.tsx        # Result card with interactive checklist
        │   ├── ResultsGrid.tsx         # Sorts and renders category cards
        │   ├── ShoppingListInput.tsx
        │   └── LoadingSpinner.tsx
        ├── hooks/useCategorize.ts
        └── types/index.ts
```

## Getting started

### Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Install

```bash
npm run install:all
```

### Configure

Create `backend/.env`:

```
ANTHROPIC_API_KEY=your_anthropic_key
```

### Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## API

### `POST /api/categorize`

Organizes a grocery list into standard categories.

**Request**
```json
{
  "items": "milk, apples, Tillamook cheddar, OJ, sourdough, frozen peas"
}
```

**Response**
```json
{
  "categories": [
    { "name": "Produce",      "items": ["apples"] },
    { "name": "Dairy & Eggs", "items": ["milk", "Tillamook cheddar"] },
    { "name": "Bakery",       "items": ["sourdough"] },
    { "name": "Frozen",       "items": ["frozen peas"] },
    { "name": "Beverages",    "items": ["OJ"] }
  ]
}
```
