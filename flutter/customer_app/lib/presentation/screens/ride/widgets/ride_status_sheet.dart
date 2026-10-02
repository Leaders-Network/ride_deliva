import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/models/location_data.dart';
import '../vehicle_selection_screen.dart';
import '../ride_confirmation_screen.dart';
import '../ride_tracking_screen.dart';

class RideStatusSheet extends StatelessWidget {
  final RideStatus status;
  final double progress;
  final LocationData pickupLocation;
  final LocationData destinationLocation;
  final DriverInfo driver;
  final VehicleType vehicleType;
  final String estimatedTime;
  final double distanceRemaining;
  final VoidCallback onCancel;
  final VoidCallback onEmergency;

  const RideStatusSheet({
    super.key,
    required this.status,
    required this.progress,
    required this.pickupLocation,
    required this.destinationLocation,
    required this.driver,
    required this.vehicleType,
    required this.estimatedTime,
    required this.distanceRemaining,
    required this.onCancel,
    required this.onEmergency,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle bar
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              const SizedBox(height: 16),

              // Progress indicator
              if (status != RideStatus.driverArrived) ...[
                Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _getProgressLabel(status),
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        Text(
                          '${(progress * 100).toInt()}%',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: progress,
                      backgroundColor: AppColors.border,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _getStatusColor(status),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
              ],

              // Status content
              if (status == RideStatus.driverEnRoute) ...[
                _buildDriverEnRouteContent(),
              ] else if (status == RideStatus.driverArrived) ...[
                _buildDriverArrivedContent(),
              ] else if (status == RideStatus.inProgress) ...[
                _buildInProgressContent(),
              ] else if (status == RideStatus.nearingDestination) ...[
                _buildNearingDestinationContent(),
              ],

              const SizedBox(height: 20),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onEmergency,
                      icon: const Icon(Icons.warning_outlined, size: 18),
                      label: const Text('Emergency'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.error,
                        side: const BorderSide(color: AppColors.error),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed:
                          status == RideStatus.inProgress ||
                              status == RideStatus.nearingDestination
                          ? null
                          : onCancel,
                      icon: const Icon(Icons.close, size: 18),
                      label: const Text('Cancel'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor:
                            status == RideStatus.inProgress ||
                                status == RideStatus.nearingDestination
                            ? AppColors.textTertiary
                            : AppColors.textSecondary,
                        side: BorderSide(
                          color:
                              status == RideStatus.inProgress ||
                                  status == RideStatus.nearingDestination
                              ? AppColors.border
                              : AppColors.textSecondary,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
              ),

              if (status == RideStatus.driverArrived) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.success.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: AppColors.success,
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Your driver has arrived. Please get in the vehicle.',
                          style: TextStyle(
                            color: AppColors.success,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(duration: 400.ms).slideY(begin: 0.3, end: 0),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDriverEnRouteContent() {
    return Column(
      children: [
        // Trip summary
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Center(
                child: Text(
                  vehicleType.icon,
                  style: const TextStyle(fontSize: 20),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Driver is ${distanceRemaining.toStringAsFixed(1)} km away',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'Estimated arrival: $estimatedTime',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              '₦${vehicleType.price.toStringAsFixed(0)}',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildDriverArrivedContent() {
    return Column(
      children: [
        Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.success.withValues(alpha: 0.1),
              ),
              child: const Icon(
                Icons.local_taxi,
                color: AppColors.success,
                size: 30,
              ),
            )
            .animate(onPlay: (controller) => controller.repeat())
            .scale(
              begin: const Offset(1.0, 1.0),
              end: const Offset(1.1, 1.1),
              duration: 1000.ms,
            )
            .then()
            .scale(
              begin: const Offset(1.1, 1.1),
              end: const Offset(1.0, 1.0),
              duration: 1000.ms,
            ),

        const SizedBox(height: 16),

        const Text(
          'Your driver has arrived!',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 4),

        Text(
          '${driver.vehicleModel} • ${driver.plateNumber}',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildInProgressContent() {
    return Column(
      children: [
        // Route info
        Row(
          children: [
            Column(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                ),
                Container(width: 2, height: 24, color: AppColors.border),
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppColors.error,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    pickupLocation.address,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    destinationLocation.address,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  estimatedTime,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'remaining',
                  style: TextStyle(color: AppColors.textTertiary, fontSize: 10),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildNearingDestinationContent() {
    return Column(
      children: [
        Container(
          width: 60,
          height: 60,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.info.withValues(alpha: 0.1),
          ),
          child: const Icon(Icons.location_on, color: AppColors.info, size: 30),
        ),

        const SizedBox(height: 16),

        const Text(
          'Almost there!',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),

        const SizedBox(height: 4),

        Text(
          'You\'ll arrive at your destination in $estimatedTime',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        ),
      ],
    );
  }

  String _getProgressLabel(RideStatus status) {
    switch (status) {
      case RideStatus.driverEnRoute:
        return 'Driver en route';
      case RideStatus.inProgress:
        return 'Trip progress';
      case RideStatus.nearingDestination:
        return 'Almost there';
      default:
        return '';
    }
  }

  Color _getStatusColor(RideStatus status) {
    switch (status) {
      case RideStatus.driverEnRoute:
        return AppColors.primaryBlue;
      case RideStatus.driverArrived:
        return AppColors.success;
      case RideStatus.inProgress:
        return AppColors.warning;
      case RideStatus.nearingDestination:
        return AppColors.info;
      case RideStatus.completed:
        return AppColors.success;
      case RideStatus.cancelled:
        return AppColors.error;
    }
  }
}
