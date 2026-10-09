import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import 'widgets/driver_status_card.dart';
import 'widgets/earnings_summary_card.dart';
import 'widgets/today_stats_card.dart';
import 'widgets/quick_actions_grid.dart';
import 'widgets/driver_bottom_navigation.dart';
import 'widgets/active_bonus_card.dart';
import 'widgets/recent_trips_section.dart';
import '../trips/trips_screen.dart';
import '../wallet/wallet_screen.dart';
import '../activity/activity_screen.dart';
import '../profile/profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  int _currentIndex = 0;
  bool _isOnline = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: SafeArea(
        child: _currentIndex == 1
            ? const TripsScreen()
            : _currentIndex == 2
                ? const WalletScreen()
                : _currentIndex == 3
                    ? const ActivityScreen()
                    : _currentIndex == 4
                        ? const ProfileScreen()
                        : Column(
                            children: [
                              _buildHeader()
                                  .animate()
                                  .fadeIn(duration: 400.ms)
                                  .slideY(begin: -0.15, end: 0),
                              Expanded(
                                child: SingleChildScrollView(
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 8, 16, 24),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const EarningsSummaryCard()
                                          .animate()
                                          .fadeIn(
                                              delay: 100.ms, duration: 400.ms)
                                          .slideY(begin: 0.12, end: 0),
                                      const SizedBox(height: 12),
                                      const TodayStatsCard(),
                                      const SizedBox(height: 16),
                                      const QuickActionsGrid().animate().fadeIn(
                                          delay: 180.ms, duration: 400.ms),
                                      const SizedBox(height: 16),
                                      DriverStatusCard(
                                        isOnline: _isOnline,
                                        onStatusToggle: _toggleDriverStatus,
                                      ),
                                      const SizedBox(height: 12),
                                      const ActiveBonusCard(),
                                      const SizedBox(height: 20),
                                      RecentTripsSection(
                                        onSeeAll: () =>
                                            setState(() => _currentIndex = 1),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
      ),
      bottomNavigationBar: DriverBottomNavigation(
        currentIndex: _currentIndex,
        onTap: (index) {
          if (index > 4) return;
          setState(() {
            _currentIndex = index;
          });
        },
      ).animate().fadeIn(delay: 250.ms, duration: 400.ms),
    );
  }

  Widget _buildHeader() {
    final statusColor =
        _isOnline ? AppColors.statusOnline : AppColors.statusOffline;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 16, 8),
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Dashboard',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Notifications',
                onPressed: () {},
                icon: const Icon(Icons.notifications_none_rounded),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.backgroundCard,
                  foregroundColor: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.backgroundSecondary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.person_outline_rounded,
                  color: AppColors.textSecondary,
                  size: 26,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Flexible(
                          child: Text(
                            'Good Afternoon, David',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            _isOnline ? 'Online' : 'Offline',
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Stay active, keep your acceptance high, and maximize today\'s earnings.',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _toggleDriverStatus() {
    setState(() {
      _isOnline = !_isOnline;
    });

    // Show status change feedback
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _isOnline
              ? 'You are now online and available for rides'
              : 'You are now offline',
        ),
        backgroundColor:
            _isOnline ? AppColors.statusOnline : AppColors.statusOffline,
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
