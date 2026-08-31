# Ride Deliva Development Setup Guide

## Quick Start (Without Paid Services)

### Prerequisites
- **Node.js**: 18.x or higher
- **PostgreSQL**: Local or Docker
- **Redis**: Local or Docker

### Option 1: Docker Setup (Recommended)

1. **Start databases with Docker:**
```bash
# Use the docker-compose.yml in project root
docker-compose up -d
```

2. **Setup backend:**
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Option 2: Native Windows Installation

#### PostgreSQL
1. Download from: https://www.postgresql.org/download/windows/
2. Install with default settings (port 5432)
3. Set password: `postgres`
4. Create database:
   ```sql
   CREATE DATABASE ride_deliva;
   ```

#### Redis  
- **Option A:** Download from https://github.com/microsoftarchive/redis/releases
- **Option B:** Use WSL: `sudo apt install redis-server`
- **Option C:** Redis Cloud free tier: https://redis.com/try-free/

#### Start Backend
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### Option 3: Cloud Free Tiers

**Free Database Options:**
- **Supabase:** https://supabase.com (PostgreSQL)
- **Neon:** https://neon.tech (PostgreSQL) 
- **Redis Cloud:** https://redis.com/try-free/

Update `.env` with cloud URLs and run backend setup.

## Current Environment Configuration

Your `.env` file is configured for:
- ✅ **Database & Redis**: Required and ready
- ✅ **JWT & Basic Auth**: Working
- ✅ **Twilio & Email**: Real credentials configured
- ✅ **Stripe & Paystack**: Real test keys configured  
- ⚠️ **Google Maps, FCM, AWS**: Placeholder values (safely disabled)

## Test Your Setup

Once PostgreSQL and Redis are running:

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/

# Test registration  
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","role":"customer"}'

# Queue dashboard (admin:admin)
# Visit: http://localhost:3000/admin/queues
```

## Available Features (No External APIs Needed)

- ✅ **Authentication**: Register, login, JWT tokens
- ✅ **Socket.IO**: Real-time connections  
- ✅ **Queue System**: Background job processing
- ✅ **Database**: PostgreSQL with Prisma
- ✅ **Caching**: Redis for sessions/cache
- ✅ **API Documentation**: Auto-generated endpoints
- ✅ **Health Monitoring**: System status checks

## Disabled Features (Until APIs Added)

- ❌ **Location Services**: Google Maps API needed
- ❌ **Push Notifications**: FCM credentials needed
- ❌ **File Uploads**: AWS S3 credentials needed
- ❌ **Stripe Webhooks**: Webhook secret needed

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
# Windows: Check Services or Task Manager
# Docker: docker-compose ps

# Test connection
psql -h localhost -p 5432 -U postgres -d ride_deliva
```

### Redis Connection Issues  
```bash
# Check if Redis is running
# Docker: docker-compose ps
# Windows: Check Services

# Test Redis
redis-cli ping
# Should return: PONG
```

### Port Conflicts
```bash
# If port 3000 is busy, change in .env:
PORT=3001

# Or find what's using port 3000:
netstat -ano | findstr :3000
```

## Next Steps After Basic Setup

1. ✅ **Get basic server running**
2. ✅ **Test all auth endpoints**  
3. ✅ **Verify Socket.IO connections**
4. ✅ **Check queue dashboard works**
5. 🔄 **Test Flutter apps connection**
6. 🔄 **Add Google Maps when ready for location**
7. 🔄 **Add FCM when ready for notifications**
8. 🔄 **Configure AWS when ready for uploads**

## Docker Compose Services

The included `docker-compose.yml` provides:
- **PostgreSQL 15**: Database on port 5432
- **Redis 7**: Cache/sessions on port 6379  
- **Persistent volumes**: Data survives container restarts
- **Initialization scripts**: Auto-runs database setup

---

# Full Production Setup (Later)

## Prerequisites

