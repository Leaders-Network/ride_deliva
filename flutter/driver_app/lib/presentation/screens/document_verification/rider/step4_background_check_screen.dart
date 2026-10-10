import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../document_verification_screen.dart';

class RiderStep4BackgroundCheckScreen extends StatefulWidget {
  const RiderStep4BackgroundCheckScreen({super.key});

  @override
  State<RiderStep4BackgroundCheckScreen> createState() =>
      _RiderStep4BackgroundCheckScreenState();
}

class _RiderStep4BackgroundCheckScreenState extends State<RiderStep4BackgroundCheckScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Guarantor fields
  final _guarantorNameController = TextEditingController();
  final _guarantorPhoneController = TextEditingController();
  final _guarantorRelationshipController = TextEditingController();
  final _guarantorAddressController = TextEditingController();
  
  // Emergency contact fields
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  
  bool _agreeToBackgroundCheck = false;
  bool _acceptTerms = false;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _guarantorNameController.dispose();
    _guarantorPhoneController.dispose();
    _guarantorRelationshipController.dispose();
    _guarantorAddressController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    super.dispose();
  }

  Future<void> _submitForCheck() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    
    if (!_agreeToBackgroundCheck) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please agree to the background check'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }
    
    if (!_acceptTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please accept the Terms and Privacy Policy'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    // Simulate submission delay
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    // Navigate to verification screen
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (context) => const DocumentVerificationScreen(
          vehicleDocumentsSubmitted: true,
        ),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Background check'),
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
                  
                  // Guarantor section
                  _buildSectionTitle('Guarantor'),
                  const SizedBox(height: 16),
                  
                  _buildLabel('Full name'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _guarantorNameController,
                    decoration: const InputDecoration(
                      hintText: 'Enter guarantor\'s full name',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter guarantor\'s name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  _buildLabel('Phone number'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _guarantorPhoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      hintText: 'Enter phone number',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter phone number';
                      }
                      if (value.length < 11) {
                        return 'Please enter a valid phone number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  _buildLabel('Relationship to you'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _guarantorRelationshipController,
                    decoration: const InputDecoration(
                      hintText: 'e.g., Friend, Family member',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter relationship';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  _buildLabel('Home address'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _guarantorAddressController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      hintText: 'Enter guarantor\'s home address',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter address';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),
                  
                  // Emergency contact section
                  _buildSectionTitle('Emergency contact'),
                  const SizedBox(height: 16),
                  
                  _buildLabel('Name and phone'),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _emergencyNameController,
                    decoration: const InputDecoration(
                      hintText: 'Full name',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter emergency contact name';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _emergencyPhoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      hintText: 'Phone number',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter phone number';
                      }
                      if (value.length < 11) {
                        return 'Please enter a valid phone number';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 32),
                  
                  // Checkboxes
                  _buildCheckboxTile(
                    value: _agreeToBackgroundCheck,
                    title: 'I agree to an identity and safety background check.',
                    onChanged: (value) {
                      setState(() => _agreeToBackgroundCheck = value ?? false);
                    },
                  ),
                  const SizedBox(height: 12),
                  _buildCheckboxTile(
                    value: _acceptTerms,
                    title: 'I accept the Terms and Privacy Policy.',
                    onChanged: (value) {
                      setState(() => _acceptTerms = value ?? false);
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
                    onPressed: _isSubmitting ? null : _submitForCheck,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primaryAccent,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Submit for check',
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
              'Step 4 of 5',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
          const Spacer(),
          const Text(
            '80%',
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
              'A guarantor is someone who knows you and can vouch for you. We may call them.',
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

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
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

  Widget _buildCheckboxTile({
    required bool value,
    required String title,
    required ValueChanged<bool?> onChanged,
  }) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.backgroundCard,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: value ? AppColors.primaryAccent : AppColors.border,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Checkbox(
                value: value,
                onChanged: onChanged,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    color: AppColors.textPrimary,
                    height: 1.4,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
