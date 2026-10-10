import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:typed_data';
import '../../../../core/theme/app_colors.dart';
import 'step3_vehicle_docs_screen.dart';

class RiderStep2DriverLicenseScreen extends StatefulWidget {
  const RiderStep2DriverLicenseScreen({super.key});

  @override
  State<RiderStep2DriverLicenseScreen> createState() =>
      _RiderStep2DriverLicenseScreenState();
}

class _RiderStep2DriverLicenseScreenState extends State<RiderStep2DriverLicenseScreen> {
  final _formKey = GlobalKey<FormState>();
  final _licenseNumberController = TextEditingController();
  final _expiryDateController = TextEditingController();
  
  XFile? _licenseFrontImage;
  XFile? _licenseBackImage;
  final _imagePicker = ImagePicker();

  @override
  void dispose() {
    _licenseNumberController.dispose();
    _expiryDateController.dispose();
    super.dispose();
  }

  Future<void> _pickImage({required bool isFront}) async {
    final source = await _showImageSourceDialog();
    if (source == null) return;

    final image = await _imagePicker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1800,
    );
    
    if (image != null && mounted) {
      setState(() {
        if (isFront) {
          _licenseFrontImage = image;
        } else {
          _licenseBackImage = image;
        }
      });
    }
  }

  Future<ImageSource?> _showImageSourceDialog() async {
    return showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: AppColors.backgroundCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Choose photo source',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined, color: AppColors.primaryAccent),
                title: const Text('Take photo'),
                onTap: () => Navigator.pop(context, ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined, color: AppColors.primaryAccent),
                title: const Text('Gallery'),
                onTap: () => Navigator.pop(context, ImageSource.gallery),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickExpiryDate() async {
    final now = DateTime.now();
    
    final date = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now,
      lastDate: DateTime(now.year + 10),
      helpText: 'Select license expiry date',
    );
    
    if (date != null && mounted) {
      setState(() {
        _expiryDateController.text = '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
      });
    }
  }

  void _continue() {
    if (_formKey.currentState?.validate() ?? false) {
      if (_licenseFrontImage == null || _licenseBackImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please upload both sides of your license'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => const RiderStep3VehicleDocsScreen(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Driver license'),
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
                  
                  // Photo section
                  _buildLabel('Photo'),
                  const SizedBox(height: 4),
                  const Text(
                    'preview',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // License front
                  _buildPhotoCard(
                    title: 'License, front',
                    status: _licenseFrontImage != null ? 'Uploaded' : 'Required',
                    image: _licenseFrontImage,
                    onTap: () => _pickImage(isFront: true),
                    onRetake: _licenseFrontImage != null 
                        ? () => _pickImage(isFront: true)
                        : null,
                  ),
                  const SizedBox(height: 16),
                  
                  // License back
                  _buildPhotoCard(
                    title: 'License, back',
                    status: _licenseBackImage != null ? 'Uploaded' : 'Required',
                    image: _licenseBackImage,
                    onTap: () => _pickImage(isFront: false),
                    onRetake: _licenseBackImage != null 
                        ? () => _pickImage(isFront: false)
                        : null,
                  ),
                  const SizedBox(height: 24),
                  
                  // License number
                  _buildLabel('License number'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _licenseNumberController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      hintText: 'Enter license number',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your license number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // Expiry date
                  _buildLabel('Expiry date'),
                  const SizedBox(height: 4),
                  const Text(
                    'We reject expired licenses and will remind you before yours expires.',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textTertiary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _expiryDateController,
                    readOnly: true,
                    decoration: const InputDecoration(
                      hintText: 'Select expiry date',
                      suffixIcon: Icon(Icons.calendar_today_outlined, size: 20),
                    ),
                    onTap: _pickExpiryDate,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Please select the expiry date';
                      }
                      return null;
                    },
                  ),
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
              'Step 2 of 5',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const Spacer(),
          const Text(
            '40%',
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
              'Photograph both sides of a valid Nigerian driver license. The photo, name and expiry date must be readable.',
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

  Widget _buildPhotoCard({
    required String title,
    required String status,
    required XFile? image,
    required VoidCallback onTap,
    VoidCallback? onRetake,
  }) {
    final isUploaded = image != null;
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUploaded ? AppColors.primaryAccent : AppColors.border,
          width: isUploaded ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        if (isUploaded)
                          const Icon(
                            Icons.check_circle_rounded,
                            size: 16,
                            color: AppColors.success,
                          )
                        else
                          Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.error,
                                width: 2,
                              ),
                            ),
                          ),
                        const SizedBox(width: 8),
                        Text(
                          status,
                          style: TextStyle(
                            fontSize: 12,
                            color: isUploaded 
                                ? AppColors.success 
                                : AppColors.error,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (isUploaded && onRetake != null)
                OutlinedButton(
                  onPressed: onRetake,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: const BorderSide(color: AppColors.border),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 10,
                    ),
                    minimumSize: Size.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Retake',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
            ],
          ),
          
          if (isUploaded) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: double.infinity,
                height: 180,
                child: FutureBuilder<Uint8List>(
                  future: image.readAsBytes(),
                  builder: (context, snapshot) {
                    if (!snapshot.hasData) {
                      return const ColoredBox(
                        color: AppColors.backgroundSecondary,
                        child: Center(
                          child: CircularProgressIndicator(),
                        ),
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
          ] else ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.camera_alt_outlined, size: 20),
                    label: const Text('Take photo'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primaryAccent,
                      side: const BorderSide(color: AppColors.primaryAccent),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onTap,
                    icon: const Icon(Icons.photo_library_outlined, size: 20),
                    label: const Text('Gallery'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
