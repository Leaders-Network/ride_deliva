/// App-wide constants for Ride Deliva Driver App
class AppConstants {
  // App Information
  static const String appName = 'Ride Deliva Driver';
  static const String appVersion = '1.0.0';
  static const String companyName = 'Ride Deliva';

  // API Configuration
  static const String baseUrl = 'http://localhost:3000/api/v1';
  static const String socketUrl = 'http://localhost:3000';
  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration socketTimeout = Duration(seconds: 10);

  // Storage Keys
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userDataKey = 'user_data';
  static const String driverProfileKey = 'driver_profile';
  static const String settingsKey = 'app_settings';
  static const String themeKey = 'theme_mode';

  // Driver Status
  static const String statusOffline = 'offline';
  static const String statusOnline = 'online';
  static const String statusBusy = 'busy';
  static const String statusBreak = 'break';

  // Vehicle Types
  static const String vehicleEconomy = 'economy';
  static const String vehicleComfort = 'comfort';
  static const String vehiclePremium = 'premium';
  static const String vehicleXL = 'xl';

  // Order Status
  static const String orderPending = 'pending';
  static const String orderAccepted = 'accepted';
  static const String orderInProgress = 'in_progress';
  static const String orderCompleted = 'completed';
  static const String orderCancelled = 'cancelled';

  // Trip Status
  static const String tripDriverEnRoute = 'driver_en_route';
  static const String tripDriverArrived = 'driver_arrived';
  static const String tripStarted = 'started';
  static const String tripNearDestination = 'near_destination';
  static const String tripCompleted = 'completed';

  // Document Types
  static const String docDriverLicense = 'driver_license';
  static const String docVehicleRegistration = 'vehicle_registration';
  static const String docInsurance = 'insurance';
  static const String docVehicleInspection = 'vehicle_inspection';
  static const String docProfilePhoto = 'profile_photo';

  // Verification Status
  static const String verificationPending = 'pending';
  static const String verificationApproved = 'approved';
  static const String verificationRejected = 'rejected';

  // Map Configuration
  static const double defaultMapZoom = 16.0;
  static const double locationUpdateInterval = 5.0; // seconds
  static const double minimumDistanceFilter = 10.0; // meters

  // Notification Types
  static const String notifNewRide = 'new_ride';
  static const String notifRideCancelled = 'ride_cancelled';
  static const String notifPaymentReceived = 'payment_received';
  static const String notifDocumentStatus = 'document_status';
  static const String notifPromotion = 'promotion';

  // Audio Files
  static const String audioNewRequest = 'assets/audio/new_request.mp3';
  static const String audioRideCompleted = 'assets/audio/ride_completed.mp3';
  static const String audioNavigationTurn = 'assets/audio/navigation_turn.mp3';

  // Animation Durations
  static const Duration shortAnimation = Duration(milliseconds: 300);
  static const Duration mediumAnimation = Duration(milliseconds: 500);
  static const Duration longAnimation = Duration(milliseconds: 800);

  // Validation Rules
  static const int minPasswordLength = 6;
  static const int phoneNumberLength = 11;
  static const int otpLength = 6;
  
  // Earnings
  static const double platformCommission = 0.15; // 15%
  static const double minimumEarningThreshold = 1000.0; // NGN
  static const int payoutCycleDays = 7;

  // Rating
  static const double minRatingToWork = 3.0;
  static const double excellentRating = 4.8;
  static const int minTripsForRating = 10;

  // Time Limits
  static const Duration requestAcceptanceTime = Duration(minutes: 2);
  static const Duration arrivalTimeLimit = Duration(minutes: 10);
  static const Duration waitTimeLimit = Duration(minutes: 5);

  // Distance Limits
  static const double maxPickupDistance = 15.0; // km
  static const double nearbyDriverRadius = 5.0; // km
  
  // Background Service
  static const String backgroundServiceId = 'driver_location_service';
  static const Duration backgroundUpdateInterval = Duration(seconds: 30);

  // Error Messages
  static const String networkError = 'Network connection error. Please check your internet connection.';
  static const String serverError = 'Server error. Please try again later.';
  static const String validationError = 'Please check your input and try again.';
  static const String locationError = 'Unable to get your location. Please enable location services.';
  static const String authError = 'Authentication failed. Please log in again.';
  
  // Success Messages
  static const String loginSuccess = 'Welcome back! You are now online.';
  static const String documentUploadSuccess = 'Document uploaded successfully.';
  static const String profileUpdateSuccess = 'Profile updated successfully.';
  static const String statusUpdateSuccess = 'Status updated successfully.';

  // URLs
  static const String privacyPolicyUrl = 'https://ridedeliva.com/privacy';
  static const String termsOfServiceUrl = 'https://ridedeliva.com/terms';
  static const String supportUrl = 'https://ridedeliva.com/support';
  static const String helpUrl = 'https://ridedeliva.com/help';

  // Social Media
  static const String facebookUrl = 'https://facebook.com/ridedeliva';
  static const String twitterUrl = 'https://twitter.com/ridedeliva';
  static const String instagramUrl = 'https://instagram.com/ridedeliva';

  // Contact Information
  static const String supportEmail = 'support@ridedeliva.com';
  static const String supportPhone = '+234 800 DELIVA';
  static const String emergencyPhone = '199';

  // Lagos Default Location (Fallback)
  static const double defaultLatitude = 6.5244;
  static const double defaultLongitude = 3.3792;
}