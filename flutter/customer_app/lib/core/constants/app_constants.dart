/// Application-wide constants
class AppConstants {
  // App info
  static const String appName = 'Ride Deliva';
  static const String appVersion = '1.0.0';
  static const String companyName = 'Ride Deliva Ltd';
  
  // API Configuration
  static const String baseUrl = 'http://localhost:3000/api/v1';
  static const String socketUrl = 'http://localhost:3000';
  
  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userKey = 'user_data';
  static const String onboardingKey = 'has_seen_onboarding';
  static const String themeKey = 'theme_mode';
  static const String languageKey = 'language_code';
  
  // Animation durations
  static const Duration shortAnimation = Duration(milliseconds: 200);
  static const Duration mediumAnimation = Duration(milliseconds: 300);
  static const Duration longAnimation = Duration(milliseconds: 500);
  
  // Map configuration
  static const double defaultZoom = 15.0;
  static const double minZoom = 10.0;
  static const double maxZoom = 20.0;
  
  // Location settings
  static const double locationAccuracy = 10.0; // meters
  static const Duration locationUpdateInterval = Duration(seconds: 5);
  
  // Ride settings
  static const int maxRideHistoryItems = 50;
  static const Duration rideTimeout = Duration(minutes: 10);
  static const double maxRideDistance = 100.0; // kilometers
  
  // Validation
  static const int minPasswordLength = 8;
  static const int maxPasswordLength = 128;
  static const int otpLength = 6;
  static const Duration otpTimeout = Duration(minutes: 5);
  
  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  
  // File upload
  static const int maxFileSize = 5 * 1024 * 1024; // 5MB
  static const List<String> allowedImageTypes = ['jpg', 'jpeg', 'png', 'webp'];
  
  // Currency
  static const String currency = 'NGN';
  static const String currencySymbol = '₦';
  
  // Contact information
  static const String supportEmail = 'support@ridedeliva.com';
  static const String supportPhone = '+234-800-RIDE-NOW';
  
  // Social media
  static const String websiteUrl = 'https://ridedeliva.com';
  static const String facebookUrl = 'https://facebook.com/ridedeliva';
  static const String twitterUrl = 'https://twitter.com/ridedeliva';
  static const String instagramUrl = 'https://instagram.com/ridedeliva';
  
  // Legal
  static const String termsOfServiceUrl = 'https://ridedeliva.com/terms';
  static const String privacyPolicyUrl = 'https://ridedeliva.com/privacy';
  
  // Feature flags (for development)
  static const bool enableDebugMode = true;
  static const bool enableAnalytics = false;
  static const bool enableCrashReporting = false;
}

/// Route names for navigation
class AppRoutes {
  static const String splash = '/';
  static const String onboarding = '/onboarding';
  static const String login = '/login';
  static const String register = '/register';
  static const String verifyPhone = '/verify-phone';
  static const String permissions = '/permissions';
  static const String home = '/home';
  static const String rideBooking = '/ride-booking';
  static const String vehicleSelection = '/vehicle-selection';
  static const String rideTracking = '/ride-tracking';
  static const String rideCompletion = '/ride-completion';
  static const String profile = '/profile';
  static const String wallet = '/wallet';
  static const String notifications = '/notifications';
  static const String rideHistory = '/ride-history';
  static const String support = '/support';
  static const String settings = '/settings';
  static const String emergencyContacts = '/emergency-contacts';
}

/// Asset paths
class AppAssets {
  // Images
  static const String logo = 'assets/images/logo.png';
  static const String logoWhite = 'assets/images/logo_white.png';
  static const String onboarding1 = 'assets/images/onboarding_1.png';
  static const String onboarding2 = 'assets/images/onboarding_2.png';
  static const String onboarding3 = 'assets/images/onboarding_3.png';
  static const String emptyState = 'assets/images/empty_state.png';
  static const String carMarker = 'assets/images/car_marker.png';
  static const String pickupMarker = 'assets/images/pickup_marker.png';
  static const String destinationMarker = 'assets/images/destination_marker.png';
  
  // Icons
  static const String carIcon = 'assets/icons/car.svg';
  static const String bikeIcon = 'assets/icons/bike.svg';
  static const String truckIcon = 'assets/icons/truck.svg';
  static const String locationIcon = 'assets/icons/location.svg';
  static const String walletIcon = 'assets/icons/wallet.svg';
  static const String notificationIcon = 'assets/icons/notification.svg';
  
  // Animations
  static const String loadingAnimation = 'assets/animations/loading.json';
  static const String successAnimation = 'assets/animations/success.json';
  static const String errorAnimation = 'assets/animations/error.json';
  static const String carMovingAnimation = 'assets/animations/car_moving.json';
}

/// Vehicle types
enum VehicleType {
  economy('Economy', 'Standard rides at affordable prices'),
  comfort('Comfort', 'Premium rides with extra comfort'),
  luxury('Luxury', 'High-end vehicles for special occasions'),
  xl('XL', 'Spacious rides for groups'),
  bike('Bike', 'Quick delivery via motorcycle'),
  van('Van', 'Large deliveries and cargo transport');

  const VehicleType(this.displayName, this.description);
  final String displayName;
  final String description;
}

/// Ride status enum
enum RideStatus {
  requested('Requested'),
  driverAssigned('Driver Assigned'),
  driverArriving('Driver Arriving'),
  inProgress('In Progress'),
  completed('Completed'),
  cancelled('Cancelled'),
  failed('Failed');

  const RideStatus(this.displayName);
  final String displayName;
}

/// Payment methods
enum PaymentMethod {
  cash('Cash'),
  card('Credit/Debit Card'),
  wallet('Wallet Balance'),
  bankTransfer('Bank Transfer');

  const PaymentMethod(this.displayName);
  final String displayName;
}

/// Permission types
enum PermissionType {
  location('Location Access', 'Required for pickup and delivery services'),
  notifications('Push Notifications', 'Stay updated on your rides and deliveries'),
  camera('Camera Access', 'For profile photos and delivery confirmations');

  const PermissionType(this.title, this.description);
  final String title;
  final String description;
}
