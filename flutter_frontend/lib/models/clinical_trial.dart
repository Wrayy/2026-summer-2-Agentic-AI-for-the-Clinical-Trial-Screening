import 'dart:convert';

class ClinicalTrial {
  ClinicalTrial(this.data);

  final Map<String, dynamic> data;

  factory ClinicalTrial.fromJson(Map<String, dynamic> json) =>
      ClinicalTrial(json);

  int get trialId => _asInt(data['trial_id']);
  String get formattedTrialId => formatTrialId(data['trial_id']);
  String get name => text('trial_name');
  String get status => text('trial_status');

  String text(String key) {
    final value = data[key];
    return value == null || value.toString().isEmpty ? '-' : value.toString();
  }

  Map<String, dynamic> get exclusionCriteria {
    final raw = data['exclusion_criteria'];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is String && raw.isNotEmpty) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {
        return const {};
      }
    }
    return const {};
  }
}

String formatTrialId(dynamic value) {
  final text = value?.toString().trim() ?? '';
  final numeric = int.tryParse(text);
  if (numeric == null) return text.isEmpty ? '-' : text;
  if (numeric >= 0 && numeric < 10000) {
    return numeric.toString().padLeft(4, '0');
  }
  return numeric.toString();
}

int _asInt(dynamic value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '') ?? 0;
}
