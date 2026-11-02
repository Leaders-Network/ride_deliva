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

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy and configure environment variables:

```bash
cp .env.example .env
# Edit .env with your settings
```

**Critical Environment Variables:**
```bash
# Database (Required)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ride_deliva?schema=public"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ride_deliva
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis (Required)  
REDIS_URL="redis://localhost:6379"
REDIS_HOST=localhost
REDIS_PORT=6379

# Application (Required)
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
```

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
npm test             # Jest (4 of 9 suites pass; see docs/progress.md)
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
- **TypeScript**: 0 compiler errors; production build and startup verified

### 🚧 In Progress
- **Test suite**: 5 of 9 Jest suites failing (stale auth expectations, queue/socket fixture compile errors)
- **External Integrations**: Google Maps, FCM, AWS S3, payment gateway, Twilio/SMTP credentials

### ⏳ Planned
- **API Endpoints**: users, drivers, rides, deliveries, payments, notifications, admin (not yet mounted)
- **Comprehensive Testing**: integration tests and CI
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
pg_isready -h localhost -p 5432  # If local install
```

**3. Redis connection failed**
```bash
# Check Redis is running
redis-cli ping  # Should return "PONG"
```

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
- **Current Status**: 85% compliant (113/182 errors fixed)

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

1. **Fix the failing Jest suites**
2. **Implement the ride, delivery, payment and user APIs** (see docs/progress.md, milestones M2-M5)
3. **Connect Flutter mobile apps** (Socket.IO + REST)
4. **Add CI and integration tests**
5. **Production deployment** (Docker + CI/CD)

The backend foundation is solid and ready for rapid feature development!