import 'package:flutter/material.dart';

/// App color constants for Ride Deliva Driver App (Dark Theme)
class AppColors {
  // Brand colors - Blue for primary actions and selected states
  static const Color primaryAccent = Color(0xFF2563EB);
  static const Color primaryBlue = Color(0xFF2563EB);
  static const Color primaryDark = Color(0xFF1D4ED8);
  static const Color primaryLight = Color(0xFF60A5FA);

  // Driver Status Colors
  static const Color statusOnline =
      Color(0xFF10B981); // Green - Online/Available
  static const Color statusOffline = Color(0xFF6B7280); // Gray - Offline
  static const Color statusBusy = Color(0xFFEF4444); // Red - On a trip
  static const Color statusBreak = Color(0xFFF59E0B); // Orange - On break

  // Background colors (dark theme)
  static const Color backgroundDark = Color(0xFF0D1117);
  static const Color backgroundCard = Color(0xFF1C2128);
  static const Color backgroundSecondary = Color(0xFF21262D);

  // Text colors
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF8B949E);
  static const Color textTertiary = Color(0xFF6E7681);

  // Earnings and financial colors
  static const Color earningsGreen = Color(0xFF10B981);
  static const Color expenseRed = Color(0xFFDC3545);
  static const Color earningsBackground = Color(0xFF064E3B);

  // Trip status colors
  static const Color tripAccepted = Color(0xFF3B82F6);
  static const Color tripInProgress = Color(0xFF8B5CF6);
  static const Color tripCompleted = Color(0xFF10B981);
  static const Color tripCancelled = Color(0xFFEF4444);

  // Accent and functional colors
  static const Color accent = Color(0xFF2563EB);
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFFFB020);
  static const Color error = Color(0xFFDC3545);
  static const Color info = Color(0xFF17A2B8);

  // Additional colors for driver features
  static const Color orange = Color(0xFFFFB020);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color indigo = Color(0xFF6366F1);

  // Navigation and ride colors
  static const Color routeColor = Color(0xFF2196F3);
  static const Color pickupColor = Color(0xFF10B981);
  static const Color destinationColor = Color(0xFFEF4444);

  // Rating colors
  static const Color ratingExcellent = Color(0xFF10B981); // 4.5+ stars
  static const Color ratingGood = Color(0xFF3B82F6); // 4.0-4.4 stars
  static const Color ratingAverage = Color(0xFFF59E0B); // 3.5-3.9 stars
  static const Color ratingPoor = Color(0xFFEF4444); // <3.5 stars

  // Document verification colors
  static const Color docPending = Color(0xFFF59E0B);
  static const Color docApproved = Color(0xFF10B981);
  static const Color docRejected = Color(0xFFEF4444);

  // Gradient colors for driver features
  static const List<Color> onlineGradient = [
    Color(0xFF3B82F6),
    Color(0xFF2563EB),
  ];

  static const List<Color> earningsGradient = [
    Color(0xFF2563EB),
    Color(0xFF1D4ED8),
  ];

  static const List<Color> tripGradient = [
    Color(0xFF2196F3),
    Color(0xFF1976D2),
  ];

  static const List<Color> darkGradient = [
    Color(0xFF0D1117),
    Color(0xFF1C2128),
  ];

  // Wallet and financial colors
  static const Color walletBalance = Color(0xFF10B981);
  static const Color dailyEarnings = Color(0xFF3B82F6);
  static const Color weeklyEarnings = Color(0xFF8B5CF6);
  static const Color monthlyEarnings = Color(0xFFF59E0B);

  // Notification colors
  static const Color notifNewRide = Color(0xFF2196F3);
  static const Color notifPayment = Color(0xFF10B981);
  static const Color notifWarning = Color(0xFFF59E0B);
  static const Color notifError = Color(0xFFEF4444);

  // Map colors
  static const Color mapRoute = Color(0xFF2196F3);
  static const Color mapMarkerDriver = Color(0xFF10B981);
  static const Color mapMarkerCustomer = Color(0xFF2196F3);
  static const Color mapMarkerDestination = Color(0xFFEF4444);

  // Chart colors for analytics
  static const List<Color> chartColors = [
    Color(0xFF10B981), // Green
    Color(0xFF2196F3), // Blue
    Color(0xFF8B5CF6), // Purple
    Color(0xFFF59E0B), // Orange
    Color(0xFFEF4444), // Red
    Color(0xFF06B6D4), // Cyan
    Color(0xFFEC4899), // Pink
    Color(0xFF84CC16), // Lime
  ];

  // Divider and border colors
  static const Color divider = Color(0xFF30363D);
  static const Color border = Color(0xFF21262D);
  static const Color borderLight = Color(0xFF30363D);

  // Overlay colors
  static const Color overlay = Color(0x80000000);
  static const Color modalBarrier = Color(0x66000000);
  static const Color scrimLight = Color(0x52000000);

  // Disabled colors
  static const Color disabled = Color(0xFF6E7681);
  static const Color disabledBackground = Color(0xFF21262D);

  // Performance indicators
  static const Color performanceExcellent = Color(0xFF10B981);
  static const Color performanceGood = Color(0xFF3B82F6);
  static const Color performanceAverage = Color(0xFFF59E0B);
  static const Color performancePoor = Color(0xFFEF4444);

  // Vehicle type colors
  static const Color vehicleEconomy = Color(0xFF6B7280);
  static const Color vehicleComfort = Color(0xFF3B82F6);
  static const Color vehiclePremium = Color(0xFF8B5CF6);
  static const Color vehicleXL = Color(0xFFF59E0B);

  // Fuel and maintenance colors
  static const Color fuelGood = Color(0xFF10B981);
  static const Color fuelLow = Color(0xFFF59E0B);
  static const Color fuelCritical = Color(0xFFEF4444);

  static const Color maintenanceDue = Color(0xFFF59E0B);
  static const Color maintenanceOverdue = Color(0xFFEF4444);
  static const Color maintenanceGood = Color(0xFF10B981);
}

/// Material color swatch for the primary blue color (driver theme)
class DriverMaterialColors {
  static const MaterialColor primarySwatch = MaterialColor(
    0xFF2563EB,
    <int, Color>{
      50: Color(0xFFEFF6FF),
      100: Color(0xFFDBEAFE),
      200: Color(0xFFBFDBFE),
      300: Color(0xFF93C5FD),
      400: Color(0xFF60A5FA),
      500: Color(0xFF2563EB),
      600: Color(0xFF1D4ED8),
      700: Color(0xFF1E40AF),
      800: Color(0xFF1E3A8A),
      900: Color(0xFF172554),
    },
  );
}
