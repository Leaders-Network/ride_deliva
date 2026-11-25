# Payments API

Trip payments, wallet top-ups, the wallet ledger, driver earnings and payouts, admin payment
settings, and the Paystack / MTN MoMo webhooks.

The runnable contract lives in [`postman/collections/Ride Deliva Payments API`](../postman/collections/Ride%20Deliva%20Payments%20API)
(requests, assertions and saved examples). This page summarises it; if the two disagree, the
collection's assertions are what the API was verified against.

- Base URL: `http://localhost:3000/api/v1` locally (`API_PREFIX`).
- Auth: `Authorization: Bearer <accessToken>` from `POST /auth/login`.
- Providers: Paystack (card, bank transfer, payouts), MTN MoMo Collections (mobile money).

## Conventions

**Success**

```json
{ "success": true, "message": "Payment retrieved", "data": { }, "meta": { }, "timestamp": "2026-11-25T09:00:00.000Z" }
```

Lists add `meta: { page, limit, total, totalPages, hasNext, hasPrev }`. Query `page` >= 1 (default 1),
`limit` 1..100 (default 20).

**Error**

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Validation failed", "statusCode": 422,
  "details": [{ "field": "amount", "message": "amount must be greater than or equal to 100", "value": 50 }],
  "path": "/api/v1/payments/wallet/top-up", "requestId": "..." } }
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Business rule refused (cash trip, insufficient wallet balance, unverifiable account) |
| 401 | `UNAUTHORIZED` | Missing, malformed or expired token |
| 403 | `FORBIDDEN` | Wrong role, unverified account, or unapproved driver |
| 404 | `NOT_FOUND` | Does not exist **or is not yours**. The two cases look the same on purpose |
| 409 | `CONFLICT` | Trip cancelled or already paid, MoMo prompt still open, payout not retryable |
| 422 | `VALIDATION_ERROR` | Body, query or path failed validation. Unknown body keys are silently stripped |
| 429 | `TOO_MANY_BOOKING_ATTEMPTS` | Booking limiter (see below) |
| 503 | `SERVICE_UNAVAILABLE` | Provider not configured or not responding. **Retryable** |

**Money** is a decimal string in naira: `"2300"`, `"1500.50"`. Parse it as a decimal, not a float.

**Rate limit.** `POST /payments/initialize`, `POST /payments/wallet/top-up` and `PUT /payments/payout-account`
share one per-user budget of **10 requests per 10 minutes** with ride and delivery booking.

## Enums

| Enum | Values |
| --- | --- |
| Payment `status` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED` |
| Payment `method` | `WALLET`, `CARD`, `BANK_TRANSFER`, `MOBILE_MONEY`, `CASH` (cash is recorded, never collected here) |
| Payment `provider` | `PAYSTACK`, `MOMO`, `INTERNAL` (wallet or cash), or `null` before the first attempt |
| Payment `purpose` | `TRIP`, `WALLET_TOP_UP` |
| Transaction `type` | `CREDIT`, `DEBIT`, `REFUND`, `COMMISSION`, `BONUS`, `PENALTY` |
| Payout `status` | `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REVERSED` |
| Payout account `type` | `BANK` (10-digit NUBAN + `bankCode`), `MOMO_PSB` (MTN number, no `bankCode`) |

## Payment object

Returned by every payment endpoint. Gateway payloads, provider references, the payer phone and the
user id are never exposed.

```json
{
  "id": "9b2f6d0e-3c1a-4e8b-a5d2-7f1e0c9b4a11", "purpose": "TRIP",
  "rideId": "2a7c9e4b-1d3f-4a6e-8b0c-5d2e7f9a1b33", "deliveryId": null,
  "amount": "2300", "currency": "NGN", "method": "CARD", "provider": "PAYSTACK", "status": "PROCESSING",
  "reference": "PAY-9b2f6d0e-3c1a-4e8b-a5d2-7f1e0c9b4a11-MI2K9X1A", "channel": null,
  "cashbackAmount": "0", "failureReason": null, "paidAt": null, "refundedAt": null,
  "createdAt": "2026-11-25T09:00:00.000Z", "updatedAt": "2026-11-25T09:00:00.000Z"
}
```

## Paying for a trip

```
App                         API                                Provider
 | POST /payments/initialize  |                                   |
 |--------------------------->| record attempt (PROCESSING)       |
 |                            |---------------------------------->| Paystack checkout / MoMo prompt
 |<---------------------------| { payment, next }                 |
 | open checkout / wait       |                                   |
 | GET /payments/:id (poll)   |<---- webhook (verified) ----------|
 |--------------------------->| re-check status API, settle       |
 |<---------------------------| status COMPLETED / FAILED         |
