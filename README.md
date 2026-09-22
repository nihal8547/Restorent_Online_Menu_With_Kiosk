# 🍽️ Zafran — Restaurant Online Menu + CRM + Kiosk

A full-stack restaurant system: QR-based table ordering, kitchen display, billing &
payments, waiter ordering, delivery orders with address capture, customer bill/history
(revealed only after payment), a full admin panel with reports & daily cost tracking,
and a ready-to-wire integration layer for delivery platforms (Keeta / Snoonu / Talabat).

## Features by phase

| Phase | What it does |
|-------|--------------|
| **Menu & Admin** | Category/item management, availability toggles, prices, photos |
| **QR ordering** | Per-table QR codes, scan → order without login; regenerate/change QR anytime |
| **Kitchen (KDS)** | Realtime order screen (Socket.IO); `New → Preparing → Ready → Served` |
| **Billing** | Cashier collects payment (cash/card/online), discounts, marks orders paid |
| **Delivery** | Address capture (Name, Street, Building No, Room *(optional)*, Zone) before confirm |
| **Reports** | Daily sales, item-wise sales, payments by mode, last-7-days chart |
| **Daily cost** | Expense entry per day → profit = sales − cost |
| **CRM** | Customers tracked by phone, order history & amount collected |
| **Waiter app** | Waiters take & place orders, view their placed orders live |
| **Customer bill & history** | Public bill link + phone history — **only after payment is completed** |
| **Platform integrations** | Webhook adapter for Keeta / Snoonu / Talabat (idempotent) |

## Tech stack

- **Backend:** Node.js + Express + Prisma ORM + PostgreSQL + Socket.IO
- **Frontend:** React + Vite + Tailwind CSS + Zustand
- **Auth:** JWT (staff only — customers order without login)

## Project structure

```
server/                  Express API
  prisma/schema.prisma   Full data model
  prisma/seed.js         Demo users, menu, tables
  src/routes/            auth, menu, tables, orders, payments,
                         expenses, reports, customers, bill, webhooks
client/                  React app
  src/pages/customer/    Menu, Checkout, BillView, History, Landing
  src/pages/kitchen/     Kitchen display
  src/pages/waiter/      Waiter order + orders list
  src/pages/admin/       Dashboard, Menu, Tables, Billing, Customers, Expenses, Reports
docker-compose.yml       Local Postgres
```

## Getting started

### 1. Start Postgres

```bash
docker compose up -d          # starts Postgres on localhost:5432
```

*(Or use any Postgres and update `DATABASE_URL`.)*

### 2. Backend

```bash
cd server
cp .env.example .env          # adjust values if needed
npm install
npm run db:push               # create tables
npm run seed                  # demo data + staff logins
npm run dev                   # http://localhost:4000
```

### 3. Frontend

```bash
cd client
npm install
npm run dev                   # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend, so no extra config
is needed in development.

## Demo logins

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Kitchen | `kitchen` | `staff123` |
| Cashier | `cashier` | `staff123` |
| Waiter | `waiter` | `staff123` |

## How staff / admin log in

The staff area is **kept separate** from the customer site — there is **no login link**
anywhere on the public pages. Staff open the login screen directly:

1. Go to **`/login`** (e.g. `https://yourdomain.com/login`) — the "Staff Portal" screen.
2. Enter the username and password (see the demo logins above; **admin / admin123**).
3. On success you're taken to your home screen by role:
   - **Admin** → `/admin` (dashboard: menu, tables & QR, billing, customers, daily cost, reports)
   - **Cashier** → `/admin/billing`
   - **Kitchen** → `/kitchen`
   - **Waiter** → `/waiter`

> Tip: bookmark `/login` for staff devices. Change the seeded passwords before going live
> (hash a new password and update the `users` table, or extend the seed).

## Customer flows

- **Dine-in:** scan the table QR → opens `/t/:qrToken` → order → after the cashier
  collects payment, the bill appears at `/order/:orderToken`.
- **Delivery / takeaway:** open `/menu` (shareable public link, no login) → for delivery,
  fill Name / Street / Building No / Room *(optional)* / Zone → place order.
- **History:** `/history` — enter phone number to see **paid** orders only.

## Key API endpoints

