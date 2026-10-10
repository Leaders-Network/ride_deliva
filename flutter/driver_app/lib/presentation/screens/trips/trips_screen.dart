import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import 'widgets/trip_card.dart';

enum TripFilter { all, active, completed, cancelled }

class TripsScreen extends StatefulWidget {
  const TripsScreen({super.key});

  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> {
  static const _trips = [
    TripRecord(
      reference: 'RD-12048',
      service: 'Ride',
      rider: 'Chika N.',
      pickup: 'Murtala Muhammed Airport',
      destination: 'Lekki Phase 1',
      time: 'Today · 2:45 PM',
      fare: '₦8,400',
      status: TripStatus.active,
    ),
    TripRecord(
      reference: 'RD-12041',
      service: 'Ride',
      rider: 'Bola A.',
      pickup: 'Eko Atlantic',
      destination: 'Victoria Island',
      time: 'Today · 11:18 AM',
      fare: '₦4,250',
      status: TripStatus.completed,
    ),
    TripRecord(
      reference: 'RD-12016',
      service: 'Delivery',
      rider: 'Tunde K.',
      pickup: 'Admiralty Way, Lekki',
      destination: 'Ikoyi',
      time: 'Yesterday · 6:15 PM',
      fare: '₦3,250',
      status: TripStatus.completed,
    ),
    TripRecord(
      reference: 'RD-11992',
      service: 'Ride',
      rider: 'Amara O.',
      pickup: 'Ikeja City Mall',
      destination: 'Murtala Muhammed Airport',
      time: 'Yesterday · 9:40 AM',
      fare: '₦6,800',
      status: TripStatus.completed,
    ),
    TripRecord(
      reference: 'RD-11970',
      service: 'Ride',
      rider: 'Femi D.',
      pickup: 'Yaba',
      destination: 'Surulere',
      time: 'Oct 6 · 4:05 PM',
      fare: '₦2,100',
      status: TripStatus.cancelled,
    ),
  ];

  TripFilter _selectedFilter = TripFilter.all;
  bool _searchIsVisible = false;
  String _searchQuery = '';

  List<TripRecord> get _filteredTrips {
    return _trips.where((trip) {
      final matchesFilter = switch (_selectedFilter) {
        TripFilter.all => true,
        TripFilter.active => trip.status == TripStatus.active,
        TripFilter.completed => trip.status == TripStatus.completed,
        TripFilter.cancelled => trip.status == TripStatus.cancelled,
      };
      final query = _searchQuery.trim().toLowerCase();
      final matchesQuery = query.isEmpty ||
          trip.reference.toLowerCase().contains(query) ||
          trip.rider.toLowerCase().contains(query) ||
          trip.pickup.toLowerCase().contains(query) ||
          trip.destination.toLowerCase().contains(query) ||
          trip.service.toLowerCase().contains(query);
      return matchesFilter && matchesQuery;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final trips = _filteredTrips;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Trips',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                tooltip: _searchIsVisible ? 'Close search' : 'Search trips',
                onPressed: () {
                  setState(() {
                    _searchIsVisible = !_searchIsVisible;
                    _searchQuery = '';
                  });
                },
                icon: Icon(
                  _searchIsVisible ? Icons.close_rounded : Icons.search_rounded,
                ),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.backgroundCard,
                  foregroundColor: AppColors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        if (_searchIsVisible)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              autofocus: true,
              onChanged: (value) => setState(() => _searchQuery = value),
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search rider, route, or trip ID',
                prefixIcon: const Icon(Icons.search_rounded),
                isDense: true,
                filled: true,
                fillColor: AppColors.backgroundCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
          ),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: _TripSummary(trips: _trips),
        ),
        SizedBox(
          height: 38,
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            children: TripFilter.values.map(_buildFilterChip).toList(),
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: trips.isEmpty
              ? _EmptyTripsState(
                  hasSearch: _searchQuery.isNotEmpty,
                  onReset: () {
                    setState(() {
                      _selectedFilter = TripFilter.all;
                      _searchQuery = '';
                    });
                  },
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                  itemCount: trips.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 10),
                  itemBuilder: (context, index) => TripCard(trip: trips[index]),
                ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(TripFilter filter) {
    final count = _trips.where((trip) {
      return switch (filter) {
        TripFilter.all => true,
        TripFilter.active => trip.status == TripStatus.active,
        TripFilter.completed => trip.status == TripStatus.completed,
        TripFilter.cancelled => trip.status == TripStatus.cancelled,
      };
    }).length;
    final label = switch (filter) {
      TripFilter.all => 'All',
      TripFilter.active => 'Active',
      TripFilter.completed => 'Completed',
      TripFilter.cancelled => 'Cancelled',
    };
    final selected = _selectedFilter == filter;

    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        key: ValueKey(filter),
        label: Text('$label  $count'),
        selected: selected,
        showCheckmark: false,
        onSelected: (_) => setState(() => _selectedFilter = filter),
        backgroundColor: AppColors.backgroundCard,
        selectedColor: AppColors.primaryAccent.withValues(alpha: 0.16),
        side: BorderSide(
          color: selected ? AppColors.primaryAccent : AppColors.border,
        ),
        labelStyle: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: selected ? AppColors.primaryAccent : AppColors.textSecondary,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        visualDensity: VisualDensity.compact,
      ),
    );
  }
}

class _TripSummary extends StatelessWidget {
  const _TripSummary({required this.trips});

  final List<TripRecord> trips;

  @override
  Widget build(BuildContext context) {
    final completed = trips.where((trip) {
      return trip.status == TripStatus.completed;
    }).length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.route_outlined, color: AppColors.primaryAccent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${trips.length} trips',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  '$completed completed',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        ],
      ),
    );
  }
}

class _EmptyTripsState extends StatelessWidget {
  const _EmptyTripsState({required this.hasSearch, required this.onReset});

  final bool hasSearch;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.route_outlined,
              size: 40,
              color: AppColors.textTertiary,
            ),
            const SizedBox(height: 12),
            Text(
              hasSearch ? 'No matching trips' : 'No trips in this category',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: onReset, child: const Text('Clear filters')),
          ],
        ),
      ),
    );
  }
}
