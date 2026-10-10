import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:typed_data';
import '../../../../core/theme/app_colors.dart';
import 'step4_background_check_screen.dart';

class RiderStep3VehicleDocsScreen extends StatefulWidget {
  const RiderStep3VehicleDocsScreen({super.key});

  @override
  State<RiderStep3VehicleDocsScreen> createState() => _RiderStep3VehicleDocsScreenState();
}

class _RiderStep3VehicleDocsScreenState extends State<RiderStep3VehicleDocsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _plateNumberController = TextEditingController();
  final _makeModelController = TextEditingController();
  final _yearController = TextEditingController();
  final _colorController = TextEditingController();
  
  XFile? _registrationImage;
  XFile? _insuranceImage;
  XFile? _roadworthinessImage;
  XFile? _ownershipImage;
  final List<XFile> _vehiclePhotos = [];
  
  final _imagePicker = ImagePicker();

  @override
  void dispose() {
    _plateNumberController.dispose();
    _makeModelController.dispose();
    _yearController.dispose();
    _colorController.dispose();
    super.dispose();
  }

  Future<void> _pickDocument(String docType) async {
    final source = await _showImageSourceDialog();
    if (source == null) return;

    final image = await _imagePicker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1800,
    );
    
    if (image != null && mounted) {
      setState(() {
        switch (docType) {
          case 'registration':
            _registrationImage = image;
            break;
          case 'insurance':
            _insuranceImage = image;
            break;
          case 'roadworthiness':
            _roadworthinessImage = image;
            break;
          case 'ownership':
            _ownershipImage = image;
            break;
        }
      });
    }
  }

  Future<void> _pickVehiclePhotos() async {
    final images = await _imagePicker.pickMultiImage(
      imageQuality: 85,
      maxWidth: 1800,
    );
    
    if (images.isNotEmpty && mounted) {
      setState(() {
        _vehiclePhotos.addAll(images);
        if (_vehiclePhotos.length > 4) {
          _vehiclePhotos.removeRange(4, _vehiclePhotos.length);
        }
      });
    }
  }

  void _removeVehiclePhoto(int index) {
    setState(() {
      _vehiclePhotos.removeAt(index);
    });
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

  void _continue() {
    if (_formKey.currentState?.validate() ?? false) {
      if (_registrationImage == null || _insuranceImage == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please upload vehicle registration and insurance'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }
      
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (context) => const RiderStep4BackgroundCheckScreen(),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Vehicle documents'),
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
                  
                  // Plate number
                  _buildLabel('Plate number'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _plateNumberController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: const InputDecoration(
                      hintText: 'e.g., ABC-123-XY',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter plate number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // Make and model
                  _buildLabel('Make and model'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _makeModelController,
                    decoration: const InputDecoration(
                      hintText: 'e.g., Toyota Corolla',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter make and model';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 20),
                  
                  // Year and Color
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildLabel('Year'),
                            const SizedBox(height: 8),
                            TextFormField(
                              controller: _yearController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                hintText: '2020',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Required';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildLabel('Colour'),
                            const SizedBox(height: 8),
                            TextFormField(
                              controller: _colorController,
                              decoration: const InputDecoration(
                                hintText: 'Black',
                              ),
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Required';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  
                  // Vehicle registration
                  _buildDocumentCard(
                    title: 'Vehicle registration',
                    subtitle: 'Vehicle license papers',
                    image: _registrationImage,
                    onTap: () => _pickDocument('registration'),
                  ),
                  const SizedBox(height: 16),
                  
                  // Insurance certificate
                  _buildDocumentCard(
                    title: 'Insurance certificate',
                    subtitle: 'Valid and in your name or the owner\'s',
                    image: _insuranceImage,
                    onTap: () => _pickDocument('insurance'),
                  ),
                  const SizedBox(height: 16),
                  
                  // Roadworthiness certificate
                  _buildDocumentCard(
                    title: 'Roadworthiness certificate',
                    subtitle: 'Current road worthiness',
                    image: _roadworthinessImage,
                    onTap: () => _pickDocument('roadworthiness'),
                    isRequired: false,
                  ),
                  const SizedBox(height: 16),
                  
                  // Proof of ownership
                  _buildDocumentCard(
                    title: 'Proof of ownership',
                    subtitle: 'Or a letter from the owner',
                    image: _ownershipImage,
                    onTap: () => _pickDocument('ownership'),
                    isRequired: false,
                  ),
                  const SizedBox(height: 24),
                  
                  // Vehicle photos
                  _buildVehiclePhotosSection(),
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
                      'Submit for review',
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
              'Step 3 of 5',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const Spacer(),
          const Text(
            '60%',
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

  Widget _buildDocumentCard({
    required String title,
    required String subtitle,
    required XFile? image,
    required VoidCallback onTap,
    bool isRequired = true,
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
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (isUploaded)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        size: 14,
                        color: AppColors.success,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Uploaded',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (!isUploaded)
            OutlinedButton.icon(
              onPressed: onTap,
              icon: const Icon(Icons.add_photo_alternate_outlined, size: 20),
              label: const Text('Add'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryAccent,
                side: const BorderSide(color: AppColors.primaryAccent),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            )
          else
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 80,
                    height: 80,
                    child: FutureBuilder<Uint8List>(
                      future: image.readAsBytes(),
                      builder: (context, snapshot) {
                        if (!snapshot.hasData) {
                          return const ColoredBox(
                            color: AppColors.backgroundSecondary,
                            child: Center(
                              child: CircularProgressIndicator(strokeWidth: 2),
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
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    image.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: onTap,
                  icon: const Icon(Icons.edit_outlined, size: 20),
                  tooltip: 'Change',
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildVehiclePhotosSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _vehiclePhotos.length == 4 ? AppColors.primaryAccent : AppColors.border,
          width: _vehiclePhotos.length == 4 ? 2 : 1,
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
                    const Text(
                      'Vehicle photos',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Front, back, both sides, ${_vehiclePhotos.length} of 4',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (_vehiclePhotos.length == 4)
                const Icon(
                  Icons.check_circle_rounded,
                  color: AppColors.success,
                  size: 22,
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (_vehiclePhotos.isEmpty)
            OutlinedButton.icon(
              onPressed: _pickVehiclePhotos,
              icon: const Icon(Icons.add_photo_alternate_outlined, size: 20),
              label: const Text('Add'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primaryAccent,
                side: const BorderSide(color: AppColors.primaryAccent),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            )
          else
            Column(
              children: [
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 4,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                  ),
                  itemCount: _vehiclePhotos.length,
                  itemBuilder: (context, index) {
                    return Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: double.infinity,
                            height: double.infinity,
                            child: FutureBuilder<Uint8List>(
                              future: _vehiclePhotos[index].readAsBytes(),
                              builder: (context, snapshot) {
                                if (!snapshot.hasData) {
                                  return const ColoredBox(
                                    color: AppColors.backgroundSecondary,
                                    child: Center(
                                      child: CircularProgressIndicator(strokeWidth: 2),
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
                        Positioned(
                          top: 4,
                          right: 4,
                          child: GestureDetector(
                            onTap: () => _removeVehiclePhoto(index),
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                color: Colors.black54,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close,
                                size: 14,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                if (_vehiclePhotos.length < 4) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _pickVehiclePhotos,
                    icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
                    label: Text('Add more (${4 - _vehiclePhotos.length} remaining)'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }
}
