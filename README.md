# Ride Deliva Platform

A comprehensive mobility and logistics platform built with modular monolith architecture.

## Architecture Overview

- **Backend**: Node.js + TypeScript + Express.js (Modular Monolith)
- **Database**: PostgreSQL + PostGIS for geospatial data
- **Cache**: Redis for session management and job queuing
- **Mobile Apps**: Separate Flutter apps for customers and drivers
- **Admin Dashboard**: React + Vite web app for operations staff
- **Real-time**: Socket.IO for live tracking and updates
- **Queue**: BullMQ for background job processing

## Project Structure

```
ride-deliva/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── modules/        # Feature modules (auth, rides, admin, delivery, etc.)
│   │   ├── shared/         # Shared utilities and services
│   │   ├── config/         # Configuration files
│   │   ├── database/       # Seed script and admin demo data
│   │   └── app.ts          # Express app setup
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── admin/                  # Admin dashboard (React + Vite + Tailwind)
├── flutter/
│   ├── customer_app/       # Customer mobile app
│   └── driver_app/         # Driver mobile app
├── docs/                   # Documentation
├── ui_ref/                 # UI reference images
├── docker-compose.yml      # Development infrastructure
└── package.json           # Root workspace configuration
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Flutter SDK 3.16+
- Docker and Docker Compose
- PostgreSQL (via Docker)
- Redis (via Docker)

### Development Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   (cd admin && npm install)
   ```

2. **Configure the backend:**
   ```bash
   cp .env.example backend/.env
   ```
   The template already points at the Docker services (Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`). Details in [docs/startup.md](docs/startup.md).

3. **Start infrastructure services:**
   ```bash
   npm run docker:up
   ```

4. **Run database migrations and seed demo data:**
   ```bash
   npm run db:migrate
   npm run db:seed   # ⚠️ wipes the target database first in development
   ```

5. **Run the API and admin dashboard:**
   ```bash
   npm run dev:dashboard
   ```
   API on http://localhost:3000, admin dashboard on http://localhost:3001. Sign in with `+2348012345678` / `admin123!@#`.

6. **Or start everything, including the Flutter apps:**
   ```bash
   npm run dev
   ```

This will start:
- Backend API server on http://localhost:3000
- Customer Flutter app (requires device/emulator)
- Driver Flutter app (requires device/emulator)

### Individual Services

- **Backend only**: `npm run dev:backend`
- **Admin dashboard only**: `npm run dev:admin` (needs the backend running)
- **Customer app only**: `npm run dev:customer`  
- **Driver app only**: `npm run dev:driver`

## Features

Status as of November 23, 2026. See [docs/progress.md](docs/progress.md) for the detailed backend breakdown.

### Core Platform (backend)
- [x] Project structure and development environment
- [x] PostgreSQL + PostGIS + Redis infrastructure (Docker Compose; verified)
- [x] Authentication and sessions (implemented; HTTP contract tests pass)
- [x] Real-time communication (Socket.IO; location persistence pending)
- [x] Job queue system (6 BullMQ queues + Bull Board; payment and push providers are mocked)
- [x] Unit test suite (122 tests) and CI on every PR (typecheck, tests, build)
- [ ] Integration suites in CI

### Customer Experience
- [x] Onboarding, login and OTP screens (UI only)
- [x] Home dashboard, ride booking and tracking screens (UI only)
- [x] Backend ride booking API (fare estimate, booking, history, cancel)
- [ ] Payments and wallet

### Driver Experience
- [x] Onboarding, document verification and dashboard screens (UI only)
- [x] Trip management API (accept, arriving, arrived, start, complete)
- [ ] Driver onboarding API (documents, vehicle, availability)
- [ ] Earnings tracking

### Business Operations (admin dashboard, [admin/](admin/))
- [x] Overview: revenue, trips, driver fleet, 7-day trends, approval queue
- [x] Driver moderation: approve, reject, suspend, reinstate, block
- [x] Customer management: profile, wallet, trip history, block/unblock
- [x] Rides, deliveries and payments: filter, inspect, cancel active trips
- [ ] Live driver map, support tickets, document viewer, audit log, payouts

Neither mobile app is connected to the backend yet. The delivery and payment REST APIs are placeholders. The admin dashboard reads deliveries and payments directly from the database (seeded demo data).

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL + PostGIS
- **Cache**: Redis
- **Queue**: BullMQ
- **Real-time**: Socket.IO
- **Auth**: JWT + bcrypt

### Admin Dashboard
- **Framework**: React 18 + TypeScript, Vite
- **Styling**: Tailwind CSS 4
- **Data**: TanStack Query, React Router
- **Charts**: Recharts

### Mobile Apps
- **Framework**: Flutter 3.16+
- **Language**: Dart
- **State Management**: Bloc/Cubit
- **Navigation**: GoRouter
- **Maps**: Google Maps
- **HTTP**: Dio
- **Real-time**: Socket.IO Client

### Infrastructure
- **Containerization**: Docker
- **Development**: Docker Compose
- **CI/CD**: GitHub Actions (backend typecheck, tests and build on PRs); deployment planned
- **Deployment**: AWS/GCP (planned)

## Development Guidelines

### Code Organization
- Feature-based modules in backend
- Shared utilities and services
- Consistent naming conventions
- Comprehensive error handling

### Database Design
- Proper indexing for geospatial queries
- Normalized schema with appropriate relationships
- Audit trails for critical operations
- Data validation at multiple levels

### API Design
- RESTful endpoints with clear documentation
- Consistent response formats
- Proper HTTP status codes
- Input validation and sanitization

### Mobile Development
- Responsive design for multiple screen sizes
- Offline capability where appropriate
- Proper state management
- Native performance optimization

## Contributing

Please read our contributing guidelines and code of conduct before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.