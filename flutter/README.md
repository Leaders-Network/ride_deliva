# Ride Deliva Flutter Applications

This directory contains the Flutter mobile applications for the Ride Deliva platform.

## 📱 Applications

### Customer App (`customer_app/`)
- **Purpose**: Customer-facing ride booking and management
- **Features**: Ride booking, real-time tracking, payments, trip history
- **Status**: ✅ Foundation Complete (UI implementation ready for backend integration)

### Driver App (`driver_app/`)
- **Purpose**: Driver-facing trip management and earnings tracking
- **Features**: Trip acceptance, navigation, earnings dashboard, status management
- **Status**: ✅ Foundation Complete (Core screens and flows implemented)

## 🏗️ Architecture

Both apps follow **Clean Architecture** principles:

```
lib/
├── core/                 # Shared utilities and configurations
│   ├── constants/       # App constants and configuration
│   ├── theme/          # UI theme and styling
│   ├── utils/          # Helper utilities
│   └── services/       # Core services
├── data/               # Data layer
│   ├── models/         # Data models
│   ├── repositories/   # Repository implementations
│   └── providers/      # Data providers (API, local storage)
├── presentation/       # Presentation layer
│   ├── screens/        # UI screens
│   ├── widgets/        # Reusable widgets
│   └── blocs/          # State management (BLoC pattern)
└── main.dart          # App entry point
```

## 🎨 Design System

### Customer App Theme
- **Primary**: Blue (#2196F3) - for ride-related actions
- **Accent**: Teal (#2DD4BF) - for success states
- **Background**: Dark theme with card-based layout
- **Focus**: User-friendly ride booking and tracking

### Driver App Theme
- **Primary**: Green (#10B981) - for online status and earnings
- **Secondary**: Blue (#2196F3) - for trips and navigation
- **Background**: Dark theme optimized for outdoor visibility
- **Focus**: Status management and earnings tracking

## 🚀 Quick Start

### Prerequisites
- Flutter SDK 3.16+
- Dart 3.2+
- Android Studio / VS Code
- Device or emulator for testing

### Customer App Setup
```bash
cd customer_app
flutter pub get
flutter run
```

### Driver App Setup
```bash
cd driver_app
flutter pub get
flutter run
```

## 📋 Key Features Implemented

### Customer App Features ✅
- **Onboarding & Authentication**
  - Splash screen with branding
  - Multi-step onboarding
  - Phone verification with OTP
  - Permission management (location, camera, notifications)

- **Home Dashboard**
  - Wallet balance display
  - Quick actions (ride booking, food delivery, etc.)
  - Live activity tracking
  - Bottom navigation

- **Ride Booking System**
  - Google Maps integration
  - Location search and selection
  - Vehicle type selection with pricing
  - Real-time tracking interface
  - Trip completion flow

### Driver App Features ✅
- **Driver Onboarding**
  - Driver-focused onboarding flow
  - Document verification system
  - Registration with requirements checklist

- **Status Management**
  - Online/Offline status toggle
  - Visual status indicators
  - Break and availability controls

- **Dashboard & Analytics**
  - Earnings summary with daily totals
  - Performance metrics (trips, rating, online time)
  - Quick actions (earnings, history, settings)
  - Active trips management

- **Navigation & Flow**
  - Driver-focused bottom navigation
  - Status-aware UI updates
  - Smooth animations and transitions

## 🔧 Dependencies

### Core Dependencies (Both Apps)
```yaml
# State Management
flutter_bloc: ^8.1.3
equitable: ^2.0.5

# UI & Animations  
flutter_animate: ^4.2.0+1
flutter_svg: ^2.0.9
cached_network_image: ^3.3.0

# Networking
dio: ^5.3.2
socket_io_client: ^2.0.3+1

# Maps & Location
google_maps_flutter: ^2.5.0
geolocator: ^10.1.0
location: ^5.0.3

# Storage
hive_flutter: ^1.1.0
shared_preferences: ^2.2.2
secure_storage: ^3.0.5

# Permissions
permission_handler: ^11.0.1
```

### Driver App Specific
```yaml
# Background Services
flutter_background_service: ^5.0.5
workmanager: ^0.5.1

# Analytics & Charts
fl_chart: ^0.65.0

# Camera & QR
qr_code_scanner: ^1.0.1

# Audio for notifications
audioplayers: ^5.2.1
```

## 🎯 Next Implementation Steps

### Phase 1: Backend Integration
1. **BLoC State Management**
   - Implement authentication BLoC
   - Add location services BLoC
   - Create ride management BLoC
   - Build earnings tracking BLoC

2. **API Integration**
   - Connect authentication flows
   - Integrate real-time socket connections
   - Implement ride booking APIs
   - Add payment processing

### Phase 2: Advanced Features
1. **Real-time Features**
   - Live location tracking
   - Push notifications
   - In-app messaging
   - Trip status updates

2. **Enhanced UI/UX**
   - Offline support
   - Error handling
   - Loading states
   - Performance optimization

## 📱 Platform Support

### Android
- **Minimum SDK**: 21 (Android 5.0)
- **Target SDK**: 34 (Android 14)
- **Permissions**: Location, Camera, Notifications, Phone

### iOS
- **Minimum Version**: iOS 12.0
- **Target Version**: iOS 17.0
- **Permissions**: Location, Camera, Notifications

## 🧪 Testing

### Test Structure
```
test/
├── unit/           # Unit tests for business logic
├── widget/         # Widget tests for UI components  
├── integration/    # Integration tests for flows
└── mocks/          # Mock data and services
```

### Running Tests
```bash
# Unit and widget tests
flutter test

# Integration tests  
flutter drive --target=test_driver/app.dart

# Coverage report
flutter test --coverage
```

## 🚀 Build & Deployment

### Development Builds
```bash
# Debug APK
flutter build apk --debug

# Debug iOS
flutter build ios --debug
```

### Release Builds
```bash
# Android App Bundle (for Play Store)
flutter build appbundle --release

# iOS Archive (for App Store)  
flutter build ipa --release
```

## 📁 Project Structure Status

### Customer App Status: ✅ Foundation Complete
- Authentication flow: Complete
- Home dashboard: Complete  
- Ride booking: Complete
- Real-time tracking: Complete
- Payment integration: Ready for implementation

### Driver App Status: ✅ Foundation Complete  
- Onboarding flow: Complete
- Document verification: Complete
- Dashboard: Complete
- Status management: Complete
- Earnings tracking: Ready for detailed implementation

## 🔗 Integration Points

### Backend API
- Base URL: `http://localhost:3000/api/v1`
- WebSocket: `http://localhost:3000`
- Authentication: JWT tokens
- Real-time: Socket.IO

### External Services
- **Google Maps**: Location and navigation
- **Firebase**: Push notifications  
- **Payment Gateway**: Stripe/Flutterwave
- **SMS Service**: Twilio for OTP

## 📞 Support

For development questions:
- Check the main documentation in `/docs`
- Review API documentation for integration
- Follow Flutter best practices
- Use BLoC pattern for state management

---

**Both Flutter applications are ready for backend integration and advanced feature implementation.** The foundation provides a solid base for building the complete ride-hailing platform.