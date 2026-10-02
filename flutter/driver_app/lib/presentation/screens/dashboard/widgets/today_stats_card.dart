import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class TodayStatsCard extends StatelessWidget {
  const TodayStatsCard({super.key});

  @override
  Widget build(BuildContext context) {
    final stats = [
      const StatItem(
        icon: Icons.directions_car,
        label: 'Trips',
        value: '12',
        color: AppColors.primaryBlue,
      ),
      const StatItem(
        icon: Icons.schedule,
        label: 'Online Time',
        value: '6h 30m',
        color: AppColors.warning,
      ),
      const StatItem(
        icon: Icons.star,
        label: 'Rating',
        value: '4.9',
        color: AppColors.success,
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Today\'s Performance',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: stats.map((stat) => _StatColumn(stat: stat)).toList(),
          ),
        ],
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  final StatItem stat;

  const _StatColumn({required this.stat});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: stat.color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            stat.icon,
            color: stat.color,
            size: 20,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          stat.value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          stat.label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class StatItem {
  final IconData icon;
  final String label;
  final String value;
  final Color color;

  const StatItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
  });
}