# Ride Deliva Backend - Development Setup Guide

*Updated: November 2, 2026*

## 🚀 Quick Start

The backend is now **85% TypeScript-compliant** with solid infrastructure. Follow this guide to get up and running.

### Prerequisites

- **Node.js**: 18.x or higher (tested with 24.x)
- **npm**: 8.x or higher  
- **PostgreSQL**: 13.x or higher (with PostGIS extension)
- **Redis**: 6.x or higher

### System Requirements

```bash
# Check versions
node --version    # v18+ required
npm --version     # v8+ required  
psql --version    # PostgreSQL 13+
redis-server --version  # Redis 6+
```

## 📦 Installation & Setup

### 1. Install Dependencies

The repo is an npm workspace (`backend` is the workspace), so install from the **repository root**. The admin web app has its own dependencies.

```bash
npm install                  # root + backend
(cd admin && npm install)    # admin dashboard
```

### 2. Environment Configuration

Copy and configure environment variables:

The template lives at the repository root; the backend reads `backend/.env`:

```bash
cp .env.example backend/.env
# Edit backend/.env with your settings
```

**Critical Environment Variables** (values match the Docker Compose services, which publish Postgres on **5433** and Redis on **6380**):
```bash
# Database (Required)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/ride_deliva"
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_DB=ride_deliva
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis (Required). REDIS_URL takes precedence over REDIS_HOST/PORT.
REDIS_URL="redis://127.0.0.1:6380"
REDIS_HOST=127.0.0.1
REDIS_PORT=6380

# Application (Required)
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
```

> **Windows:** use `127.0.0.1`, not `localhost`. Windows resolves `localhost` to IPv6 (`::1`) first, and Docker Desktop's `::1` port forwarding stalls intermittently, which shows up as "Command timed out" (Redis) or "Can't reach database server" (Prisma) at startup.

**External Services (Optional for Development):**
```bash
# These can remain as placeholders for local development:
GOOGLE_MAPS_API_KEY=placeholder-key
GOOGLE_PLACES_API_KEY=placeholder-key
FCM_SERVER_KEY=placeholder-key
AWS_ACCESS_KEY_ID=placeholder-key
AWS_SECRET_ACCESS_KEY=placeholder-key
```

### 3. Database Setup

#### Option A: Docker (Recommended)

The repository root already contains a `docker-compose.yml` (PostGIS 15-3.4 and Redis 7, with the SQL in `backend/database/init`). From the repository root:

```bash
npm run docker:up      # or: docker-compose up -d
docker-compose ps      # both containers should report healthy
```

#### Option B: Local Installation

**PostgreSQL:**
```bash
# Windows (using chocolatey)
choco install postgresql

# Or download from: https://www.postgresql.org/download/windows/
# Enable PostGIS extension after installation
```

**Redis:**
```bash
# Windows (using chocolatey) 
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

### 4. Database Migration & Seeding

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate

# Seed database with test data
npm run db:seed
```

> ⚠️ With `NODE_ENV=development`, **`db:seed` deletes every row in the target database first**. Only point it at a local or disposable database.

The seed creates the admin, sample customers and drivers, plus the admin-dashboard demo set (`src/database/demo-data.ts`): 24 customers, 15 drivers in mixed statuses (4 pending approval), and two weeks of rides and deliveries with payments, earnings and reviews. It is deterministic, so every run produces the same numbers.

| Account | Phone | Password |
| --- | --- | --- |
| Admin (super admin) | `+2348012345678` | `admin123!@#` |
| Customer | `+2348123456789` | `customer123` |
| Driver | `+2348098765432` | `driver123` |

Login is by phone number + password.

**Verify Database Setup:**
```bash
# Open Prisma Studio to inspect data
npm run db:studio
# Visit http://localhost:5555

# Optional: validate extensions, functions and indexes
npm run db:validate
```

## 🏃‍♂️ Running the Application

### Development Mode (Recommended)

```bash
npm run dev
# Server starts on http://localhost:3000
# Hot reload enabled with tsx watch
```

### Admin Dashboard

From the repository root:

```bash
npm run dev:dashboard   # API on :3000 + admin UI on :3001 (concurrently)
npm run dev:admin       # admin UI only
```

Open http://localhost:3001 and sign in with the seeded admin. Vite proxies `/api` to `http://localhost:3000` (override with `BACKEND_URL`), so no CORS setup is needed in development. If the API is down, the login page says "Cannot reach the API server". See [admin/README.md](../admin/README.md).

### Production Build

```bash
# Build TypeScript
npm run build

# Start production server  
npm run start
```

