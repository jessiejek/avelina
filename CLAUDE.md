# Avelina's Bakery — Project Intelligence

**Live URL:** https://avelinas.vercel.app  
**Stack:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Supabase (PostgreSQL + Auth + Storage + Realtime)  
**Repo:** https://github.com/jessiejek/avelina  
**Deployed on:** Vercel (auto-deploy from `main` branch)

---

## What This App Is

A full-stack bakery management PWA for **Avelina's Artisan Bakery**. It has two completely separate sides:

- **Public side** (`/`) — customer-facing storefront: browse menu, add to cart, pre-order with pickup date, track orders
- **Admin side** (`/admin/*`) — baker/admin dashboard: manage inventory, recipes, orders, bake log, finished goods shelf, finance, stats

---

## Tech Stack Details

| Layer | Tool |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4 (CSS-based config, no `tailwind.config.js`) |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Storage | Supabase Storage (bucket: `recipe-images`, `ingredient-images`) |
| Realtime | Supabase `postgres_changes` subscriptions |
| Deployment | Vercel |
| Icons | Google Material Symbols (`<Icon name="..." />`) + Lucide React (ingredient display only) |
| Fonts | Hanken Grotesk (headings), Work Sans (body) |
| Money | `src/lib/money.ts` — `peso(n)` formats Philippine Peso (₱) |

---

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Set in Vercel project settings and local `.env`.

---

## Routing Structure (`src/App.tsx`)

### Public Shell (`PublicShell`)
| Path | Screen | Notes |
|---|---|---|
| `/` | `PublicHome` | Storefront, recipe browse, category filter |
| `/login` | `LoginPage` | Email/password + Google OAuth |
| `/profile/setup` | `ProfileSetup` | One-time profile setup (name, phone, address + Locate Me) |
| `/cart` | `CartPage` | Cart with qty/date per item |
| `/checkout` | `CheckoutPage` | Checkout with editable address + Locate Me, payment |
| `/order-confirmed` | `OrderConfirmed` | Post-order confirmation |
| `/orders` | `OrdersPage` | Customer order history |

**Auth guard pattern:**  
Cart/Checkout check `profileLoading` first (async fetch from DB), then `session`, then `profile`. This prevents logged-in users being bounced to `/login` during the profile fetch race condition.

### Admin Shell (`AdminShell`)
All under `/admin/*`. Requires `role = "admin"` in `users` table.

| Path | Screen |
|---|---|
| `/admin/inventory` | `InventoryDashboard` |
| `/admin/inventory/:id` | `IngredientDetail` |
| `/admin/inventory/adjust` | `StockAdjustment` |
| `/admin/recipes` | `RecipesList` |
| `/admin/recipes/builder` | `RecipeBuilder` |
| `/admin/recipes/confirm` | `BakeConfirmation` |
| `/admin/orders` | `AdminOrders` |
| `/admin/bakelog` | `BakeLog` |
| `/admin/stats` | `Stats` |
| `/admin/finance` | `FinanceDashboard` |

**Mobile nav:** 4 tabs (Stock, Recipes, Orders, Log) + center raised `+` button (New Production) + "More" bottom drawer (Finance, Stats, Sign Out). Desktop has a full sidebar.

---

## Database Schema (Supabase)

### `users`
```sql
id          uuid PRIMARY KEY  -- matches auth.users.id
name        text
phone       text
address     text
role        text DEFAULT 'customer'  -- 'customer' | 'admin'
```

### `ingredients`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text
sku           text
quantity      numeric
unit          text               -- 'kg', 'g', 'units', 'ml', etc.
status        text               -- 'optimal' | 'low' | 'critical'
icon          text DEFAULT 'wheat'  -- icon key (display only, no longer user-selectable)
img           text               -- public URL from Supabase Storage
cost_per_unit numeric DEFAULT 0
low_threshold numeric
```

### `inventory_adjustments`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
ingredient_id uuid REFERENCES ingredients(id)
delta         numeric            -- positive = add, negative = deduct
unit          text
reason        text               -- 'Opening balance' | 'Restock' | 'Production use' | etc.
adjusted_by   text
created_at    timestamptz DEFAULT now()
```

