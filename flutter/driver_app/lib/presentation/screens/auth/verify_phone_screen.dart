import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../document_verification/document_verification_screen.dart';

class VerifyPhoneScreen extends StatelessWidget {
  final String phoneNumber;
  final bool isLogin;

  const VerifyPhoneScreen({
    super.key,
    required this.phoneNumber,
    this.isLogin = false,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Verify Phone'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.phone_android,
              size: 64,
              color: AppColors.primaryAccent,
            ),
            const SizedBox(height: 16),
            const Text(
              'Phone Verification',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Verify: $phoneNumber',
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(
                    builder: (context) => const DocumentVerificationScreen(),
                  ),
                );
              },
              child: const Text('Continue to Verification'),
            ),
          ],
        ),
      ),
    );
  }
}