### Available Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # TypeScript compilation
npm run start        # Production server
npm run typecheck    # tsc --noEmit (currently 0 errors)
npm test             # Unit tests (11 suites, 122 tests; use --runInBand, see testing.md)
npm run test:integration  # *.integration.test.ts; needs PostgreSQL and Redis running
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Create/apply dev migrations (db:migrate:prod to deploy)
npm run db:seed      # Seed database
npm run db:validate  # Check extensions, functions, unique indexes
npm run db:studio    # Prisma Studio GUI
npm run lint         # ESLint checking
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Prettier formatting
```

## 🔍 Monitoring & Development Tools

### Bull Board - Queue Monitoring
- **URL**: http://localhost:3000/admin/queues
- **Purpose**: Monitor background job queues
- **Queues Available**: sms, email, notification, ride, payment, delivery
- **Access**: requires an admin or super-admin JWT (Authorization header or `?token=`)

### Prisma Studio - Database GUI
```bash
npm run db:studio
# Opens http://localhost:5555
```

### Health Check Endpoint
```bash
curl http://localhost:3000/health
# Returns status plus PostgreSQL and Redis checks; also /health/readiness and /health/liveness
```

## 🧪 Testing the Setup

### 1. Health Check
```bash
curl -X GET http://localhost:3000/health
```

Expected: HTTP 200 with `"status": "healthy"`. The endpoint returns 503 if PostgreSQL or Redis is unreachable.

`GET /health/readiness` returns `{"ready": true}` and `GET /health/liveness` returns `{"alive": true}`.

### 2. Authentication Test
```bash
# Register a test user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "email": "test@example.com", "password": "test123"}'
```

### 3. WebSocket Test
- Open browser to http://localhost:3000
- Check browser console for Socket.IO connection logs

### 4. Queue System Test  
- Visit http://localhost:3000/admin/queues
- Sign in with an admin token; you should see Bull Board with 6 queues (sms, email, notification, ride, payment, delivery)

## 📊 Current Implementation Status

### ✅ Working Features
- **Authentication System**: Registration, login, OTP, refresh tokens, sessions
- **Database**: 20 Prisma models, migration and seed data verified
- **Real-time**: Socket.IO server and management endpoints
- **Queue System**: 6 BullMQ queues with workers and authenticated Bull Board
- **Health Monitoring**: Dependency-aware health, readiness, liveness
- **Rides API**: booking, history, driver lifecycle (not yet exercised against a live database)
- **Admin API + dashboard**: drivers, customers, rides, deliveries, payments; verified against live local Postgres and Redis
- **TypeScript**: 0 compiler errors; production build and startup verified; CI on every PR

### 🚧 In Progress
- **Integration tests**: queue and socket suites are now picked up by `test:integration` (its file pattern previously matched nothing) but have not yet completed a run
- **External Integrations**: Google Maps, FCM, AWS S3, payment gateway, Twilio/SMTP credentials

### ⏳ Planned
- **API Endpoints**: driver onboarding, deliveries, payments/wallet, notifications (`users`, `delivery`, `payments` are mounted placeholders)
- **Comprehensive Testing**: integration tests in CI
- **Performance Optimization**: Query optimization, caching
- **Production Deployment**: Docker + CI/CD

## 🐛 Troubleshooting

### Common Issues

**1. "Cannot find module" errors**
```bash
# Regenerate Prisma client
npm run db:generate
```

**2. Database connection failed**
```bash
# Check PostgreSQL is running
docker-compose ps  # If using Docker
# OR
pg_isready -h 127.0.0.1 -p 5433  # Docker Compose port
```
- On Windows, use `127.0.0.1` rather than `localhost` (see the note under Environment Configuration).
- "tenant/user ... not found" from a Supabase URL means that Supabase project is paused or deleted; point `DATABASE_URL` at the local container instead.

**3. Redis connection failed / startup hangs**
```bash
docker exec ride-deliva-redis redis-cli ping  # Should return "PONG"
```
- The startup log names the failing client, e.g. `Failed to connect to Redis (queue client, status=connecting)`.
- If startup prints nothing after `tsx watch src/app.ts`, check `backend/logs/exceptions.log`: crashes during module loading are only written there.

**3b. `Cannot find module 'bullmq'` from `@bull-board`**

`@bull-board` 9.x requires `bullmq` 5.56 or newer. If the backend pins an older `bullmq`, npm can't hoist it next to `@bull-board` and the app crashes on startup. Keep `bullmq` in `backend/package.json` within `@bull-board`'s peer range.

**4. TypeScript compilation errors**
```bash
# Check for type errors (expected: no output)
npm run typecheck
```

**5. Port 3000 already in use**
```bash
# Change PORT in .env file
PORT=3001
```

### Build Issues

**Prisma Client Not Found:**
```bash
rm -rf node_modules
rm -rf src/generated
npm install
npm run db:generate
```

**Module Resolution Problems:**
- Current setup uses CommonJS modules (not NodeNext)
- Prisma client imports use relative paths: `../generated/prisma`

## 🔧 Development Configuration

### TypeScript Configuration
- **Module System**: CommonJS (for compatibility)
- **Target**: ES2020
- **Strict Mode**: Enabled
- **Current Status**: 0 errors (`npm run typecheck`)

### Prisma Configuration  
- **Version**: 5.22.0 (downgraded from 7.x for stability)
- **Generator Location**: `src/generated/prisma`
- **Database**: PostgreSQL with PostGIS extension

### Code Quality Tools
- **ESLint**: Configured for TypeScript + Node.js
- **Prettier**: Automatic code formatting
- **Winston**: Structured logging with file rotation

## 📈 Performance Notes

- **Database**: Connection pooling enabled
- **Caching**: Redis for sessions and frequent queries  
- **Background Jobs**: BullMQ for async processing
- **Real-time**: Socket.IO with room-based messaging
- **Static Files**: Express static middleware for assets

---

## 🎯 Next Steps

1. **Driver onboarding API** (documents, vehicle, availability, location), so drivers can apply and admins can approve them through the API
2. **Delivery and payment/wallet APIs** (see docs/progress.md)
3. **Connect Flutter mobile apps** (Socket.IO + REST)
4. **Run integration suites in CI** with Postgres and Redis service containers
5. **Production deployment** (Docker + CI/CD)