### System Requirements
- **Node.js**: 18.x or higher
- **npm/yarn**: Latest version
- **Docker**: 20.x or higher
- **Docker Compose**: 2.x or higher
- **Flutter**: 3.16.x or higher
- **Dart**: 3.2.x or higher
- **Git**: Latest version

### Required Accounts & API Keys
- **Google Maps API**: For mapping and geocoding
- **Firebase**: For push notifications
- **SMS Provider**: Twilio/AWS SNS for OTP
- **Email Provider**: SendGrid/Mailgun for emails
- **Payment Gateway**: Stripe/Flutterwave (Nigeria)

## Quick Start (5 Minutes)

### 1. Clone and Setup
```bash
# Clone repository
git clone <repository-url>
cd Ride_Deliva

# Setup environment files
cp backend/.env.example backend/.env
cp flutter/customer_app/.env.example flutter/customer_app/.env

# Start services with Docker
docker-compose up -d
```

### 2. Initialize Database
```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Run database migrations
npm run migrate

# Seed database with sample data
npm run seed
```

### 3. Start Backend Server
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run start
```

### 4. Start Flutter Customer App
```bash
# Navigate to Flutter customer app
cd flutter/customer_app

# Install dependencies
flutter pub get

# Start on emulator/device
flutter run
```

### 5. Start Flutter Driver App (Optional)
```bash
# Navigate to Flutter driver app
cd flutter/driver_app

# Install dependencies
flutter pub get

# Start on emulator/device
flutter run
```

### 6. Verify Installation
- **Backend API**: http://localhost:3000
- **Queue Dashboard**: http://localhost:3000/admin/queues
- **Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/docs

## Detailed Setup Instructions

### Backend Configuration

#### Environment Variables (.env)
```env
# Server Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/ride_deliva
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# External Services
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@ridedeliva.com

GOOGLE_MAPS_API_KEY=your-google-maps-key

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Queue Configuration
QUEUE_DASHBOARD_USERNAME=admin
QUEUE_DASHBOARD_PASSWORD=admin123
```

#### Database Setup
```bash
# Using Docker (Recommended)
docker-compose up -d postgres redis

# Or install locally
# PostgreSQL with PostGIS
sudo apt-get install postgresql postgresql-contrib postgis

# Create database
createdb ride_deliva
psql -d ride_deliva -c "CREATE EXTENSION postgis;"

# Redis
sudo apt-get install redis-server
```

#### Running Migrations
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Reset database (development only)
npx prisma migrate reset
```

### Flutter App Configuration

#### pubspec.yaml Dependencies
```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  flutter_bloc: ^8.1.3
  
  # Networking
  dio: ^5.3.2
  socket_io_client: ^2.0.3+1
  
  # Maps & Location
  google_maps_flutter: ^2.5.0
  geolocator: ^10.1.0
  geocoding: ^2.1.1
  
  # UI & Animations
  flutter_animate: ^4.2.0+1
  flutter_svg: ^2.0.9
  cached_network_image: ^3.3.0
  
  # Storage & Persistence
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  shared_preferences: ^2.2.2
  
  # Permissions
  permission_handler: ^11.0.1
  
  # Utils
  intl: ^0.18.1
  uuid: ^4.1.0
```

#### Android Configuration (android/app/build.gradle)
```gradle
android {
    compileSdkVersion 34
    ndkVersion flutter.ndkVersion

    defaultConfig {
        applicationId "com.ridedeliva.customer"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
        multiDexEnabled true
    }
}

dependencies {
    implementation 'androidx.multidex:multidex:2.0.1'
}
```

#### iOS Configuration (ios/Runner/Info.plist)
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to provide ride booking services</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track rides in real-time</string>
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to capture profile pictures</string>
```

### API Keys Setup

#### Google Maps API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Places API
   - Geocoding API
   - Directions API
4. Create API key with restrictions
5. Add key to environment files

#### Firebase Setup
1. Create Firebase project
2. Add Android/iOS apps
3. Download configuration files:
   - `google-services.json` → `android/app/`
   - `GoogleService-Info.plist` → `ios/Runner/`
4. Enable Firebase Cloud Messaging

## Development Workflow

### Backend Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check code formatting
npm run lint

# Fix formatting issues
npm run lint:fix

# Build for production
npm run build
```

