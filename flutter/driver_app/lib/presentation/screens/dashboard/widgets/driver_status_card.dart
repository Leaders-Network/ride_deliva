import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class DriverStatusCard extends StatelessWidget {
  final bool isOnline;
  final VoidCallback onStatusToggle;

  const DriverStatusCard({
    super.key,
    required this.isOnline,
    required this.onStatusToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Availability',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 3),
          const Text(
            'Online / Offline',
            style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: SegmentedButton<bool>(
              showSelectedIcon: false,
              selected: {isOnline},
              onSelectionChanged: (_) => onStatusToggle(),
              segments: const [
                ButtonSegment(value: false, label: Text('Offline')),
                ButtonSegment(value: true, label: Text('Online')),
              ],
              style: ButtonStyle(
                padding: const WidgetStatePropertyAll(
                  EdgeInsets.symmetric(vertical: 10),
                ),
                backgroundColor: WidgetStateProperty.resolveWith((states) {
                  return states.contains(WidgetState.selected)
                      ? AppColors.primaryGreen
                      : AppColors.backgroundSecondary;
                }),
                foregroundColor: WidgetStateProperty.resolveWith((states) {
                  return states.contains(WidgetState.selected)
                      ? Colors.white
                      : AppColors.textSecondary;
                }),
                side: const WidgetStatePropertyAll(
                  BorderSide(color: AppColors.border),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
