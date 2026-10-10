import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../dashboard/dashboard_screen.dart';
import 'rider/step1_personal_info_screen.dart';

class DocumentVerificationScreen extends StatefulWidget {
  const DocumentVerificationScreen({
    super.key,
    this.vehicleDocumentsSubmitted = false,
  });

  final bool vehicleDocumentsSubmitted;

  @override
  State<DocumentVerificationScreen> createState() =>
      _DocumentVerificationScreenState();
}

class _DocumentVerificationScreenState
    extends State<DocumentVerificationScreen> {
  late bool _vehicleDocumentsSubmitted = widget.vehicleDocumentsSubmitted;

  @override
  Widget build(BuildContext context) {
    final documents = [
      const DocumentItem(
        title: 'Personal Information',
        subtitle: 'Identity details confirmed',
        icon: Icons.person_outline_rounded,
        status: DocumentStatus.approved,
      ),
      const DocumentItem(
        title: 'Driver License',
        subtitle: 'License details verified',
        icon: Icons.badge_outlined,
        status: DocumentStatus.approved,
      ),
      DocumentItem(
        title: 'Vehicle Documents',
        subtitle: _vehicleDocumentsSubmitted
            ? 'Registration and insurance submitted for review'
            : 'Registration and insurance documents',
        icon: Icons.directions_car_outlined,
        status: _vehicleDocumentsSubmitted
            ? DocumentStatus.uploaded
            : DocumentStatus.pending,
      ),
      const DocumentItem(
        title: 'Background Check',
        subtitle: 'Identity and safety review',
        icon: Icons.fact_check_outlined,
        status: DocumentStatus.pending,
      ),
      const DocumentItem(
        title: 'Approval',
        subtitle: 'Final account review',
        icon: Icons.verified_user_outlined,
        status: DocumentStatus.pending,
      ),
    ];

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        title: const Text('Driver Verification'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              children: [
                _buildProgressOverview(),
                const SizedBox(height: 14),
                _buildCurrentStep(),
                const SizedBox(height: 14),
                for (final document in documents) _buildDocumentCard(document),
                const SizedBox(height: 8),
                _buildInfoCard(
                  icon: Icons.shield_outlined,
                  title: 'Why verification is required',
                  description:
                      'Verification helps us confirm your identity, validate your vehicle documents, and keep every trip secure and professional for the Ride Deliva community.',
                ),
                const SizedBox(height: 10),
                _buildInfoCard(
                  icon: Icons.schedule_rounded,
                  title: 'Estimated review time',
                  description: 'Usually completed within 24 hours.',
                  compact: true,
                ),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _continueVerification,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryAccent,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Continue Verification'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () {
                        if (Navigator.of(context).canPop()) {
                          Navigator.of(context).pop();
                        } else {
                          Navigator.of(context).pushReplacement(
                            MaterialPageRoute<void>(
                              builder: (context) => const DashboardScreen(),
                            ),
                          );
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.border),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Save & Exit'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressOverview() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.verified_user_outlined,
                size: 16,
                color: AppColors.primaryAccent,
              ),
              const SizedBox(width: 7),
              Text(
                'VERIFICATION PROGRESS',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryAccent.withValues(alpha: 0.95),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            'Complete your driver verification',
            style: TextStyle(
              fontSize: 20,
              height: 1.2,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 7),
          const Text(
            'We’re reviewing your details to keep the platform safe for riders and drivers.',
            style: TextStyle(
              fontSize: 12,
              height: 1.4,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentStep() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.primaryAccent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: AppColors.primaryAccent.withValues(alpha: 0.3)),
      ),
      child: const Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Current step',
                      style: TextStyle(
                        fontSize: 10,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Vehicle Documents',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '3 of 5',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primaryAccent,
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.all(Radius.circular(4)),
            child: LinearProgressIndicator(
              value: 0.6,
              minHeight: 5,
              backgroundColor: AppColors.backgroundSecondary,
              valueColor:
                  AlwaysStoppedAnimation<Color>(AppColors.primaryAccent),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String title,
    required String description,
    bool compact = false,
  }) {
    return Container(
      padding: EdgeInsets.all(compact ? 13 : 14),
      decoration: BoxDecoration(
        color: AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 19, color: AppColors.primaryAccent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 10,
                    height: 1.35,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentCard(DocumentItem document) {
    final isCurrent = document.status == DocumentStatus.uploaded;
    final statusColor = _getStatusColor(document.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: isCurrent
            ? AppColors.primaryAccent.withValues(alpha: 0.06)
            : AppColors.backgroundCard,
        borderRadius: BorderRadius.circular(11),
        border: Border.all(
          color: isCurrent
              ? AppColors.primaryAccent.withValues(alpha: 0.35)
              : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(document.icon, color: statusColor, size: 17),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  document.title,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  document.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 9,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _buildStatusWidget(document.status),
        ],
      ),
    );
  }

  Widget _buildStatusWidget(DocumentStatus status) {
    final label = switch (status) {
      DocumentStatus.approved => 'Verified',
      DocumentStatus.uploaded => 'In review',
      DocumentStatus.pending => 'Pending',
      DocumentStatus.rejected => 'Pending',
    };
    final color = _getStatusColor(status);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ),
        if (status == DocumentStatus.uploaded) ...[
          const SizedBox(height: 3),
          const Text(
            'Current',
            style: TextStyle(fontSize: 8, color: AppColors.primaryAccent),
          ),
        ],
      ],
    );
  }

  Color _getStatusColor(DocumentStatus status) {
    return switch (status) {
      DocumentStatus.pending => AppColors.textTertiary,
      DocumentStatus.uploaded => AppColors.primaryAccent,
      DocumentStatus.approved => AppColors.success,
      DocumentStatus.rejected => AppColors.error,
    };
  }

  Future<void> _continueVerification() async {
    // Navigate to Step 1 of the rider verification flow
    final submitted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (context) => const RiderStep1PersonalInfoScreen(),
      ),
    );

    if (submitted == true && mounted) {
      setState(() => _vehicleDocumentsSubmitted = true);
    }
  }
}

class DocumentItem {
  final String title;
  final String subtitle;
  final IconData icon;
  final DocumentStatus status;

  const DocumentItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.status,
  });
}

enum DocumentStatus {
  pending,
  uploaded,
  approved,
  rejected,
}
