import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'dart:async';
import '../../../core/theme/app_colors.dart';
import '../../../core/constants/app_constants.dart';
import 'widgets/location_search_sheet.dart';
import 'widgets/ride_booking_bottom_sheet.dart';
import 'vehicle_selection_screen.dart';

class RideBookingScreen extends StatefulWidget {
  const RideBookingScreen({super.key});

  @override
  State<RideBookingScreen> createState() => _RideBookingScreenState();
}

class _RideBookingScreenState extends State<RideBookingScreen> {
  late GoogleMapController _mapController;
  final Completer<GoogleMapController> _controller = Completer();
  
  // Default location (Lagos, Nigeria)
  static const CameraPosition _defaultLocation = CameraPosition(
    target: LatLng(6.5244, 3.3792),
    zoom: 14.0,
  );

  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};
  
  LocationData? _pickupLocation;
  LocationData? _destinationLocation;
  bool _isLoadingRoute = false;
  bool _showLocationSearch = false;
  String _searchType = 'pickup'; // 'pickup' or 'destination'

  @override
  void initState() {
    super.initState();
    _initializeMap();
  }

  void _initializeMap() {
    // Set default pickup location
    _pickupLocation = LocationData(
      address: 'Victoria Island, Lagos',
      subAddress: 'Near Civic Centre',
      latLng: const LatLng(6.4281, 3.4219),
    );
    _updateMarkers();
  }

  void _updateMarkers() {
    Set<Marker> markers = {};

    if (_pickupLocation != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('pickup'),
          position: _pickupLocation!.latLng,
          infoWindow: InfoWindow(
            title: 'Pickup Location',
            snippet: _pickupLocation!.address,
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        ),
      );
    }

    if (_destinationLocation != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('destination'),
          position: _destinationLocation!.latLng,
          infoWindow: InfoWindow(
            title: 'Destination',
            snippet: _destinationLocation!.address,
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        ),
      );
    }

    setState(() {
      _markers = markers;
    });

    _updateMapCamera();
  }

  void _updateMapCamera() {
    if (_pickupLocation != null && _destinationLocation != null) {
      _fitMarkersInCamera();
    } else if (_pickupLocation != null) {
      _animateToLocation(_pickupLocation!.latLng);
    }
  }

  void _animateToLocation(LatLng location) {
    _mapController.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: location, zoom: 16.0),
      ),
    );
  }

  void _fitMarkersInCamera() {
    if (_pickupLocation != null && _destinationLocation != null) {
      LatLngBounds bounds = LatLngBounds(
        southwest: LatLng(
          _pickupLocation!.latLng.latitude < _destinationLocation!.latLng.latitude
              ? _pickupLocation!.latLng.latitude
              : _destinationLocation!.latLng.latitude,
          _pickupLocation!.latLng.longitude < _destinationLocation!.latLng.longitude
              ? _pickupLocation!.latLng.longitude
              : _destinationLocation!.latLng.longitude,
        ),
        northeast: LatLng(
          _pickupLocation!.latLng.latitude > _destinationLocation!.latLng.latitude
              ? _pickupLocation!.latLng.latitude
              : _destinationLocation!.latLng.latitude,
          _pickupLocation!.latLng.longitude > _destinationLocation!.latLng.longitude
              ? _pickupLocation!.latLng.longitude
              : _destinationLocation!.latLng.longitude,
        ),
      );

      _mapController.animateCamera(
        CameraUpdate.newLatLngBounds(bounds, 100.0),
      );
      
      _drawRoute();
    }
  }

  void _drawRoute() {
    if (_pickupLocation != null && _destinationLocation != null) {
      setState(() {
        _isLoadingRoute = true;
      });

      // Simulate route drawing (in real app, use Google Directions API)
      Future.delayed(const Duration(seconds: 1), () {
        final polyline = Polyline(
          polylineId: const PolylineId('route'),
          color: AppColors.primaryBlue,
          width: 4,
          points: [
            _pickupLocation!.latLng,
            _destinationLocation!.latLng,
          ],
        );

        setState(() {
          _polylines = {polyline};
          _isLoadingRoute = false;
        });
      });
    }
  }

  void _showLocationSearch(String type) {
    setState(() {
      _searchType = type;
      _showLocationSearch = true;
    });
  }

  void _onLocationSelected(LocationData location) {
    setState(() {
      if (_searchType == 'pickup') {
        _pickupLocation = location;
      } else {
        _destinationLocation = location;
      }
      _showLocationSearch = false;
    });
    
    _updateMarkers();
  }

  void _proceedToVehicleSelection() {
    if (_pickupLocation != null && _destinationLocation != null) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => VehicleSelectionScreen(
            pickupLocation: _pickupLocation!,
            destinationLocation: _destinationLocation!,
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select both pickup and destination locations'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Google Map
          GoogleMap(
            mapType: MapType.normal,
            initialCameraPosition: _defaultLocation,
            onMapCreated: (GoogleMapController controller) {
              _controller.complete(controller);
              _mapController = controller;
            },
            markers: _markers,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),

          // App Bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.backgroundCard,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(
                        Icons.arrow_back_ios,
                        color: AppColors.textPrimary,
                        size: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
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
                            color: Colors.black.withOpacity(0.1),
                            blurRadius: 10,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: const Text(
                        'Book a Ride',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                ],
              )
                  .animate()
                  .fadeIn(duration: 600.ms)
                  .slideY(begin: -0.5, end: 0),
            ),
          ),

          // My Location Button
          Positioned(
            bottom: 200,
            right: 16,
            child: FloatingActionButton(
              mini: true,
              backgroundColor: AppColors.backgroundCard,
              foregroundColor: AppColors.textPrimary,
              onPressed: () {
                // TODO: Get current location and animate to it
                _animateToLocation(_defaultLocation.target);
              },
              child: const Icon(Icons.my_location),
            )
                .animate()
                .fadeIn(delay: 400.ms, duration: 600.ms)
                .scale(begin: 0.8, end: 1.0),
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
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.primaryBlue,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Finding best route...',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              )
                  .animate()
                  .fadeIn(duration: 300.ms)
                  .slideY(begin: -0.3, end: 0),
            ),

          // Bottom Sheet
          if (!_showLocationSearch)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: RideBookingBottomSheet(
                pickupLocation: _pickupLocation,
                destinationLocation: _destinationLocation,
                onPickupTap: () => _showLocationSearch('pickup'),
                onDestinationTap: () => _showLocationSearch('destination'),
                onProceed: _proceedToVehicleSelection,
              )
                  .animate()
                  .fadeIn(delay: 600.ms, duration: 600.ms)
                  .slideY(begin: 1, end: 0),
            ),

          // Location Search Sheet
          if (_showLocationSearch)
            LocationSearchSheet(
              searchType: _searchType,
              onLocationSelected: _onLocationSelected,
              onClose: () => setState(() => _showLocationSearch = false),
            )
                .animate()
                .fadeIn(duration: 300.ms)
                .slideY(begin: 1, end: 0),
        ],
      ),
    );
  }
}

class LocationData {
  final String address;
  final String subAddress;
  final LatLng latLng;

  const LocationData({
    required this.address,
    required this.subAddress,
    required this.latLng,
  });
}