import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../../core/theme/app_colors.dart';
import '../ride_booking_screen.dart';

class LocationSearchSheet extends StatefulWidget {
  final String searchType;
  final Function(LocationData) onLocationSelected;
  final VoidCallback onClose;

  const LocationSearchSheet({
    super.key,
    required this.searchType,
    required this.onLocationSelected,
    required this.onClose,
  });

  @override
  State<LocationSearchSheet> createState() => _LocationSearchSheetState();
}

class _LocationSearchSheetState extends State<LocationSearchSheet> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  List<LocationData> _searchResults = [];
  List<LocationData> _recentLocations = [];
  bool _isSearching = false;

  @override
  void initState() {
    super.initState();
    _loadRecentLocations();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _searchFocusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _loadRecentLocations() {
    // Mock recent locations (in real app, load from local storage)
    _recentLocations = [
      const LocationData(
        address: 'Victoria Island',
        subAddress: 'Lagos Island, Lagos',
        latLng: LatLng(6.4281, 3.4219),
      ),
      const LocationData(
        address: 'Ikeja GRA',
        subAddress: 'Ikeja, Lagos',
        latLng: LatLng(6.5947, 3.3405),
      ),
      const LocationData(
        address: 'Lekki Phase 1',
        subAddress: 'Lekki Peninsula, Lagos',
        latLng: LatLng(6.4698, 3.5852),
      ),
      const LocationData(
        address: 'Maryland Mall',
        subAddress: 'Maryland, Lagos',
        latLng: LatLng(6.5568, 3.3515),
      ),
    ];
  }

  void _performSearch(String query) {
    if (query.isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }

    setState(() {
      _isSearching = true;
    });

    // Simulate search API call
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() {
          _searchResults = _mockSearchResults(query);
          _isSearching = false;
        });
      }
    });
  }

  List<LocationData> _mockSearchResults(String query) {
    // Mock search results based on query
    final allLocations = [
      const LocationData(
        address: 'Murtala Muhammed Airport',
        subAddress: 'International Airport Road, Lagos',
        latLng: LatLng(6.5773, 3.3213),
      ),
      const LocationData(
        address: 'National Theatre',
        subAddress: 'Iganmu, Lagos',
        latLng: LatLng(6.4641, 3.3896),
      ),
      const LocationData(
        address: 'Tafawa Balewa Square',
        subAddress: 'Lagos Island, Lagos',
        latLng: LatLng(6.4511, 3.3899),
      ),
      const LocationData(
        address: 'Computer Village',
        subAddress: 'Ikeja, Lagos',
        latLng: LatLng(6.5467, 3.3515),
      ),
      const LocationData(
        address: 'Palms Shopping Mall',
        subAddress: 'Lekki, Lagos',
        latLng: LatLng(6.4218, 3.4881),
      ),
      const LocationData(
        address: 'University of Lagos',
        subAddress: 'Akoka, Lagos',
        latLng: LatLng(6.5158, 3.3881),
      ),
    ];

    return allLocations
        .where((location) =>
            location.address.toLowerCase().contains(query.toLowerCase()) ||
            location.subAddress.toLowerCase().contains(query.toLowerCase()))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final isPickup = widget.searchType == 'pickup';
    
    return Container(
      height: MediaQuery.of(context).size.height * 0.8,
      decoration: const BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                IconButton(
                  onPressed: widget.onClose,
                  icon: const Icon(
                    Icons.arrow_back_ios,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isPickup ? 'Set Pickup Location' : 'Set Destination',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.backgroundSecondary,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: TextField(
                controller: _searchController,
                focusNode: _searchFocusNode,
                decoration: InputDecoration(
                  hintText: isPickup
                      ? 'Search pickup location...'
                      : 'Where are you going?',
                  hintStyle: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 16,
                  ),
                  prefixIcon: Icon(
                    Icons.search,
                    color: AppColors.textSecondary,
                  ),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          onPressed: () {
                            _searchController.clear();
                            _performSearch('');
                          },
                          icon: const Icon(
                            Icons.clear,
                            color: AppColors.textSecondary,
                          ),
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 16,
                  ),
                ),
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                ),
                onChanged: _performSearch,
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Current location option
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ListTile(
              leading: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.primaryBlue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.my_location,
                  color: AppColors.primaryBlue,
                  size: 20,
                ),
              ),
              title: const Text(
                'Use Current Location',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              subtitle: Text(
                'Victoria Island, Lagos',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                ),
              ),
              onTap: () {
                widget.onLocationSelected(
                  const LocationData(
                    address: 'Current Location',
                    subAddress: 'Victoria Island, Lagos',
                    latLng: LatLng(6.4281, 3.4219),
                  ),
                );
              },
            ),
          ),

          const Divider(color: AppColors.border, height: 1),

          // Results
          Expanded(
            child: _isSearching
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(
                        AppColors.primaryBlue,
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      if (_searchResults.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text(
                          'Search Results',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ..._searchResults
                            .map((location) => _LocationTile(
                                  location: location,
                                  onTap: () => widget.onLocationSelected(location),
                                ))
                            .toList(),
                      ] else if (_searchController.text.isEmpty) ...[
                        const SizedBox(height: 16),
                        Text(
                          'Recent Locations',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ..._recentLocations
                            .map((location) => _LocationTile(
                                  location: location,
                                  onTap: () => widget.onLocationSelected(location),
                                  showHistory: true,
                                ))
                            .toList(),
                      ] else if (_searchResults.isEmpty &&
                          _searchController.text.isNotEmpty) ...[
                        const SizedBox(height: 32),
                        Column(
                          children: [
                            Icon(
                              Icons.location_off_outlined,
                              size: 48,
                              color: AppColors.textTertiary,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No locations found',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Try searching with a different keyword',
                              style: TextStyle(
                                color: AppColors.textTertiary,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _LocationTile extends StatelessWidget {
  final LocationData location;
  final VoidCallback onTap;
  final bool showHistory;

  const _LocationTile({
    required this.location,
    required this.onTap,
    this.showHistory = false,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 4),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: showHistory
              ? AppColors.backgroundSecondary
              : AppColors.primaryBlue.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          showHistory ? Icons.history : Icons.location_on_outlined,
          color: showHistory ? AppColors.textSecondary : AppColors.primaryBlue,
          size: 20,
        ),
      ),
      title: Text(
        location.address,
        style: const TextStyle(
          color: AppColors.textPrimary,
          fontWeight: FontWeight.w500,
        ),
      ),
      subtitle: Text(
        location.subAddress,
        style: TextStyle(
          color: AppColors.textSecondary,
          fontSize: 12,
        ),
      ),
      onTap: onTap,
    );
  }
}