import 'package:flutter/material.dart';

/// App color constants based on the UI reference design
class AppColors {
  // Primary colors from the UI design
  static const Color primaryBlue = Color(0xFF2196F3);
  static const Color primaryDark = Color(0xFF1565C0);
  static const Color primaryLight = Color(0xFF64B5F6);
  
  // Background colors (dark theme)
  static const Color backgroundDark = Color(0xFF0D1117);
  static const Color backgroundCard = Color(0xFF1C2128);
  static const Color backgroundSecondary = Color(0xFF21262D);
  
  // Text colors
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF8B949E);
  static const Color textTertiary = Color(0xFF6E7681);
  
  // Accent and functional colors
  static const Color accent = Color(0xFF2196F3);
  static const Color success = Color(0xFF28A745);
  static const Color warning = Color(0xFFFFB020);
  static const Color error = Color(0xFFDC3545);
  static const Color info = Color(0xFF17A2B8);
  
  // Additional colors for UI components
  static const Color orange = Color(0xFFFFB020);
  static const Color purple = Color(0xFF8B5CF6);
  
  // Gradient colors
  static const List<Color> blueGradient = [
    Color(0xFF2196F3),
    Color(0xFF1976D2),
  ];
  
  static const List<Color> darkGradient = [
    Color(0xFF0D1117),
    Color(0xFF1C2128),
  ];
  
  // Wallet and financial colors
  static const Color walletBalance = Color(0xFF2196F3);
  static const Color income = Color(0xFF28A745);
  static const Color expense = Color(0xFFDC3545);
  
  // Status colors for rides/deliveries
  static const Color statusPending = Color(0xFFFFB020);
  static const Color statusActive = Color(0xFF2196F3);
  static const Color statusCompleted = Color(0xFF28A745);
  static const Color statusCancelled = Color(0xFFDC3545);
  
  // Map colors
  static const Color mapRoute = Color(0xFF2196F3);
  static const Color mapMarker = Color(0xFF1976D2);
  
  // Divider and border colors
  static const Color divider = Color(0xFF30363D);
  static const Color border = Color(0xFF21262D);
  static const Color borderLight = Color(0xFF30363D);
  
  // Overlay colors
  static const Color overlay = Color(0x80000000);
  static const Color modalBarrier = Color(0x66000000);
  
  // Disabled colors
  static const Color disabled = Color(0xFF6E7681);
  static const Color disabledBackground = Color(0xFF21262D);
}

/// Material color swatch for the primary blue color
class AppMaterialColors {
  static const MaterialColor primarySwatch = MaterialColor(
    0xFF2196F3,
    <int, Color>{
      50: Color(0xFFE3F2FD),
      100: Color(0xFFBBDEFB),
      200: Color(0xFF90CAF9),
      300: Color(0xFF64B5F6),
      400: Color(0xFF42A5F5),
      500: Color(0xFF2196F3),
      600: Color(0xFF1E88E5),
      700: Color(0xFF1976D2),
      800: Color(0xFF1565C0),
      900: Color(0xFF0D47A1),
    },
  );
}
