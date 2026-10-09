import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../document_verification/document_verification_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Profile',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
              const _DriverIdentity(),
              const SizedBox(height: 12),
              const _DriverStats(),
              const SizedBox(height: 22),
              const _SectionHeading(title: 'Driver account'),
              const SizedBox(height: 8),
              _ProfileOption(
                icon: Icons.person_outline_rounded,
                title: 'Personal information',
                subtitle: 'Name, phone number, and email',
                onTap: () => _showComingSoon(context, 'Personal information'),
              ),
              _ProfileOption(
                icon: Icons.verified_user_outlined,
                title: 'Driver documents',
                subtitle: 'Review your verification documents',
                trailing: const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.textTertiary,
                ),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (context) => const DocumentVerificationScreen(),
                    ),
                  );
                },
              ),
              _ProfileOption(
                icon: Icons.directions_car_outlined,
                title: 'Vehicle details',
                subtitle: 'Toyota Corolla · Comfort Sedan',
                onTap: () => _showComingSoon(context, 'Vehicle details'),
              ),
              _ProfileOption(
                icon: Icons.account_balance_outlined,
                title: 'Payout account',
                subtitle: 'GTBank ·•••• 4821',
                onTap: () => _showComingSoon(context, 'Payout account'),
              ),
              const SizedBox(height: 20),
              const _SectionHeading(title: 'Support'),
              const SizedBox(height: 8),
              _ProfileOption(
                icon: Icons.help_outline_rounded,
                title: 'Help and support',
                subtitle: 'Get assistance with your account',
                onTap: () => _showComingSoon(context, 'Help and support'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () => _confirmSignOut(context),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text('Sign out'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: const BorderSide(color: AppColors.borderLight),
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  static void _showComingSoon(BuildContext context, String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$feature will be available soon'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  static Future<void> _confirmSignOut(BuildContext context) async {
    final shouldSignOut = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out?'),
        content:
            const Text('You can sign back in to manage your driver account.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );

    if (shouldSignOut == true && context.mounted) {
      _showComingSoon(context, 'Sign out');
    }
  }
}

class _DriverIdentity extends StatelessWidget {
  const _DriverIdentity();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: AppColors.primaryGreen.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Center(
              child: Text(
                'DA',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryGreen,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'David A.',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Driver since 2024',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
                SizedBox(height: 7),
                Row(
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      size: 13,
                      color: AppColors.textTertiary,
                    ),
                    SizedBox(width: 3),
                    Text(
                      'Lekki Phase 1, Lagos',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Icon(
            Icons.verified_rounded,
            color: AppColors.primaryGreen,
            size: 21,
          ),
        ],
      ),
    );
  }
}

class _DriverStats extends StatelessWidget {
  const _DriverStats();

  @override
  Widget build(BuildContext context) {
    const stats = [
      _ProfileStat(label: 'Trips', value: '1,250', icon: Icons.route_outlined),
      _ProfileStat(label: 'Rating', value: '4.9', icon: Icons.star_outline),
      _ProfileStat(label: 'Member', value: '2 years', icon: Icons.schedule),
    ];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: stats.map((stat) {
          return Expanded(
            child: Column(
              children: [
                Icon(stat.icon, size: 17, color: AppColors.primaryGreen),
                const SizedBox(height: 6),
                Text(
                  stat.value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  stat.label,
                  style: const TextStyle(
                    fontSize: 10,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ProfileOption extends StatelessWidget {
  const _ProfileOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.backgroundCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: const BorderSide(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: ListTile(
          onTap: onTap,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
          leading: Icon(icon, color: AppColors.textSecondary, size: 21),
          title: Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.textSecondary,
            ),
          ),
          trailing: trailing ??
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.textTertiary,
              ),
        ),
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}

class _ProfileStat {
  const _ProfileStat({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;
}
