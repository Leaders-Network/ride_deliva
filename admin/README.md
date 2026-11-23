# Ride Deliva Admin

Web console for operating the platform: approve and moderate drivers, manage customers, and monitor rides, deliveries and payments. React + Vite + Tailwind, talking to the real backend at `/api/v1/admin/*`.

## Run

```bash
# from the repo root: backend + admin together
npm run dev:dashboard

# or separately
cd backend && npm run dev     # API on :3000 (needs Postgres + Redis reachable)
cd admin && npm run dev       # UI on http://localhost:3001
```

In dev, Vite proxies `/api` to `http://localhost:3000` (override with `BACKEND_URL`), so no CORS setup is needed. For a deployed build, set `VITE_API_URL` to the API base (for example `https://api.example.com/api/v1`) and add the admin origin to the backend's `CORS_ORIGIN`.

Sign in with an account that has an `AdminProfile`. The seed creates `+2348012345678` / `admin123!@#`.

## What's in the MVP

| Page | What an admin can do |
|---|---|
| Overview | KPIs (revenue, rides, deliveries, drivers), 7-day trip and revenue charts, approval queue. Auto-refreshes every 30s |
| Drivers | Filter by status, search. Detail drawer with vehicle, documents, earnings, trips and reviews. Approve, reject, suspend, reinstate or deactivate. Block or unblock the account |
| Customers | Search, active/blocked filter. Detail with wallet, spend, saved places and trip history. Block or unblock |
| Rides / Deliveries | Filter by status, date range and search. Detail with route, timeline and payment. Cancel active trips |
| Payments | Filter by status, method and date. Totals per status |

Filters and the open detail drawer live in the URL, so any view can be shared as a link.

## Next (not in MVP)

Live driver map (Socket.IO), support tickets, document viewer (needs file storage), granular admin permissions, audit log, pricing/surge settings, driver payouts.
