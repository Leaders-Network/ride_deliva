import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

enum TripStatus { active, completed, cancelled }

class TripRecord {
  const TripRecord({
    required this.reference,
    required this.service,
    required this.rider,
    required this.pickup,
    required this.destination,
    required this.time,
    required this.fare,
    required this.status,
  });

  final String reference;
  final String service;
  final String rider;
  final String pickup;
  final String destination;
  final String time;
  final String fare;
  final TripStatus status;
}

class TripCard extends StatelessWidget {
  const TripCard({super.key, required this.trip});

  final TripRecord trip;

  @override
  Widget build(BuildContext context) {
    final statusColor = switch (trip.status) {
      TripStatus.active => AppColors.primaryBlue,
      TripStatus.completed => AppColors.success,
      TripStatus.cancelled => AppColors.error,
    };
    final statusLabel = switch (trip.status) {
      TripStatus.active => 'In progress',
      TripStatus.completed => 'Completed',
      TripStatus.cancelled => 'Cancelled',
    };
    final serviceIcon = trip.service == 'Delivery'
        ? Icons.inventory_2_outlined
        : Icons.local_taxi_outlined;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  borderRadius: BorderRadius.circular(10),
                ),
                child:
                    Icon(serviceIcon, color: AppColors.textSecondary, size: 19),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trip.service,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      trip.reference,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Column(
                  children: [
                    const Icon(
                      Icons.circle,
                      size: 9,
                      color: AppColors.primaryAccent,
                    ),
                    Container(
                      width: 1,
                      height: 18,
                      color: AppColors.borderLight,
                    ),
                    const Icon(
                      Icons.location_on,
                      size: 12,
                      color: AppColors.destinationColor,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trip.pickup,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 13),
                    Text(
                      trip.destination,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1),
          ),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      trip.rider,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      trip.time,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                trip.fare,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