### `recipes`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
name                    text
category                text               -- 'Sourdough' | 'Viennoiserie' | 'Cakes' | 'Pastry' | 'Bread' | 'Other'
yield                   text               -- e.g. "24 units"
time                    text               -- e.g. "18h 45m"
img                     text
description             text
prep_time               text
difficulty              text
price                   numeric DEFAULT 0
is_available            boolean DEFAULT true
finished_shelf_life_days integer
```

### `recipe_ingredients`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
recipe_id     uuid REFERENCES recipes(id) ON DELETE CASCADE
ingredient_id uuid REFERENCES ingredients(id)
qty           text
unit          text
```

### `recipe_steps`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
recipe_id   uuid REFERENCES recipes(id) ON DELETE CASCADE
num         text               -- "01", "02", etc.
title       text
description text
sort_order  integer
```

### `orders`
```sql
id               text PRIMARY KEY   -- format: 'AV-XXXXXX'
user_id          uuid REFERENCES users(id)
status           text               -- 'pending' | 'confirmed' | 'baking' | 'ready' | 'completed' | 'cancelled'
fulfillment_type text DEFAULT 'pickup'  -- 'pickup' | 'delivery'
notes            text
payment_method   text               -- 'cash' | 'gcash'
gcash_reference  text
placed_at        timestamptz DEFAULT now()
completed_at     timestamptz
cancelled_at     timestamptz
fulfilled_qty    integer DEFAULT 0
```

### `order_items`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id    text REFERENCES orders(id) ON DELETE CASCADE
recipe_id   uuid REFERENCES recipes(id)
qty         integer
pickup_date text               -- 'YYYY-MM-DD'
unit_price  numeric
```

### `order_edit_log`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
order_id      text REFERENCES orders(id)
order_item_id uuid
old_qty       integer
new_qty       integer
edited_by     text
edited_at     timestamptz
```

### `bake_entries`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
recipe_id   uuid REFERENCES recipes(id)
order_id    text REFERENCES orders(id)   -- null if walk-in/stock bake
batch_id    text                          -- 'SKU-YYYY-XXXX-BN'
baker       text
status      text   -- 'completed' | 'in_progress' | 'failed'
qty         numeric                       -- planned qty
actual_qty  numeric                       -- actual yield
cost        numeric                       -- total ingredient cost for this bake
started_at  timestamptz DEFAULT now()
created_at  timestamptz DEFAULT now()
```

### `finished_goods`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
recipe_id     uuid REFERENCES recipes(id) ON DELETE CASCADE  -- UNIQUE (one row per recipe)
quantity      numeric DEFAULT 0
cost_per_unit numeric DEFAULT 0
unit          text DEFAULT 'units'
baked_at      timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```
One row per recipe. `addFinishedGoods()` uses weighted-average cost when merging batches. `baked_at` is preserved on returns (order cancellations) to keep shelf age accurate.

### `finished_goods_dispositions`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
recipe_id        uuid REFERENCES recipes(id)
quantity         numeric                   -- NOTE: column is 'quantity' not 'qty'
reason           text                      -- 'cash_sale' | 'personal_use' | 'donated_comped' | 'spoiled_discarded'
unit_price       numeric                   -- set for cash_sale only
amount_collected numeric                   -- cash_sale: unit_price × qty
writeoff_value   numeric                   -- non-sale: cost_per_unit × qty
notes            text
tagged_at        timestamptz DEFAULT now() -- NOTE: column is 'tagged_at' not 'disposed_at'
tagged_by        text
```
**Critical:** actual DB columns differ from the original SCHEMA.sql (which used `IF NOT EXISTS` so old table persisted). Always use `quantity` and `tagged_at`.

### `expenses`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
type          text     -- 'ingredient_purchase' | 'equipment' | 'utilities' | 'packaging' | 'other'
category      text     -- used for finance grouping
amount        numeric
description   text
ingredient_id uuid     -- optional, links to ingredient
qty           numeric
unit          text
note          text
recorded_at   timestamptz DEFAULT now()
created_by    text
```

---

## Supabase Realtime

All tables are in the `supabase_realtime` publication. Subscriptions are set up in:
- `InventoryDashboard` — `finished_goods`, `finished_goods_dispositions`
- `AdminOrders` — `orders`, `order_items`
- `Stats` — `bake_entries`, `orders`, `ingredients`
- `FinanceDashboard` — `expenses`, `finished_goods_dispositions`, `orders`
- `App.tsx` (public shell) — `recipes`, `orders` (for customer order tracking)

BakeLog realtime comes for free via App.tsx's `bake_entries` subscription which updates the `bakeLogs` prop.

---

## Key Business Logic

### Order Flow
```
Pending → Confirmed → Baking → Ready → Completed
                                      ↘ Cancelled (any stage)
