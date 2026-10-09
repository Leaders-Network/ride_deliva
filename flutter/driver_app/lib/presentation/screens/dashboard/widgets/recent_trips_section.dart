import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';

class RecentTripsSection extends StatelessWidget {
  const RecentTripsSection({super.key, this.onSeeAll});

  final VoidCallback? onSeeAll;

  static const _trips = [
    _TripItem(
      title: 'Airport ride to Lekki',
      subtitle: 'Ride · Today, 8:42 AM',
      amount: '₦8,400',
      status: 'Completed',
      icon: Icons.local_taxi_outlined,
    ),
    _TripItem(
      title: 'Delivery payout from Victoria Island',
      subtitle: 'Delivery · Yesterday, 6:15 PM',
      amount: '+ ₦3,250',
      status: 'Paid',
      icon: Icons.inventory_2_outlined,
    ),
    _TripItem(
      title: 'Wallet top up via bank transfer',
      subtitle: 'Wallet · Yesterday, 11:03 AM',
      amount: '+ ₦20,000',
      status: 'Successful',
      icon: Icons.account_balance_wallet_outlined,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Recent Trips',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
            TextButton(
              onPressed: onSeeAll,
              child: const Text('See all'),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          decoration: BoxDecoration(
            color: AppColors.backgroundCard,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              for (var index = 0; index < _trips.length; index++) ...[
                _RecentTripTile(trip: _trips[index]),
                if (index < _trips.length - 1)
                  const Divider(height: 1, indent: 58),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _RecentTripTile extends StatelessWidget {
  const _RecentTripTile({required this.trip});

  final _TripItem trip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.backgroundSecondary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              trip.icon,
              color: AppColors.textSecondary,
              size: 18,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  trip.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  trip.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                trip.amount,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                trip.status,
                style: const TextStyle(
                  fontSize: 10,
                  color: AppColors.primaryGreen,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TripItem {
  const _TripItem({
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.status,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final String amount;
  final String status;
  final IconData icon;
}
