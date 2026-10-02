import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'dart:async';
import 'dart:math' as math;
import '../../../core/theme/app_colors.dart';
import '../../../core/models/location_data.dart';
import 'vehicle_selection_screen.dart';
import 'ride_confirmation_screen.dart';
import 'widgets/ride_status_sheet.dart';
import 'widgets/driver_info_card.dart';
import 'ride_completion_screen.dart';

class RideTrackingScreen extends StatefulWidget {
  final LocationData pickupLocation;
  final LocationData destinationLocation;
  final VehicleType vehicleType;
  final DriverInfo driver;

  const RideTrackingScreen({
    super.key,
    required this.pickupLocation,
    required this.destinationLocation,
    required this.vehicleType,
    required this.driver,
  });

  @override
  State<RideTrackingScreen> createState() => _RideTrackingScreenState();
}

class _RideTrackingScreenState extends State<RideTrackingScreen>
    with TickerProviderStateMixin {
  late GoogleMapController _mapController;
  final Completer<GoogleMapController> _controller = Completer();

  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};

  RideStatus _currentStatus = RideStatus.driverEnRoute;
  LatLng? _driverCurrentLocation;
  Timer? _driverLocationTimer;
  Timer? _statusTimer;

  double _progress = 0.0;
  String _estimatedTime = '3 mins';
  double _distanceRemaining = 5.2;

  late AnimationController _pulseController;
  late AnimationController _progressController;

  @override
  void initState() {
    super.initState();
    _initializeAnimations();
    _initializeMap();
    _startDriverLocationUpdates();
    _startStatusUpdates();
  }

  @override
  void dispose() {
    _driverLocationTimer?.cancel();
    _statusTimer?.cancel();
    _pulseController.dispose();
    _progressController.dispose();
    super.dispose();
  }

  void _initializeAnimations() {
    _pulseController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    )..repeat();

    _progressController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
  }

  void _initializeMap() {
    _driverCurrentLocation = _generateRandomNearbyLocation(
      widget.pickupLocation.latLng,
    );
    _updateMarkers();
    _drawRoute();
  }

  void _updateMarkers() {
    Set<Marker> markers = {};

    // Pickup location marker
    markers.add(
      Marker(
        markerId: const MarkerId('pickup'),
        position: widget.pickupLocation.latLng,
        infoWindow: InfoWindow(
          title: 'Pickup Location',
          snippet: widget.pickupLocation.address,
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
      ),
    );

    // Destination marker
    markers.add(
      Marker(
        markerId: const MarkerId('destination'),
        position: widget.destinationLocation.latLng,
        infoWindow: InfoWindow(
          title: 'Destination',
          snippet: widget.destinationLocation.address,
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
      ),
    );

    // Driver location marker
    if (_driverCurrentLocation != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('driver'),
          position: _driverCurrentLocation!,
          infoWindow: InfoWindow(
            title: widget.driver.name,
            snippet: widget.driver.vehicleModel,
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
        ),
      );
    }

    setState(() {
      _markers = markers;
    });
  }

  void _drawRoute() {
    // Create route polyline
    List<LatLng> routePoints = [];

    if (_driverCurrentLocation != null) {
      routePoints.add(_driverCurrentLocation!);
    }

    if (_currentStatus == RideStatus.driverEnRoute) {
      routePoints.add(widget.pickupLocation.latLng);
    } else {
      routePoints.add(widget.destinationLocation.latLng);
    }

    final polyline = Polyline(
      polylineId: const PolylineId('route'),
      color: AppColors.primaryBlue,
      width: 4,
      points: routePoints,
      patterns: _currentStatus == RideStatus.driverEnRoute
          ? [PatternItem.dash(20), PatternItem.gap(10)]
          : [],
    );

    setState(() {
      _polylines = {polyline};
    });
  }

  void _startDriverLocationUpdates() {
    _driverLocationTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (_currentStatus != RideStatus.completed &&
          _currentStatus != RideStatus.cancelled) {
        _updateDriverLocation();
      }
    });
  }

  void _startStatusUpdates() {
    _statusTimer = Timer(const Duration(seconds: 10), () {
      _updateRideStatus(RideStatus.driverArrived);
    });
  }

  void _updateDriverLocation() {
    if (_driverCurrentLocation == null) return;

    LatLng targetLocation = _currentStatus == RideStatus.driverEnRoute
        ? widget.pickupLocation.latLng
        : widget.destinationLocation.latLng;

    // Simulate driver moving towards target
    _driverCurrentLocation = _moveTowardsTarget(
      _driverCurrentLocation!,
      targetLocation,
      0.0005, // Movement step
    );

    _updateMarkers();
    _drawRoute();
    _updateProgress();
  }

  void _updateProgress() {
    if (_driverCurrentLocation == null) return;

    LatLng startLocation = _currentStatus == RideStatus.driverEnRoute
        ? widget.pickupLocation.latLng
        : widget.destinationLocation.latLng;

    double totalDistance = _calculateDistance(
      _driverCurrentLocation!,
      startLocation,
    );

    setState(() {
      _progress = 1.0 - (totalDistance / 0.01); // Normalize progress
      _progress = _progress.clamp(0.0, 1.0);
      _distanceRemaining = totalDistance * 111; // Convert to approximate km
      _estimatedTime =
          '${(_distanceRemaining / 0.5).ceil()} mins'; // Rough estimate
    });

    _progressController.animateTo(_progress);
  }

  void _updateRideStatus(RideStatus newStatus) {
    setState(() {
      _currentStatus = newStatus;
    });

    switch (newStatus) {
      case RideStatus.driverArrived:
        _statusTimer = Timer(const Duration(seconds: 5), () {
          _updateRideStatus(RideStatus.inProgress);
        });
        break;
      case RideStatus.inProgress:
        _statusTimer = Timer(const Duration(seconds: 15), () {
          _updateRideStatus(RideStatus.nearingDestination);
        });
        break;
      case RideStatus.nearingDestination:
        _statusTimer = Timer(const Duration(seconds: 8), () {
          _updateRideStatus(RideStatus.completed);
        });
        break;
      case RideStatus.completed:
        _navigateToCompletion();
        break;
      default:
        break;
    }

    _drawRoute();
  }

  void _navigateToCompletion() {
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (context) => RideCompletionScreen(
              pickupLocation: widget.pickupLocation,
              destinationLocation: widget.destinationLocation,
              vehicleType: widget.vehicleType,
              driver: widget.driver,
              tripDuration: '12 mins',
              totalFare: widget.vehicleType.price,
            ),
          ),
        );
      }
    });
  }

  LatLng _generateRandomNearbyLocation(LatLng center) {
    final random = math.Random();
    final latOffset = (random.nextDouble() - 0.5) * 0.01;
    final lngOffset = (random.nextDouble() - 0.5) * 0.01;

    return LatLng(center.latitude + latOffset, center.longitude + lngOffset);
  }

  LatLng _moveTowardsTarget(LatLng current, LatLng target, double step) {
    final latDiff = target.latitude - current.latitude;
    final lngDiff = target.longitude - current.longitude;

    final distance = math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

    if (distance <= step) {
      return target;
    }

    final ratio = step / distance;

    return LatLng(
      current.latitude + (latDiff * ratio),
      current.longitude + (lngDiff * ratio),
    );
  }

  double _calculateDistance(LatLng point1, LatLng point2) {
    final latDiff = point1.latitude - point2.latitude;
    final lngDiff = point1.longitude - point2.longitude;
    return math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  }

  void _centerMapOnDriver() {
    if (_driverCurrentLocation != null) {
      _mapController.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: _driverCurrentLocation!, zoom: 16.0),
        ),
      );
    }
  }

  void _showFullRoute() {
    if (_driverCurrentLocation != null) {
      final bounds = LatLngBounds(
        southwest: LatLng(
          math.min(
            _driverCurrentLocation!.latitude,
            widget.destinationLocation.latLng.latitude,
          ),
          math.min(
            _driverCurrentLocation!.longitude,
            widget.destinationLocation.latLng.longitude,
          ),
        ),
        northeast: LatLng(
          math.max(
            _driverCurrentLocation!.latitude,
            widget.destinationLocation.latLng.latitude,
          ),
          math.max(
            _driverCurrentLocation!.longitude,
            widget.destinationLocation.latLng.longitude,
          ),
        ),
      );

      _mapController.animateCamera(CameraUpdate.newLatLngBounds(bounds, 100.0));
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
            initialCameraPosition: CameraPosition(
              target: widget.pickupLocation.latLng,
              zoom: 14.0,
            ),
            onMapCreated: (GoogleMapController controller) {
              _controller.complete(controller);
              _mapController = controller;
              _showFullRoute();
            },
            markers: _markers,
            polylines: _polylines,
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
          ),

          // Top status bar
          SafeArea(
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
              child: Row(
                children: [
                  Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _getStatusColor(_currentStatus),
                          shape: BoxShape.circle,
                        ),
                      )
                      .animate(controller: _pulseController)
                      .scale(
                        begin: const Offset(1.0, 1.0),
                        end: const Offset(1.3, 1.3),
                      )
                      .then()
                      .scale(
                        begin: const Offset(1.3, 1.3),
                        end: const Offset(1.0, 1.0),
                      ),

                  const SizedBox(width: 8),

                  Expanded(
                    child: Text(
                      _getStatusText(_currentStatus),
                      style: TextStyle(
                        color: _getStatusColor(_currentStatus),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),

                  Text(
                    _estimatedTime,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 600.ms).slideY(begin: -0.5, end: 0),
          ),

          // Map controls
          Positioned(
            bottom: 200,
            right: 16,
            child:
                Column(
                      children: [
                        FloatingActionButton(
                          mini: true,
                          backgroundColor: AppColors.backgroundCard,
                          foregroundColor: AppColors.textPrimary,
                          onPressed: _centerMapOnDriver,
                          heroTag: "center_driver",
                          child: const Icon(Icons.my_location),
                        ),
                        const SizedBox(height: 8),
                        FloatingActionButton(
                          mini: true,
                          backgroundColor: AppColors.backgroundCard,
                          foregroundColor: AppColors.textPrimary,
                          onPressed: _showFullRoute,
                          heroTag: "show_route",
                          child: const Icon(Icons.route),
                        ),
                      ],
                    )
                    .animate()
                    .fadeIn(delay: 400.ms, duration: 600.ms)
                    .scale(
                      begin: const Offset(0.8, 0.8),
                      end: const Offset(1.0, 1.0),
                    ),
          ),

          // Driver info card (when driver is en route)
          if (_currentStatus == RideStatus.driverEnRoute)
            Positioned(
              top: 100,
              left: 16,
              right: 16,
              child:
                  DriverInfoCard(
                        driver: widget.driver,
                        vehicleType: widget.vehicleType,
                        estimatedArrival: _estimatedTime,
                        onCall: () {
                          // TODO: Call driver
                        },
                        onMessage: () {
                          // TODO: Message driver
                        },
                      )
                      .animate()
                      .fadeIn(delay: 600.ms, duration: 600.ms)
                      .slideY(begin: -0.3, end: 0),
            ),

          // Bottom sheet with ride status
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child:
                RideStatusSheet(
                      status: _currentStatus,
                      progress: _progress,
                      pickupLocation: widget.pickupLocation,
                      destinationLocation: widget.destinationLocation,
                      driver: widget.driver,
                      vehicleType: widget.vehicleType,
                      estimatedTime: _estimatedTime,
                      distanceRemaining: _distanceRemaining,
                      onCancel: () {
                        setState(() {
                          _currentStatus = RideStatus.cancelled;
                        });
                        Navigator.of(
                          context,
                        ).popUntil((route) => route.isFirst);
                      },
                      onEmergency: () {
                        // TODO: Handle emergency
                      },
                    )
                    .animate()
                    .fadeIn(delay: 800.ms, duration: 600.ms)
                    .slideY(begin: 1, end: 0),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(RideStatus status) {
    switch (status) {
      case RideStatus.driverEnRoute:
        return AppColors.primaryBlue;
      case RideStatus.driverArrived:
        return AppColors.success;
      case RideStatus.inProgress:
        return AppColors.warning;
      case RideStatus.nearingDestination:
        return AppColors.info;
      case RideStatus.completed:
        return AppColors.success;
      case RideStatus.cancelled:
        return AppColors.error;
    }
  }

  String _getStatusText(RideStatus status) {
    switch (status) {
      case RideStatus.driverEnRoute:
        return 'Driver is on the way';
      case RideStatus.driverArrived:
        return 'Driver has arrived';
      case RideStatus.inProgress:
        return 'Trip in progress';
      case RideStatus.nearingDestination:
        return 'Nearing destination';
      case RideStatus.completed:
        return 'Trip completed';
      case RideStatus.cancelled:
        return 'Trip cancelled';
    }
  }
}

enum RideStatus {
  driverEnRoute,
  driverArrived,
  inProgress,
  nearingDestination,
  completed,
  cancelled,
}