```

The client never marks a payment paid. A payment settles only after an authenticated status check
with the provider, triggered by a webhook, by polling `GET /payments/:id`, or by reconciliation.

### `POST /payments/initialize`

Customer. Rate-limited. Starts or retries payment for a ride or delivery the customer owns.

| Field | Required | Notes |
| --- | --- | --- |
| `rideId` / `deliveryId` | exactly one | UUID v4 |
| `method` | no | `WALLET`, `CARD`, `BANK_TRANSFER`, `MOBILE_MONEY`. Defaults to the booking method. Changing it updates the trip |

`201` with `{ payment, next }`. `next` tells the app what to do:

| `next.type` | Fields | Method |
| --- | --- | --- |
| `redirect` | `authorizationUrl`, `accessCode` | `CARD`, `BANK_TRANSFER`: open Paystack checkout |
| `approve_on_phone` | `phoneNumber`, `expiresInMinutes` | `MOBILE_MONEY`: the prompt goes to the account's own verified number |
| `none` | | `WALLET` (debited at once) or already settled |

Behaviour:

- Calling again while a card checkout is open reuses the **same payment** with a new attempt `reference`.
  Before it starts the new attempt, it checks whether the earlier one succeeded.
- A MoMo prompt that is still open returns `409` until `MOMO_REQUEST_TIMEOUT_MINUTES` (default 5) passes.
- `400`: the trip's method is cash. `404`: the trip is unknown or not yours. `409`: the trip was cancelled or is already paid.
- `503`: the provider is not configured or not responding. Safe to retry.

### `GET /payments/:id`

Any verified user. You get only your own payments; an admin can read any payment. Poll this while
checkout or the prompt is open. A `PROCESSING` payment older than 3 s is re-checked with the provider
when read.

### `GET /payments`

Your payments, newest first, paginated.

## Wallet

Customers and drivers each have one NGN wallet. Every balance change writes a ledger transaction with
a unique reference in the same database transaction. The balance always equals the sum of the entries,
and a retried operation never applies twice.

| Endpoint | Role | Notes |
| --- | --- | --- |
| `GET /payments/wallet` | customer, driver | `{ id, balance, currency, isActive, updatedAt }`. If you have never transacted, `id` is `null` and `balance` is `"0"`. Admins get `403` |
| `GET /payments/wallet/transactions` | customer, driver | Paginated `{ id, type, amount, currency, status, description, reference, createdAt }` |
| `POST /payments/wallet/top-up` | customer, rate-limited | `{ amount, method }`. `amount` is 100 .. 500,000 with up to 2 decimals. `method` is `CARD`, `BANK_TRANSFER` or `MOBILE_MONEY`. Returns `201 { payment, next }` like initialize, with `purpose: WALLET_TOP_UP` |

Starting a top-up credits nothing. The wallet is credited only after the provider confirms the payment.

## Driver earnings and payouts

Approved drivers only (`403` otherwise). Net earnings (fare minus commission) accrue in the driver
wallet. On a schedule (`PAYOUT_CRON`, default Mondays 06:00), every balance at or above
`payoutMinimum` is paid to the driver's payout account through a Paystack transfer.

| Endpoint | Notes |
| --- | --- |
| `GET /payments/earnings` | `{ balance, currency, trips, gross, commission, net, payoutMinimum, payoutSchedule, payoutAccount, lastPayout }`, where `net = gross - commission` |
| `GET /payments/banks` | `[{ name, code }]` from Paystack, cached |
| `GET /payments/payout-account` | The account, or `null`. The Paystack recipient code is never returned |
| `PUT /payments/payout-account` | Rate-limited. `{ type: "BANK", accountNumber: "<10 digits>", bankCode }` or `{ type: "MOMO_PSB", accountNumber: "<MTN number>" }`. The account name is resolved from the bank, not taken from the driver. `400` if the bank refuses the account. `503` if verification is unavailable |
| `GET /payments/payouts` | Paginated payout history |

When a payout is created, its money leaves the wallet immediately. If the transfer fails or is
reversed, the wallet is re-credited. An unknown outcome (a timeout) stays `PROCESSING` until a webhook
or reconciliation resolves it. It is never assumed failed, which could pay the driver twice.

## Admin

`ADMIN` or `SUPER_ADMIN`.

| Endpoint | Notes |
| --- | --- |
| `GET /payments/admin/settings` | `{ commissionRate, momoCashbackEnabled, momoCashbackRate, momoCashbackCap, momoCashbackMinFare, payoutMinimum, updatedBy, updatedAt }` |
| `PUT /payments/admin/settings` | Partial update, at least one field. Limits: `commissionRate` 0..0.5, `momoCashbackRate` 0..0.2, `momoCashbackCap` 0..100,000, `momoCashbackMinFare` and `payoutMinimum` 0..1,000,000. Records `updatedBy` |
| `GET /payments/admin/payouts` | Paginated. Filters: `status`, `batchKey`. Rows include the driver's name and phone |
| `POST /payments/admin/payouts/run` | `{ batchKey?: "YYYY-MM-DD" }` (default today). Returns `{ batchKey, eligible, created, paid, processing, failed, skipped }`. Idempotent per batch. **Sends real transfers** with the configured Paystack key |
| `POST /payments/admin/payouts/:id/retry` | Only `FAILED` or `REVERSED` payouts. `404` unknown, `409` otherwise |
| `POST /payments/admin/reconcile` | Re-checks stale `PROCESSING` payments (> 2 min old) and payouts. Returns `{ payments: { checked, settled }, payouts: { checked } }`. Also runs on a schedule |

## Webhooks

Unauthenticated routes. Each handler authenticates its caller, and the raw body is preserved for
signature checks.

**`POST /webhooks/paystack`**

- The `x-paystack-signature` header must be the hex HMAC-SHA512 of the raw body, keyed with `PAYSTACK_SECRET_KEY`.
- `401 { error: "Invalid signature" }` if the signature is wrong. `400` if a correctly signed body is not valid JSON.
- Events are de-duplicated on `(provider, "<event>:<reference>")`.
  A first delivery returns `200 { received: true }`. A redelivery returns `200 { received: true, duplicate: true }`.
- `charge.success` is re-verified with Paystack's API before anything settles. `transfer.*` events update payouts.
- A `500` makes Paystack retry the delivery later.

**`PUT|POST /webhooks/momo/:referenceId/:signature`**

- The path carries an HMAC of `referenceId`, keyed with `MOMO_CALLBACK_SECRET`.
- An invalid path, or no secret configured, returns a bare `404`. With `MOMO_CALLBACK_IPS` set, other source IPs get `403`.
- The callback is acknowledged with `200` at once. The body is never trusted: the MoMo status API decides the outcome.
  If processing fails, reconciliation settles the payment later.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Card, transfer, bank list, payouts, webhook signature. Without it those endpoints return `503` |
| `PAYSTACK_CALLBACK_URL` | Where checkout sends the customer afterwards |
| `MOMO_COLLECTION_SUBSCRIPTION_KEY`, `MOMO_API_USER`, `MOMO_API_KEY` | MoMo collections. Without them `MOBILE_MONEY` returns `503` |
| `MOMO_BASE_URL`, `MOMO_TARGET_ENVIRONMENT`, `MOMO_CURRENCY` | Sandbox by default. The sandbox only accepts EUR |
| `MOMO_CALLBACK_SECRET`, `MOMO_CALLBACK_IPS` | Callback path signing and the optional IP allowlist |
| `PUBLIC_API_URL` | Public base URL for MoMo callbacks. Without it, or without the callback secret, MoMo payments settle only by polling and reconciliation |
| `PAYOUT_CRON` | Payout batch schedule (default `0 6 * * 1`) |

## Running the collection

Start Postgres and Redis (`docker compose up -d postgres redis`), apply migrations, seed the data,
and run `npm run dev`. Then, from `backend/`:

```bash
postman collection run "postman/collections/Ride Deliva Payments API" \
  -e postman/environments/Local.environment.yaml \
  --env-var "paystackSecretKey=$(grep -E '^PAYSTACK_SECRET_KEY=' .env | cut -d= -f2-)"
```

- The folders chain tokens and ids, so run the whole collection in order.
- Run it at most once per 10 minutes, or restart the server. Each run spends 7 of the seeded customer's 10 rate-limited calls.
- Without `paystackSecretKey`, the three signed webhook tests are skipped.
- Each run books and then cancels a ride, opens two Paystack test checkouts, briefly changes `commissionRate` and restores it, and runs a payout batch.
