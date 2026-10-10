# Ride Deliva Driver

**A professional driver app for the Ride Deliva platform** - enabling drivers to accept rides, manage earnings, and track performance in real-time.

## 📱 Screenshots

### Onboarding & Authentication
<div style="display: flex; gap: 10px;">

| Onboarding | Driver Login | Phone Verification |
|------------|--------------|-------------------|
| ![Onboarding](docs/screenshots/onboarding.png) | ![Login](docs/screenshots/login.png) | ![Verify Phone](docs/screenshots/verify-phone.png) |
| Drive & earn with flexibility | Sign in with phone number | Secure phone verification |

</div>

### Document Verification Flow
<div style="display: flex; gap: 10px;">

| Verification Overview |  | Background Check |
|----------------------|---------------------|------------------|
| ![Verification](docs/screenshots/verification-overview.png) |  | ![Background Check](docs/screenshots/personal-info.png) |
| 4-stage verification process | | Guarantor & emergency contact |

</div>

### Main Dashboard
<div style="display: flex; gap: 10px;">

| Dashboard | Trips | Wallet |
|-----------|-------|--------|
| ![Dashboard](docs/screenshots/background-check.png) | ![Trips](docs/screenshots/dashboard.png) | ![Wallet](docs/screenshots/trips.png) |
| Live earnings & performance | Trip history & management | Balance & transactions |

</div>

### Additional Screens
<div style="display: flex; gap: 10px;">

| Activity | Profile |
|----------|---------|
| ![Activity](docs/screenshots/wallet.png) | ![Profile](docs/screenshots/activity.png) |
| Recent activities & events | Driver profile & settings |

</div>

---

## 🚀 Getting Started

### Prerequisites
- Flutter SDK 3.16+
- Dart 3.2+
- Android Studio / VS Code
- Android device or emulator (for full feature testing)

### Installation

Run from `flutter/driver_app`:

```powershell
flutter pub get
flutter run -d chrome
```

Chrome must be installed and listed by `flutter devices`. No Chrome Dart package
or ChromeDriver is required. If web support is disabled, run
`flutter config --enable-web`.

When opening the repository root in VS Code, the local launch configuration
includes **Driver app (Chrome preview)**. For Android, start an emulator or
connect a phone with USB debugging, select it in VS Code, and use
**Driver app (selected Android device)**. From the terminal:

```powershell
flutter devices
flutter run -d <android-device-id>
flutter build apk --debug
```

Validate changes with `flutter test` and `flutter build web`. Test native
location, notifications, background execution, and permissions on Android.

---

## ✨ Key Features

### 🔐 Complete Verification System
- **4-Stage Document Upload Flow**
  - Step 1: Personal Information (Name, DOB, Email, NIN, Selfie)
  - Step 2: Driver License (Front/Back photos, License details)
  - Step 3: Vehicle Documents (Registration, Insurance, Photos)
  - Step 4: Background Check (Guarantor, Emergency contact)
- Real-time verification status tracking
- Secure document upload with validation

### 📊 Dashboard & Analytics
- Live earnings display with daily totals
- Performance metrics (trips, rating, online time)
- Quick action buttons for key features
- Status management (Online/Offline toggle)

### 🚗 Trip Management
- Active trip tracking
- Trip history with filter options
- Earnings per trip
- Customer ratings and feedback

### 💰 Wallet & Earnings
- Real-time balance updates
- Transaction history (earnings and payouts)
- Linked bank account management
- Withdrawal functionality

### 📱 Activity Tracking
- Recent events timeline
- Ride completions and deliveries
- Payout notifications
- Bonus and rewards tracking

### 👤 Profile Management
- Driver statistics (trips, rating, member duration)
- Personal information management
- Vehicle details
- Document status review

---

## 🏗️ Architecture

This app follows **Clean Architecture** principles with BLoC state management:

```
lib/
├── core/                 # Shared utilities and configurations
│   ├── constants/       # App constants
│   ├── theme/          # UI theme and styling
│   └── utils/          # Helper utilities
├── data/               # Data layer (to be implemented)
│   ├── models/         # Data models
│   ├── repositories/   # Repository implementations
│   └── providers/      # API and local storage
├── presentation/       # Presentation layer
│   ├── screens/        # UI screens
│   └── widgets/        # Reusable widgets
└── main.dart          # App entry point
```

### Current Status
- ✅ UI/UX Implementation Complete
- ✅ 4-Stage Rider Verification Flow
- ✅ Dashboard with all tabs
- ✅ Navigation and routing
- 🔄 Backend integration pending
- 🔄 State management (BLoC) pending
- 🔄 Real-time features pending

---

## 🧪 Testing

Validate changes with `flutter test` and `flutter build web`. Test native
location, notifications, background execution, and permissions on Android.

Android builds use a 2 GB Gradle heap and two workers to leave memory available
for the IDE and emulator on an 8 GB development machine.

The unused legacy `qr_code_scanner`, `file_picker`, `workmanager`, and
`flutter_local_notifications`
dependencies were removed because they were incompatible with the current
Android/Flutter toolchain. Add compatible packages when implementing those
features; do not patch files in the global Pub cache.

Poppins fonts are bundled from
[Google Fonts](https://github.com/google/fonts/tree/main/ofl/poppins), with their
license in `assets/fonts/OFL.txt`.

---

## 📂 Project Structure

```
driver_app/
├── lib/
│   ├── core/
│   │   ├── constants/app_constants.dart
│   │   └── theme/
│   │       ├── app_theme.dart
│   │       └── app_colors.dart
│   ├── presentation/
│   │   └── screens/
│   │       ├── splash/
│   │       ├── onboarding/
│   │       ├── auth/
│   │       ├── dashboard/
│   │       ├── trips/
│   │       ├── wallet/
│   │       ├── activity/
│   │       ├── profile/
│   │       └── document_verification/
│   │           └── rider/          # 4-stage verification flow
│   └── main.dart
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
├── test/
├── docs/
│   └── screenshots/                # App screenshots
├── pubspec.yaml
├── progress.md                     # Development progress tracker
└── README.md
```

---

## 🎨 Design System

### Theme
- **Dark Theme** optimized for outdoor visibility
- **Primary Color**: Blue (#2563EB) for actions and navigation
- **Accent Color**: Green (#10B981) for earnings and success states
- **Typography**: Poppins font family

### Color Palette
- Online Status: Green (#10B981)
- Offline Status: Gray (#6B7280)
- Earnings: Green (#10B981)
- Warnings: Orange (#F59E0B)
- Errors: Red (#EF4444)

---

## 🔄 Development Progress

See [progress.md](progress.md) for detailed development timeline and updates.

### Recent Updates (2026-10-10)
- ✅ Complete 4-stage rider verification flow
- ✅ Replaced single-step upload with multi-stage process
- ✅ Integrated verification navigation
- ✅ All screens compile successfully
- ✅ Comprehensive documentation

---

## 🤝 Contributing

This is a private project for Ride Deliva. For questions or issues, contact the development team.

---

## 📄 License

Proprietary - All rights reserved by Ride Deliva

---

## 📞 Contact

For development questions or support:
- Project Lead: Ibrahim
- Development Team: Leaders Network

---

**Built with Flutter 💙 | Ride Deliva © 2024**

