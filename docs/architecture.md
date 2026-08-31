# Ride Deliva Platform Architecture

## Overview
Ride Deliva is a comprehensive mobility and logistics platform consisting of a Node.js backend API and Flutter mobile applications for customers and drivers.

## System Architecture

### Backend Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flutter Apps  │    │   Admin Panel   │    │  External APIs  │
│  (Customer/     │    │   (Web-based)   │    │  (Payment/SMS/  │
│   Driver)       │    │                 │    │   Maps/etc.)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (Nginx/ALB)   │
                    └─────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                       │                        │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Express.js    │    │   Express.js    │    │   Express.js    │
│   Server 1      │    │   Server 2      │    │   Server N      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                        │
         └────────────────────────┼────────────────────────┘
                                  │
    ┌─────────────────────────────┼─────────────────────────────┐
    │                             │                             │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │    │   File Storage  │
│   Database      │    │   Cache/Queue   │    │   (S3/Local)    │
│   + PostGIS     │    │     Store       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 14+ with PostGIS extension
- **Cache/Queue**: Redis 6+
- **ORM**: Prisma
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO
- **Job Processing**: BullMQ
- **API Documentation**: Swagger/OpenAPI

#### Frontend (Flutter Apps)
- **Framework**: Flutter 3.16+
- **Language**: Dart 3.2+
- **State Management**: BLoC Pattern
- **Navigation**: Flutter Navigator 2.0
- **Maps**: Google Maps Flutter
- **Real-time**: Socket.IO Client
- **HTTP Client**: Dio
- **Local Storage**: Hive/SharedPreferences

#### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose / Kubernetes
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Logging**: Winston + ELK Stack

## Database Schema

### Core Entities
```sql
-- Users (customers and drivers)
Users {
  id: UUID PRIMARY KEY
  phone: VARCHAR UNIQUE
  email: VARCHAR
  first_name: VARCHAR
  last_name: VARCHAR
  user_type: ENUM('customer', 'driver', 'admin')
  status: ENUM('active', 'suspended', 'pending')
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}

-- Driver profiles
DriverProfiles {
  id: UUID PRIMARY KEY
  user_id: UUID FOREIGN KEY
  license_number: VARCHAR
  vehicle_type: VARCHAR
  vehicle_model: VARCHAR
  vehicle_year: INTEGER
  plate_number: VARCHAR
  insurance_details: JSONB
  documents: JSONB
  verification_status: ENUM('pending', 'approved', 'rejected')
}

-- Rides/Deliveries
Orders {
  id: UUID PRIMARY KEY
  customer_id: UUID FOREIGN KEY
  driver_id: UUID FOREIGN KEY
  order_type: ENUM('ride', 'delivery', 'food', 'shopping')
  status: ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled')
  pickup_location: GEOMETRY(POINT, 4326)
  pickup_address: VARCHAR
  destination_location: GEOMETRY(POINT, 4326)
  destination_address: VARCHAR
  fare: DECIMAL
  distance: DECIMAL
  duration: INTEGER
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}

-- Real-time tracking
Locations {
  id: UUID PRIMARY KEY
  user_id: UUID FOREIGN KEY
  order_id: UUID FOREIGN KEY
  location: GEOMETRY(POINT, 4326)
  heading: DECIMAL
  speed: DECIMAL
  recorded_at: TIMESTAMP
}
```

## Service Architecture

### Modular Structure
```
backend/src/
├── modules/
│   ├── auth/           # Authentication & authorization
│   ├── users/          # User management
│   ├── orders/         # Order management (rides/deliveries)
│   ├── drivers/        # Driver-specific functionality
│   ├── payments/       # Payment processing
│   ├── notifications/  # Push notifications & SMS
│   └── tracking/       # Real-time location tracking
├── shared/
│   ├── middleware/     # Common middleware
│   ├── services/       # Shared services
│   ├── utils/          # Utility functions
│   ├── processors/     # Job processors
│   └── validators/     # Input validation
└── config/
    ├── database.ts     # Database configuration
    ├── redis.ts        # Redis configuration
    ├── queues.ts       # Queue configuration
    └── logger.ts       # Logging configuration
```

### Job Queue System (BullMQ)
- **SMS Queue**: OTP sending, notifications
- **Email Queue**: Promotional emails, receipts
- **Notification Queue**: Push notifications
- **Ride Queue**: Ride processing, driver matching
- **Payment Queue**: Payment processing, refunds
- **Delivery Queue**: Delivery processing, tracking

## Flutter App Architecture

### Customer App Structure
```
flutter/customer_app/lib/
├── core/
│   ├── theme/          # App theming (dark theme)
│   ├── constants/      # App constants
│   ├── utils/          # Utility functions
│   └── services/       # Core services
├── data/
│   ├── models/         # Data models
│   ├── repositories/   # Data repositories
│   └── providers/      # Data providers
├── presentation/
│   ├── screens/        # UI screens
│   │   ├── auth/       # Authentication flow
│   │   ├── home/       # Dashboard screens
│   │   ├── ride/       # Ride booking flow
│   │   └── profile/    # User profile
│   ├── widgets/        # Reusable widgets
│   └── bloc/           # State management
└── main.dart
```

### Navigation Flow
```
Splash → Onboarding → Auth → Permissions → Home → Ride Booking → Tracking → Completion
```

## Security Architecture

### Authentication Flow
1. Phone number verification with OTP
2. JWT access token (15 minutes)
3. Refresh token (7 days)
4. Token rotation on refresh

### Authorization
- Role-based access control (customer, driver, admin)
- Route-level permission middleware
- Resource ownership validation

### Data Protection
- Input validation and sanitization
- SQL injection prevention (Prisma ORM)
- Rate limiting (Redis-based)
- CORS configuration
- Helmet.js security headers

## Real-time Features

### WebSocket Events
```javascript
// Customer events
'ride:requested'
'ride:driver_assigned'
'ride:driver_location'
'ride:status_changed'

// Driver events
'ride:new_request'
'ride:customer_location'
'location:update'

// Common events
'notification:received'
'chat:message'
```

## Deployment Architecture

### Development Environment
- Docker Compose setup
- Local PostgreSQL + Redis
- Hot reload for backend and frontend

### Production Environment
- Kubernetes cluster
- Managed PostgreSQL (RDS/Cloud SQL)
- Managed Redis (ElastiCache/MemoryStore)
- CDN for static assets
- Load balancer with SSL termination

## Monitoring and Observability

### Metrics
- API response times
- Database query performance
- Queue processing times
- User activity metrics
- Business KPIs (rides completed, revenue, etc.)

### Logging
- Structured logging (JSON format)
- Request/response logging
- Error tracking with stack traces
- Audit logs for sensitive operations

### Health Checks
- Database connectivity
- Redis connectivity
- External service status
- Queue health
- Memory and CPU usage

## Scalability Considerations

### Horizontal Scaling
- Stateless API servers
- Database read replicas
- Queue workers scaling
- CDN for static content

### Performance Optimization
- Database indexing strategy
- Redis caching layers
- API response compression
- Image optimization
- Lazy loading in mobile apps

### Future Enhancements
- Microservices migration path
- Event-driven architecture
- CQRS implementation
- GraphQL API layer
- Machine learning integration