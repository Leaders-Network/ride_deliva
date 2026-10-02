import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/location_data.dart';
import 'vehicle_selection_screen.dart';
import 'ride_confirmation_screen.dart';

class RideCompletionScreen extends StatelessWidget {
  final LocationData pickupLocation;
  final LocationData destinationLocation;
  final VehicleType vehicleType;
  final DriverInfo driver;
  final String tripDuration;
  final double totalFare;

  const RideCompletionScreen({
    super.key,
    required this.pickupLocation,
    required this.destinationLocation,
    required this.vehicleType,
    required this.driver,
    required this.tripDuration,
    required this.totalFare,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          onPressed: () =>
              Navigator.of(context).popUntil((route) => route.isFirst),
          icon: const Icon(Icons.close, color: AppColors.textPrimary),
        ),
        title: const Text(
          'Trip Completed',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        centerTitle: true,
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: 64,
              color: AppColors.success,
            ),
            SizedBox(height: 16),
            Text(
              'Ride Completion Screen',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            SizedBox(height: 8),
            Text(
              'Foundation completed - ready for detailed implementation',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
