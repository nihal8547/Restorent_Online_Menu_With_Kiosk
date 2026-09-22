# 🍽️ Enikk Vendya — Restaurant Online Menu + CRM + Kiosk

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

`POST /api/webhooks/keeta|snoonu|talabat` accepts a normalised payload and creates a
delivery order in the same kitchen/billing pipeline. Requests must carry
`x-webhook-secret: <PLATFORM_WEBHOOK_SECRET>`, and duplicate `externalId`s are ignored
(idempotent). Map each platform's real payload shape to this normalised body in
`server/src/routes/webhooks.js`.

## Security notes / production checklist

- Prices are always taken from the database — client-supplied prices are ignored.
- Change `JWT_SECRET` and `PLATFORM_WEBHOOK_SECRET` in production.
- **Order history by phone** is currently open; gate it behind an OTP sent to the phone
  before going live (see `server/src/routes/bill.js`).
- Serve the client build behind HTTPS and set `CLIENT_URL` so QR/bill links use the real
  public domain.