```
GET    /api/menu                       Public menu
GET    /api/tables/resolve/:qrToken     Resolve a table QR
POST   /api/orders                      Place order (customer, public)
POST   /api/orders/staff                Place order (waiter/admin)
PATCH  /api/orders/:id/status           Kitchen status update
POST   /api/payments                    Collect payment (cashier/admin)
GET    /api/bill/:orderToken            Public bill (paid-only)
GET    /api/bill/history/:phone         Public history (paid-only)
GET    /api/reports/daily               Daily sales / profit
POST   /api/webhooks/:platform          keeta | snoonu | talabat (x-webhook-secret)
```

## Delivery platform integration

Manage delivery partners in **Admin → Settings → Delivery Partners**:
**Snoonu, Talabat, Keeta, Rafeeq, Deliveroo**. For each you set an API key, API secret,
webhook secret, store id and base URL — secrets are **encrypted at rest** (AES-256-GCM)
and never returned to the browser (only masked). Each platform shows the **Webhook URL**
to hand to that partner, plus Enable and Test controls. API: `/api/integrations/*`.

`POST /api/webhooks/{snoonu|talabat|keeta|rafeeq|deliveroo}` receives each platform's own
payload. The request must carry `x-webhook-secret` matching that platform's stored secret,
the integration must be enabled, and duplicate `externalId`s are ignored (idempotent).

**Payload mapping** happens in two layers:

1. **Field mapping** — `server/src/utils/platformAdapters.js` has a per-platform adapter
   (`mapTalabat`, `mapSnoonu`, `mapKeeta`, `mapRafeeq`, `mapDeliveroo`) that translates the
   platform's JSON (their field names for order id, customer, address, line items) into our
   normalised order shape. The adapters accept several common field-name variants; tighten
   them against each platform's real API docs when you onboard.
2. **Item (SKU) mapping** — each platform sends its own product code (SKU/PLU). In
   **Admin → Menu Mapping** you map each menu item to each platform's SKU. Incoming line
   items are resolved to your menu via these codes (`/api/mapping`). If an order contains an
   unmapped SKU, the webhook responds `422` with the unmapped SKUs (the raw payload is logged
   under *failed* orders) so you can add the mapping and the platform retries.

## Inventory, tax & KOT (POS features)

- **Item sale counts** — Admin → *Inventory* → *Sale Count* shows total units sold and
  revenue per item (all-time). API: `GET /api/reports/top-items`.
- **Inventory / stock** — Admin → *Inventory*: toggle stock tracking per item, restock,
  record waste/adjustments, low-stock & out-of-stock alerts. Stock auto-decrements on every
  paid/placed order and blocks over-ordering. API: `GET/PUT/POST /api/inventory/*`.
- **Fiscal / tax compliance** — Admin → *Settings* → *Tax & Invoice*: set business name,
  address, tax registration number (TRN/VAT no.), tax %, label and invoice prefix. Tax is
  then applied to every order and each paid order receives a **sequential invoice number**;
  the customer receipt renders as a compliant **tax invoice**.
- **KOT auto-print** — Kitchen screen has an **Auto-print KOT** toggle; a new order prints an
  80mm thermal Kitchen Order Ticket automatically (plus a manual 🖨 per ticket).

- **Accounting integration** — Admin → *Accounting*: a P&L summary (net sales, tax
  collected, expenses, net profit), a balanced double-entry journal, and one-click exports
  your accountant can import:
  - **Sales CSV / Expenses CSV / Journal CSV** → Excel, QuickBooks, Zoho Books.
  - **Tally XML** → imports directly into Tally as Sales & Payment vouchers.

  API: `GET /api/accounting/summary`, `/journal`, `/export/{sales,expenses,journal}.csv`,
  `/export/tally.xml` (all accept `?from=&to=`).

### Silent KOT printing (no browser dialog)

Browsers show a print dialog by default. For fully automatic, dialog-free thermal printing,
launch the kitchen screen in Chrome/Chromium **kiosk-printing** mode (prints to the default
printer silently):

```bash
chromium --kiosk-printing --app=https://your-domain/kitchen
```

Set the thermal (80mm) printer as the machine's default printer. With this flag, enabling
*Auto-print KOT* prints each new order's ticket with no dialog.

## Security notes / production checklist

- Prices are always taken from the database — client-supplied prices are ignored.
- Change `JWT_SECRET` and `PLATFORM_WEBHOOK_SECRET` in production.
- **Order history by phone** is currently open; gate it behind an OTP sent to the phone
  before going live (see `server/src/routes/bill.js`).
- Serve the client build behind HTTPS and set `CLIENT_URL` so QR/bill links use the real
  public domain.