### Flutter Development
```bash
# Customer App
cd flutter/customer_app

# Get dependencies
flutter pub get

# Run on specific device
flutter run -d <device-id>

# Driver App  
cd flutter/driver_app

# Get dependencies
flutter pub get

# Run on specific device
flutter run -d <device-id>

# Build APK (both apps)
flutter build apk

# Build iOS (both apps)
flutter build ios

# Run tests
flutter test

# Analyze code
flutter analyze
```

### Database Operations
```bash
# Create new migration
npx prisma migrate dev --name migration-name

# Apply migrations
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio
```

### Docker Operations
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down

# Rebuild services
docker-compose up --build

# Clean up
docker-compose down -v --remove-orphans
```

## Testing Setup

### Backend Testing
```bash
# Install test dependencies
npm install --save-dev jest supertest @types/jest

# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### Flutter Testing
```bash
# Run all tests
flutter test

# Run specific test file
flutter test test/widget_test.dart

# Run integration tests
flutter drive --target=test_driver/app.dart
```

## Debugging & Troubleshooting

### Common Issues

#### Backend Issues
1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify DATABASE_URL in .env
   - Ensure database exists

2. **Redis Connection Error**
   - Check Redis server status
   - Verify REDIS_URL in .env
   - Check Redis authentication

3. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :3000
   
   # Kill process
   kill -9 <PID>
   ```

#### Flutter Issues
1. **Flutter Doctor Issues**
   ```bash
   flutter doctor
   flutter doctor --android-licenses
   ```

2. **Gradle Build Failed**
   - Clean project: `flutter clean`
   - Delete build folder
   - Run `flutter pub get`

3. **iOS Build Issues**
   - Update CocoaPods: `pod repo update`
   - Clean iOS build: `cd ios && rm -rf Pods && pod install`

### Debug Tools
- **Backend**: Node.js debugger, Postman, Prisma Studio
- **Flutter**: Flutter Inspector, Dart DevTools
- **Database**: pgAdmin, DBeaver
- **Queue**: Bull Dashboard (http://localhost:3000/admin/queues)
- **Logs**: Docker logs, application logs

## Performance Optimization

### Backend Optimization
- Enable compression middleware
- Implement Redis caching
- Optimize database queries
- Use connection pooling
- Enable gzip compression

### Flutter Optimization
- Use const constructors
- Implement lazy loading
- Optimize images
- Use cached network images
- Profile widget rebuilds

## Security Checklist

### Backend Security
- [x] JWT authentication implemented
- [x] Input validation with Joi
- [x] Rate limiting configured
- [x] CORS properly set
- [x] Helmet security headers
- [ ] API versioning
- [ ] SQL injection prevention audit
- [ ] Security headers audit

### Flutter Security
- [x] Secure storage for tokens
- [x] API endpoint validation
- [ ] Certificate pinning
- [ ] Obfuscation for production
- [ ] Secure HTTP only

## Production Deployment

### Backend Deployment Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Load balancer configured

### Flutter Deployment Checklist
- [ ] Release build optimization
- [ ] App store assets prepared
- [ ] App signing configured
- [ ] Privacy policy added
- [ ] Terms of service added
- [ ] App store descriptions written

## Support & Resources

### Documentation
- [Backend API Documentation](./api-reference.md)
- [Flutter App Guide](./flutter-guide.md)
- [Database Schema](./database-schema.md)
- [Deployment Guide](./deployment.md)

### Useful Commands
```bash
# Quick health check
curl http://localhost:3000/health

# Test authentication
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"+2348012345678","firstName":"Test","lastName":"User"}'

# Check Flutter devices
flutter devices

# Flutter app info
flutter --version
```

### Getting Help
- Check existing GitHub issues
- Review error logs in detail
- Use debugging tools
- Consult official documentation
- Join Flutter/Node.js communities