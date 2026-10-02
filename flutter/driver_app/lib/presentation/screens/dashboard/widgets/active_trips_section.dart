import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ActiveTripsSection extends StatelessWidget {
  const ActiveTripsSection({super.key, this.hasActiveTrips = false});

  final bool hasActiveTrips;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Active Trips',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            if (hasActiveTrips)
              TextButton(
                onPressed: () {
                  // TODO: Navigate to trip details
                },
                child: const Text(
                  'View All',
                  style: TextStyle(
                    color: AppColors.primaryGreen,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 16),
        
        if (!hasActiveTrips)
          _buildEmptyState()
        else
          _buildActiveTrips(),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.route_outlined,
            size: 48,
            color: AppColors.textTertiary,
          ),
          SizedBox(height: 16),
          Text(
            'No Active Trips',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Go online to start receiving ride requests',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveTrips() {
    // Placeholder for active trips list
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: const Text(
        'Active trips will be displayed here',
        style: TextStyle(
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}
