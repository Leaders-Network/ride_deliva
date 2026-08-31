# Ride Deliva Platform

A comprehensive mobility and logistics platform built with modular monolith architecture.

## Architecture Overview

- **Backend**: Node.js + TypeScript + Express.js (Modular Monolith)
- **Database**: PostgreSQL + PostGIS for geospatial data
- **Cache**: Redis for session management and job queuing
- **Mobile Apps**: Separate Flutter apps for customers and drivers
- **Real-time**: Socket.IO for live tracking and updates
- **Queue**: BullMQ for background job processing

## Project Structure

```
ride-deliva/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── modules/        # Feature modules (auth, rides, delivery, etc.)
│   │   ├── shared/         # Shared utilities and services
│   │   ├── config/         # Configuration files
│   │   └── app.ts          # Express app setup
│   ├── prisma/             # Database schema and migrations
│   └── package.json
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
   ```

2. **Start infrastructure services:**
   ```bash
   npm run docker:up
   ```

3. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

This will start:
- Backend API server on http://localhost:3000
- Customer Flutter app (requires device/emulator)
- Driver Flutter app (requires device/emulator)

### Individual Services

- **Backend only**: `npm run dev:backend`
- **Customer app only**: `npm run dev:customer`  
- **Driver app only**: `npm run dev:driver`

## Features

### Core Platform
- [x] Project structure and development environment
- [ ] PostgreSQL + PostGIS + Redis infrastructure
- [ ] Authentication and authorization
- [ ] Real-time communication
- [ ] Job queue system

### Customer Experience
- [ ] Onboarding and verification
- [ ] Home dashboard
- [ ] Ride booking
- [ ] Live tracking
- [ ] Payments and wallet

### Driver Experience  
- [ ] Driver onboarding
- [ ] Trip management
- [ ] Earnings tracking
- [ ] Vehicle management

### Business Operations
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] Fleet management
- [ ] Financial operations

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
- **CI/CD**: GitHub Actions (planned)
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