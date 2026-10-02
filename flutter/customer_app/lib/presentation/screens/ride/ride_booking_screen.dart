import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/models/location_data.dart';
import 'widgets/location_search_sheet.dart';
import 'widgets/ride_booking_bottom_sheet.dart';
import 'vehicle_selection_screen.dart';

class RideBookingScreen extends StatefulWidget {
  const RideBookingScreen({super.key});

  @override
  State<RideBookingScreen> createState() => _RideBookingScreenState();
}

class _RideBookingScreenState extends State<RideBookingScreen>
    with TickerProviderStateMixin {
  LocationData? _pickupLocation;
  LocationData? _destinationLocation;
  final bool _isLoadingRoute = false;
  bool _isShowingLocationSearch = false;
  String _searchType = 'pickup'; // 'pickup' or 'destination'

  final Set<Marker> _markers = {};
  final Set<Polyline> _polylines = {};

  @override
  void initState() {
    super.initState();
    _initializeMap();
  }

  void _initializeMap() {
    // Initialize with current location or default
    _pickupLocation = const LocationData(
      address: "Current Location",
      latitude: 6.5244, // Lagos coordinates as default
      longitude: 3.3792,
    );

    _updateMarkers();
  }

  void _updateMarkers() {
    setState(() {
      _markers.clear();

      if (_pickupLocation != null) {
        _markers.add(
          Marker(
            markerId: const MarkerId('pickup'),
            position: LatLng(
              _pickupLocation!.latitude,
              _pickupLocation!.longitude,
            ),
            infoWindow: InfoWindow(title: _pickupLocation!.address),
          ),
        );
      }

      if (_destinationLocation != null) {
        _markers.add(
          Marker(
            markerId: const MarkerId('destination'),
            position: LatLng(
              _destinationLocation!.latitude,
              _destinationLocation!.longitude,
            ),
            infoWindow: InfoWindow(title: _destinationLocation!.address),
          ),
        );
      }
    });
  }

  void _showLocationSearch(String type) {
    setState(() {
      _searchType = type;
      _isShowingLocationSearch = true;
    });
  }

  void _onLocationSelected(LocationData location) {
    setState(() {
      if (_searchType == 'pickup') {
        _pickupLocation = location;
      } else {
        _destinationLocation = location;
      }
      _isShowingLocationSearch = false;
    });

    _updateMarkers();
  }

  void _proceedToVehicleSelection() {
    if (_pickupLocation != null && _destinationLocation != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VehicleSelectionScreen(
            pickupLocation: _pickupLocation!,
            destinationLocation: _destinationLocation!,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Google Maps
          GoogleMap(
            initialCameraPosition: const CameraPosition(
              target: LatLng(6.5244, 3.3792), // Lagos coordinates
              zoom: 14,
            ),
            markers: _markers,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),

          // Top App Bar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 8,
                left: 16,
                right: 16,
                bottom: 16,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    AppColors.backgroundDark,
                    AppColors.backgroundDark.withValues(alpha: 0.8),
                    Colors.transparent,
                  ],
                ),
              ),
              child: Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.backgroundCard,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(
                        Icons.arrow_back,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.backgroundCard,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 10,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'Book a Ride',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 600.ms).slideY(begin: -0.5, end: 0),
          ),

          // Loading Route Indicator
          if (_isLoadingRoute)
            Positioned(
              top: 100,
              left: 16,
              right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.backgroundCard,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: const Row(
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.primaryBlue,
                        ),
                      ),
                    ),
                    SizedBox(width: 12),
                    Text(
                      'Finding best route...',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(duration: 300.ms).slideY(begin: -0.3, end: 0),
            ),

          // Bottom Sheet
          if (!_isShowingLocationSearch)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child:
                  RideBookingBottomSheet(
                        pickupLocation: _pickupLocation,
                        destinationLocation: _destinationLocation,
                        onPickupTap: () => _showLocationSearch('pickup'),
                        onDestinationTap: () =>
                            _showLocationSearch('destination'),
                        onProceed: _proceedToVehicleSelection,
                      )
                      .animate()
                      .fadeIn(delay: 600.ms, duration: 600.ms)
                      .slideY(begin: 1, end: 0),
            ),

          // Location Search Sheet
          if (_isShowingLocationSearch)
            LocationSearchSheet(
              searchType: _searchType,
              onLocationSelected: _onLocationSelected,
              onClose: () => setState(() => _isShowingLocationSearch = false),
            ).animate().fadeIn(duration: 300.ms).slideY(begin: 1, end: 0),
        ],
      ),
    );
  }
}
