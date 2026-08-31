import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/constants/app_constants.dart';
import '../home/home_screen.dart';

enum PermissionType {
  location,
  notifications,
  camera,
}

class PermissionsScreen extends StatefulWidget {
  const PermissionsScreen({super.key});

  @override
  State<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends State<PermissionsScreen> {
  int _currentPermissionIndex = 0;
  bool _isLoading = false;

  final List<PermissionInfo> _permissions = [
    PermissionInfo(
      type: PermissionType.location,
      icon: Icons.location_on_outlined,
      title: 'Enable Location Access',
      description: 'Ride Deliva uses your location to search you with nearby drivers and provide accurate live tracking.',
      benefits: [
        'Find pickup locations',
        'Get accurate live tracking',
        'Discover nearby services',
      ],
      permission: Permission.locationWhenInUse,
    ),
    PermissionInfo(
      type: PermissionType.notifications,
      icon: Icons.notifications_outlined,
      title: 'Enable Notifications',
      description: 'Get real-time updates about your rides, deliveries, and important account information.',
      benefits: [
        'Trip ride and delivery updates',
        'Driver arrival notifications',
        'Promotional offers',
      ],
      permission: Permission.notification,
    ),
    PermissionInfo(
      type: PermissionType.camera,
      icon: Icons.camera_alt_outlined,
      title: 'Camera Access',
      description: 'Use your camera for profile photos, delivery confirmations, and identity verification.',
      benefits: [
        'Set document and package photos',
        'Update profile picture',
        'Verify deliveries',
      ],
      permission: Permission.camera,
    ),
  ];

  PermissionInfo get _currentPermission => _permissions[_currentPermissionIndex];

  Future<void> _requestPermission() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final permission = _currentPermission.permission;
      final status = await permission.request();

      if (status.isGranted) {
        _moveToNextPermission();
      } else if (status.isDenied) {
        _showPermissionDialog();
      } else if (status.isPermanentlyDenied) {
        _showSettingsDialog();
      }
    } catch (e) {
      _showErrorSnackBar('Failed to request permission. Please try again.');
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _moveToNextPermission() {
    if (_currentPermissionIndex < _permissions.length - 1) {
      setState(() {
        _currentPermissionIndex++;
      });
    } else {
      _navigateToHome();
    }
  }

  void _skipPermission() {
    _moveToNextPermission();
  }

  void _skipAll() {
    _navigateToHome();
  }

  void _navigateToHome() {
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => 
          const HomeScreen(),
        transitionDuration: const Duration(milliseconds: 500),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          const curve = Curves.easeInOut;

          var tween = Tween(begin: begin, end: end)
              .chain(CurveTween(curve: curve));

          return SlideTransition(
            position: animation.drive(tween),
            child: child,
          );
        },
      ),
    );
  }

  void _showPermissionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Permission Required'),
        content: Text(
          'This permission is important for the best experience. You can enable it in settings later.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _skipPermission();
            },
            child: const Text('Skip'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _requestPermission();
            },
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  void _showSettingsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Permission Denied'),
        content: const Text(
          'This permission has been permanently denied. Please enable it in app settings for the best experience.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _skipPermission();
            },
            child: const Text('Skip'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              openAppSettings();
            },
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppColors.error,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.backgroundDark,
              AppColors.backgroundCard,
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // Header with skip all button
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Screen ${_currentPermissionIndex + 3}',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    TextButton(
                      onPressed: _skipAll,
                      child: const Text(
                        'Not Now',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 32),

                // Progress indicator
                LinearProgressIndicator(
                  value: (_currentPermissionIndex + 1) / _permissions.length,
                  backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    AppColors.primaryBlue,
                  ),
                )
                    .animate()
                    .fadeIn(duration: 400.ms),

                const Spacer(),

                // Permission content
                Column(
                  children: [
                    // Icon
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [
                            AppColors.primaryBlue.withOpacity(0.1),
                            AppColors.primaryBlue.withOpacity(0.05),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        border: Border.all(
                          color: AppColors.primaryBlue.withOpacity(0.3),
                          width: 2,
                        ),
                      ),
                      child: Icon(
                        _currentPermission.icon,
                        size: 60,
                        color: AppColors.primaryBlue,
                      ),
                    )
                        .animate()
                        .scale(duration: 600.ms, curve: Curves.elasticOut)
                        .then()
                        .shimmer(
                          duration: 2000.ms,
                          color: AppColors.primaryBlue.withOpacity(0.1),
                        ),

                    const SizedBox(height: 32),

                    // Title
                    Text(
                      _currentPermission.title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    )
                        .animate()
                        .fadeIn(delay: 200.ms, duration: 600.ms)
                        .slideY(begin: 0.3, end: 0),

                    const SizedBox(height: 16),

                    // Description
                    Text(
                      _currentPermission.description,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    )
                        .animate()
                        .fadeIn(delay: 400.ms, duration: 600.ms)
                        .slideY(begin: 0.2, end: 0),

                    const SizedBox(height: 32),

                    // Benefits list
                    Column(
                      children: _currentPermission.benefits
                          .asMap()
                          .entries
                          .map((entry) {
                        final index = entry.key;
                        final benefit = entry.value;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Row(
                            children: [
                              Container(
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.primaryBlue.withOpacity(0.1),
                                  border: Border.all(
                                    color: AppColors.primaryBlue,
                                    width: 1,
                                  ),
                                ),
                                child: const Icon(
                                  Icons.check,
                                  size: 14,
                                  color: AppColors.primaryBlue,
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Text(
                                  benefit,
                                  style: TextStyle(
                                    fontSize: 16,
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      })
                          .toList()
                          .animate(interval: 100.ms)
                          .fadeIn(delay: 600.ms, duration: 400.ms)
                          .slideX(begin: -0.2, end: 0),
                    ),
                  ],
                ),

                const Spacer(),

                // Action buttons
                Column(
                  children: [
                    // Allow button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _requestPermission,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primaryBlue,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 2,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    Colors.white,
                                  ),
                                ),
                              )
                            : const Text(
                                'Allow & Continue',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Skip button
                    SizedBox(
                      width: double.infinity,
                      child: TextButton(
                        onPressed: _skipPermission,
                        child: const Text(
                          'Not Now',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ],
                )
                    .animate()
                    .fadeIn(delay: 800.ms, duration: 600.ms)
                    .slideY(begin: 0.3, end: 0),

                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class PermissionInfo {
  final PermissionType type;
  final IconData icon;
  final String title;
  final String description;
  final List<String> benefits;
  final Permission permission;

  const PermissionInfo({
    required this.type,
    required this.icon,
    required this.title,
    required this.description,
    required this.benefits,
    required this.permission,
  });
}