```
- **Confirmed → Baking:** Admin clicks "Start Baking" → navigates to BakeConfirmation
- **Baking → Ready:** Admin marks bake done with actual qty → `addFinishedGoods()` called → inventory deducted
- **Cancellation:** If `fulfilled_qty > 0`, baked units are returned to `finished_goods` shelf via `returnToFinishedGoods()` (preserves `baked_at` age). A `production_loss` expense is logged.

### Finished Goods Shelf
Sits between baking and fulfillment. After a bake completes, units land on the shelf (`finished_goods` table). Admin can then "Tag Disposition" to:
- **Sold — Walk-in** (`cash_sale`): requires price, logs revenue, deducts shelf
- **Staff / Personal** (`personal_use`): logs writeoff expense
- **Given / Comped** (`donated_comped`): logs writeoff expense
- **Thrown Away** (`spoiled_discarded`): logs spoilage writeoff

### Ingredient Deduction
When a bake completes in `BakeConfirmation`, each recipe ingredient's `quantity` is decremented in the `ingredients` table and an `inventory_adjustments` row is inserted (reason: "Production use — {recipe name}").

### Cost Tracking
- `BakeConfirmation` calculates bake cost from ingredient `cost_per_unit × qty used`
- Cost is stored in `bake_entries.cost`
- `finished_goods.cost_per_unit` uses weighted average when batches are merged
- Finance dashboard reads `expenses` + `finished_goods_dispositions` for P&L view

---

## Admin Screens

### InventoryDashboard (`/admin/inventory`)
- Lists all ingredients with status badges (Optimal / Low / Critical)
- Add ingredient: name, SKU, stock, cost, unit, status, photo (no icon picker — all default to wheat icon)
- Per-ingredient: adjust stock, view movement history, sell/give away finished goods
- "Tag Disposition" modal: qty stepper (−/+ buttons), reason, price (required for cash_sale)

### IngredientDetail (`/admin/inventory/:id`)
- Full ingredient card with stock movements (last 10, shows date + time)
- Each movement shows: reason, date, time (e.g. "Jun 24, 2026 · 3:00 PM")

### RecipesList (`/admin/recipes`)
- Cards filtered by category pills: Sourdough, Viennoiserie, Cakes, Pastry, Bread, Other
- Categories are **static** (hardcoded). Dynamic category editor is a planned future feature.
- Each card shows finished goods shelf stock count

### RecipeBuilder (`/admin/recipes/builder`)
- Edit recipe: name, category, yield, time, price, shelf life, description, difficulty, photo
- Manage ingredients (link to inventory) and steps
- Cost calculator from ingredient costs

### BakeConfirmation (`/admin/recipes/confirm`)
- Triggered when admin starts a bake (from recipe or from order)
- Shows ingredient checklist, deducts inventory on confirm
- Logs `bake_entries` with `status: 'completed'`, `actual_qty`, `cost`
- Calls `addFinishedGoods()` to add units to shelf

### AdminOrders (`/admin/orders`)
- Collapsible order cards (active orders auto-expanded, done orders collapsed + faded)
- Status filter: horizontal scroll row on mobile, grid on desktop
- Per-order: advance status, toggle pickup/delivery, edit item qty + pickup date, cancel
- Edit modal allows changing both quantity AND pickup date in one action

### BakeLog (`/admin/bakelog`)
- Table of all bake entries: product, batch ID, baker, date+time, planned qty, actual yield, status
- Filters: Today / This Week / This Month / All Time (default: Today)
- Search: product name, batch ID, baker
- Inline "Done" action for in-progress bakes (records actual qty)

### Stats (`/admin/stats`)
- Period filter: Today / This Week / This Month (default: Today)
- 7-day bake activity bar chart
- Top recipes by volume (progress bars, %)
- KPI cards: Completed Bakes, Pending Orders (tappable → /admin/orders), Stock Alerts
- Inventory Stock Health table

### FinanceDashboard (`/admin/finance`)
- Period filter: Today / This Week / This Month / All Time (default: Today)
- Revenue KPIs: Walk-in Sales, Order Revenue, Total Revenue, Total Expenses, Net Profit
- Walk-in Sales & Giveaways table (from `finished_goods_dispositions`)
- Expenses breakdown

---

## Public/Customer Screens

### PublicHome (`/`)
- Hero section, category pills, recipe cards
- "Add to Cart" → checks auth → if not logged in, saves pending recipe and redirects to `/login`
- After login/profile setup, pending recipe is added to cart automatically

### ProfileSetup (`/profile/setup`)
- One-time setup: Full Name, Phone Number, Address
- **Locate Me button**: uses browser Geolocation API + OpenStreetMap Nominatim reverse geocoding → fills address field with full street address

### CartPage (`/cart`)
- Line items with qty stepper and pickup date per item
- Auth guard: waits for `profileLoading` to finish before redirecting (prevents false redirect to login)

### CheckoutPage (`/checkout`)
- Shows customer info (name, email, phone)
- **Address section**: always-visible editable textarea + **Locate Me button**
- Payment: Cash on Pickup or GCash (requires reference number)
- On Place Order: inserts `orders` + `order_items` rows

### OrdersPage (`/orders`)
- Customer's order history with status badges

---

## Lib Helpers

### `src/lib/money.ts`
```ts
peso(n: number): string  // formats as "₱150.00"
```

### `src/lib/supabase.ts`
- `supabase` — Supabase client
- `uploadImage(bucket, file)` — compresses to ≤3MB via canvas binary search, uploads, returns public URL
- `validateImageFile(file)` — checks MIME type

### `src/lib/finishedGoods.ts`
- `addFinishedGoods(recipeId, qty, costPerUnit, unit)` — fresh bake → shelf (updates baked_at)
- `returnToFinishedGoods(recipeId, qty, costPerUnit, unit, originalBakedAt?)` — cancelled order → shelf (preserves baked_at)
- `consumeFinishedGoods(recipeId, qty)` — deducts from shelf, returns `{consumed, shortfall}`
- `getFinishedGoodsInfo(recipeId)` — returns `{quantity, baked_at, cost_per_unit}`

### `src/lib/recipeCost.ts`
- Calculates total ingredient cost for a recipe batch

---

## Components

| Component | Purpose |
|---|---|
| `Sidebar` | Desktop left nav (hidden on mobile) |
| `Icon` | Wraps Google Material Symbols |
| `BakeLogger` | Legacy bake logging widget (pre-Supabase era) |
| `AdvisorChat` | AI-flavored chat widget (bakery advisor persona) |
| `HydrationCalculator` | Sourdough hydration calculator tool |
| `JournalLogs` | Legacy journal entries component |

---

## Styling Notes

- **Color system:** Custom Tailwind v4 CSS variables defined in `src/index.css` under `@theme {}`
- **Primary palette:** `#26170c` (dark brown) for admin, warm beige `#fff8f5` for backgrounds
- **Admin theme:** Material Design 3-inspired tokens (`--color-primary`, `--color-surface-container`, etc.)
- **Public theme:** Minimalist cream/brown editorial style
- **No `tailwind.config.js`** — Tailwind v4 uses CSS-only configuration
- **Custom animation:** `@keyframes slideUp` in `index.css` for the mobile More drawer

