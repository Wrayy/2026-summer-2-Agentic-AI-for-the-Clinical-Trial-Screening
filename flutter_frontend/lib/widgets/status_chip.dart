import 'package:flutter/material.dart';

class StatusChip extends StatelessWidget {
  const StatusChip({
    super.key,
    required this.label,
    this.fixedSize,
  });

  static const trialListSize = Size(136, 32);
  static const supportedTrialStatuses = {
    'Under Review',
    'Ongoing',
    'Completed',
    'Rejected',
  };

  final String label;
  final Size? fixedSize;

  @override
  Widget build(BuildContext context) {
    final color = switch (label) {
      'Ongoing' || 'Applying' => Colors.blue,
      'Completed' || 'Enrolled' => Colors.green,
      'Rejected' => Colors.red,
      'Under Review' || 'Inviting' => Colors.orange,
      _ => Colors.grey,
    };
    final isSupported = supportedTrialStatuses.contains(label);
    return Tooltip(
      message: statusDescription(label),
      child: SizedBox(
        width: fixedSize?.width,
        height: fixedSize?.height,
        child: Chip(
          label: SizedBox(
            width: fixedSize == null ? null : fixedSize!.width - 28,
            child: Text(
              label,
              textAlign: TextAlign.center,
              overflow: isSupported ? TextOverflow.clip : TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
          visualDensity: VisualDensity.compact,
          backgroundColor: color.withValues(alpha: 0.12),
          side: BorderSide(color: color.withValues(alpha: 0.35)),
          labelStyle:
              TextStyle(color: color.shade800, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

String statusDescription(String label) => switch (label) {
      'Under Review' =>
        'The trial exists in the system but has not been activated for active recruitment.',
      'Ongoing' =>
        'The trial is active and can be treated as open for current recruitment work.',
      'Completed' =>
        'The trial has finished and is no longer active for recruitment.',
      'Rejected' => 'The trial was not approved to continue in this workspace.',
      'Applying' => 'The patient is currently applying for the trial.',
      'Enrolled' => 'The patient is enrolled in the trial.',
      'Inviting' => 'An invitation workflow is in progress.',
      _ => 'Status information is not available.',
    };
