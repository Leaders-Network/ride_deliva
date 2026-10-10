import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:typed_data';
import '../../../../core/theme/app_colors.dart';
import 'step2_driver_license_screen.dart';

class RiderStep1PersonalInfoScreen extends StatefulWidget {
  const RiderStep1PersonalInfoScreen({super.key});

  @override
  State<RiderStep1PersonalInfoScreen> createState() =>
      _RiderStep1PersonalInfoScreenState();
}

class _RiderStep1PersonalInfoScreenState extends State<RiderStep1PersonalInfoScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _ninController = TextEditingController();
  
  XFile? _selfieImage;
  final _imagePicker = ImagePicker();

  @override
  void dispose() {
    _fullNameController.dispose();
    _dobController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _ninController.dispose();
    super.dispose();
  }

  Future<void> _takeSelfie() async {
    final image = await _imagePicker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 85,
    );
    if (image != null && mounted) {
      setState(() => _selfieImage = image);
    }
  }

  Future<void> _pickDateOfBirth() async {
    final now = DateTime.now();
    final eighteenYearsAgo = DateTime(now.year - 18, now.month, now.day);
    
    final date = await showDatePicker(
      context: context,
      initialDate: eighteenYearsAgo,
      firstDate: DateTime(1950),
      lastDate: eighteenYearsAgo,
      helpText: 'Select your date of birth',
    );
    
    if (date != null && mounted) {
      setState(() {
        _dobController.text = '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
      });
    }
  }

  void _continue() {
    if (_formKey.currentState?.validate() ?? false) {
      if (_selfieImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please take a selfie to continue'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => const RiderStep2DriverLicenseScreen(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Personal information'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  _buildProgressHeader(),
                  const SizedBox(height: 24),
                  _buildInfoBanner(),
                  const SizedBox(height: 24),
                  
                  // Full name
                  _buildLabel('Full name'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _fullNameController,
                    decoration: const InputDecoration(
                      hintText: 'Enter your full name',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your full name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // Date of birth
                  _buildLabel('Date of birth'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _dobController,
                    readOnly: true,
                    decoration: const InputDecoration(
                      hintText: 'Select date',
                      suffixIcon: Icon(Icons.calendar_today_outlined, size: 20),
                    ),
                    onTap: _pickDateOfBirth,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please select your date of birth';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // Email address
                  _buildLabel('Email address'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      hintText: 'your@email.com',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your email';
                      }
                      if (!value.contains('@')) {
                        return 'Please enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // Home address
                  _buildLabel('Home address'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _addressController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Enter your home address',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your home address';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // NIN
                  _buildLabel('NIN (National Identification Number)'),
                  const SizedBox(height: 4),
                  const Text(
                    'Used only to confirm your identity. Never shown to riders.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _ninController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      hintText: 'Enter your NIN',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your NIN';
                      }
                      if (value.length != 11) {
                        return 'NIN must be 11 digits';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),
                  
                  // Selfie check section
                  _buildSelfieSection(),
                  const SizedBox(height: 20),
                ],
              ),
            ),
            
            // Bottom button
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _continue,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Save and continue',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryAccent.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.primaryAccent.withOpacity(0.3),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primaryAccent,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Text(
              'Step 1 of 5',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const Spacer(),
          const Text(
            '20%',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.primaryAccent,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.info_outline_rounded,
            size: 22,
            color: AppColors.primaryAccent,
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Enter your details exactly as they appear on your government ID.',
              style: TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      ),
    );
  }

  Widget _buildSelfieSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _selfieImage != null 
              ? AppColors.primaryAccent 
              : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.camera_alt_outlined,
                size: 24,
                color: AppColors.primaryAccent,
              ),
              SizedBox(width: 12),
              Text(
                'Selfie check',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Face the camera in good light, no cap or glasses.',
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 20),
          
          if (_selfieImage == null)
            Center(
              child: Column(
                children: [
                  Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: AppColors.backgroundSecondary,
                      borderRadius: BorderRadius.circular(50),
                      border: Border.all(
                        color: AppColors.border,
                        width: 2,
                      ),
                    ),
                    child: const Icon(
                      Icons.person_outline_rounded,
                      size: 50,
                      color: AppColors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: 140,
                    child: ElevatedButton.icon(
                      onPressed: _takeSelfie,
                      icon: const Icon(Icons.camera_alt_outlined, size: 20),
                      label: const Text('Start'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            Center(
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: SizedBox(
                      width: 140,
                      height: 140,
                      child: FutureBuilder<Uint8List>(
                        future: _selfieImage!.readAsBytes(),
                        builder: (context, snapshot) {
                          if (!snapshot.hasData) {
                            return const Center(
                              child: CircularProgressIndicator(),
                            );
                          }
                          return Image.memory(
                            snapshot.data!,
                            fit: BoxFit.cover,
                          );
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: AppColors.success,
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Selfie captured',
                        style: TextStyle(
                          fontSize: 14,
                          color: AppColors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextButton.icon(
                    onPressed: _takeSelfie,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Retake'),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