---

## Known Schema Gotcha

The `finished_goods_dispositions` table was created BEFORE the current `SCHEMA.sql` was written. Because of `CREATE TABLE IF NOT EXISTS`, the old table persisted with its original column names:

| SCHEMA.sql says | Actual DB column |
|---|---|
| `qty` | `quantity` |
| `disposed_at` | `tagged_at` |
| *(missing)* | `unit_price` |
| *(missing)* | `tagged_by` |

**Always use:** `quantity`, `tagged_at`, `unit_price`, `tagged_by` when querying this table.

---

## User Roles

| Role | Access |
|---|---|
| `admin` | Full `/admin/*` dashboard. Set manually in `users.role`. |
| `customer` | Public storefront, cart, checkout, order tracking. |

Role is checked in `App.tsx` `redirectByRole()` after login. Admins go to `/admin`, customers go to `/`.

---

## Image Storage

Supabase Storage buckets:
- `recipe-images` — recipe photos
- `ingredient-images` — ingredient photos

Images are compressed client-side to ≤3MB before upload using a canvas binary-search quality algorithm in `uploadImage()`.

---

## Realtime Subscription Pattern

```ts
const ch = supabase.channel("unique-channel-name")
  .on("postgres_changes", { event: "*", schema: "public", table: "table_name" }, callbackFn)
  .subscribe();

// cleanup:
return () => { supabase.removeChannel(ch); };
```

All tables are already in the `supabase_realtime` publication — no `ALTER PUBLICATION` needed.
