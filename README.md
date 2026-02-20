# AisleIQ

Paste your shopping list. AisleIQ uses Claude AI to sort every item into the right aisle and category — organized the way your store is actually laid out.

## How it works

1. Define your store layout — aisles and the product categories inside each one
2. Paste your shopping list
3. Claude assigns every item to the correct category
4. Results display as a nested aisle → category → items hierarchy

## Stack

- **Frontend** — React 19, TypeScript, Vite
- **Backend** — Node.js, Express, TypeScript
- **AI** — Claude (`claude-opus-4-6`) via the Anthropic SDK, with structured JSON output enforced by Zod

## Project structure

```
AisleIQ/
├── backend/
│   └── src/
│       ├── index.ts              # Express server (port 3001)
│       ├── routes/categorize.ts  # POST /api/categorize
│       ├── schemas/aisleSchema.ts # Zod request + output schemas
│       └── services/claudeService.ts # Claude API call
└── frontend/
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── AisleManager.tsx  # Accordion layout editor
        │   ├── AisleCard.tsx     # Result card (aisle → categories → items)
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

### Install

```bash
cd AisleIQ
npm run install:all
```

### Configure

Create `backend/.env`:

```
ANTHROPIC_API_KEY=your_key_here
```

### Run

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## API

### `POST /api/categorize`

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
