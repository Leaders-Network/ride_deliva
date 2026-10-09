import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

enum _ActivityFilter { all, rides, deliveries, wallet }

enum _ActivityType { ride, delivery, wallet }

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  static const _activities = [
    _DriverActivity(
      title: 'Ride completed',
      details: 'Airport ride to Lekki Phase 1',
      time: '8:42 AM',
      amount: '+₦8,400',
      status: 'Completed',
      group: 'Today',
      type: _ActivityType.ride,
      icon: Icons.local_taxi_outlined,
    ),
    _DriverActivity(
      title: 'Delivery completed',
      details: 'Victoria Island to Ikoyi',
      time: '7:18 AM',
      amount: '+₦3,250',
      status: 'Paid',
      group: 'Today',
      type: _ActivityType.delivery,
      icon: Icons.inventory_2_outlined,
    ),
    _DriverActivity(
      title: 'Ride request accepted',
      details: 'Chika N. · Trip RD-12048',
      time: '6:54 AM',
      amount: 'In progress',
      status: 'Active',
      group: 'Today',
      type: _ActivityType.ride,
      icon: Icons.route_outlined,
    ),
    _DriverActivity(
      title: 'Payout sent to GTBank',
      details: 'Savings account ·•••• 4821',
      time: '11:03 AM',
      amount: '-₦20,000',
      status: 'Successful',
      group: 'Yesterday',
      type: _ActivityType.wallet,
      icon: Icons.account_balance_outlined,
    ),
    _DriverActivity(
      title: 'Weekend surge bonus',
      details: 'Bonus for completed trips',
      time: '6:15 PM',
      amount: '+₦1,050',
      status: 'Credited',
      group: 'Yesterday',
      type: _ActivityType.wallet,
      icon: Icons.workspace_premium_outlined,
    ),
    _DriverActivity(
      title: 'Ride completed',
      details: 'Admiralty Way to Ikoyi',
      time: '4:50 PM',
      amount: '+₦4,200',
      status: 'Completed',
      group: 'Yesterday',
      type: _ActivityType.ride,
      icon: Icons.local_taxi_outlined,
    ),
  ];

  _ActivityFilter _filter = _ActivityFilter.all;

  List<_DriverActivity> get _visibleActivities {
    return _activities.where((activity) {
      return switch (_filter) {
        _ActivityFilter.all => true,
        _ActivityFilter.rides => activity.type == _ActivityType.ride,
        _ActivityFilter.deliveries => activity.type == _ActivityType.delivery,
        _ActivityFilter.wallet => activity.type == _ActivityType.wallet,
      };
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final activities = _visibleActivities;
    final todayCount = activities.where((item) => item.group == 'Today').length;
    final yesterdayCount =
        activities.where((item) => item.group == 'Yesterday').length;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 16, 14),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Activity',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Show all activity',
                onPressed: () => setState(() => _filter = _ActivityFilter.all),
                icon: const Icon(Icons.history_rounded),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.backgroundCard,
                  foregroundColor: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 38,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            children: _ActivityFilter.values.map(_buildFilterChip).toList(),
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: activities.isEmpty
              ? const _EmptyActivityState()
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                  children: [
                    if (todayCount > 0) ...[
                      _ActivityGroupHeading(
                        title: 'Today',
                        count: todayCount,
                      ),
                      const SizedBox(height: 8),
                      _ActivityGroup(
                        activities: activities
                            .where((item) => item.group == 'Today')
                            .toList(),
                      ),
                      const SizedBox(height: 20),
                    ],
                    if (yesterdayCount > 0) ...[
                      _ActivityGroupHeading(
                        title: 'Yesterday',
                        count: yesterdayCount,
                      ),
                      const SizedBox(height: 8),
                      _ActivityGroup(
                        activities: activities
                            .where((item) => item.group == 'Yesterday')
                            .toList(),
                      ),
                    ],
                  ],
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(_ActivityFilter filter) {
    const labels = {
      _ActivityFilter.all: 'All',
      _ActivityFilter.rides: 'Rides',
      _ActivityFilter.deliveries: 'Deliveries',
      _ActivityFilter.wallet: 'Wallet',
    };
    final selected = _filter == filter;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        key: ValueKey(filter),
        label: Text(labels[filter]!),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => setState(() => _filter = filter),
        backgroundColor: AppColors.backgroundCard,
        selectedColor: AppColors.primaryGreen.withValues(alpha: 0.16),
        side: BorderSide(
          color: selected ? AppColors.primaryGreen : AppColors.border,
        ),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: selected ? AppColors.primaryGreen : AppColors.textSecondary,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _ActivityGroupHeading extends StatelessWidget {
  const _ActivityGroupHeading({required this.title, required this.count});

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        Text(
          '$count events',
          style: const TextStyle(
            fontSize: 10,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _ActivityGroup extends StatelessWidget {
  const _ActivityGroup({required this.activities});

  final List<_DriverActivity> activities;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          for (var index = 0; index < activities.length; index++) ...[
            _ActivityTile(activity: activities[index]),
            if (index < activities.length - 1)
              const Divider(height: 1, indent: 58),
          ],
        ],
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.activity});

  final _DriverActivity activity;

  @override
  Widget build(BuildContext context) {
    final isCredit = activity.amount.startsWith('+');
    final amountColor =
        isCredit ? AppColors.primaryGreen : AppColors.textPrimary;
    final statusColor = activity.status == 'Active'
        ? AppColors.primaryBlue
        : AppColors.textSecondary;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.backgroundSecondary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              activity.icon,
              color: activity.type == _ActivityType.delivery
                  ? AppColors.primaryBlue
                  : AppColors.textSecondary,
              size: 19,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${activity.details} · ${activity.time}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9,
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
                activity.amount,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: amountColor,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                activity.status,
                style: TextStyle(fontSize: 9, color: statusColor),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EmptyActivityState extends StatelessWidget {
  const _EmptyActivityState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.history_rounded,
                size: 40, color: AppColors.textTertiary),
            SizedBox(height: 12),
            Text(
              'No activity in this category',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverActivity {
  const _DriverActivity({
    required this.title,
    required this.details,
    required this.time,
    required this.amount,
    required this.status,
    required this.group,
    required this.type,
    required this.icon,
  });

  final String title;
  final String details;
  final String time;
  final String amount;
  final String status;
  final String group;
  final _ActivityType type;
  final IconData icon;
}
