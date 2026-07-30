class MatchedPatient {
  MatchedPatient(this.data);

  final Map<String, dynamic> data;

  factory MatchedPatient.fromJson(Map<String, dynamic> json) =>
      MatchedPatient(json);

  int get patientId => _asInt(data['patient_id']);
  String get name => text('patient_fullname');
  String get description => text('detailed_description');
  String get formattedDescription => _formatMatchedDescription(description);
  List<Map<String, dynamic>> get relatedDoctors {
    final doctors = data['related_doctors'];
    if (doctors is List) {
      return doctors.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    return const [];
  }

  String text(String key) =>
      data[key]?.toString().trim().isEmpty ?? true ? '-' : data[key].toString();
}

class PatientProfile {
  PatientProfile({
    required this.basicInfo,
    required this.doctorInfo,
    required this.medicalHistory,
  });

  final Map<String, dynamic> basicInfo;
  final List<Map<String, dynamic>> doctorInfo;
  final Map<String, dynamic> medicalHistory;

  factory PatientProfile.fromJson(Map<String, dynamic> json) {
    final doctors = json['patientDoctorInfo'];
    return PatientProfile(
      basicInfo: Map<String, dynamic>.from(json['basicInfo'] ?? {}),
      doctorInfo: doctors is List
          ? doctors.whereType<Map>().map(Map<String, dynamic>.from).toList()
          : const [],
      medicalHistory:
          Map<String, dynamic>.from(json['medicalHistoryInfo'] ?? {}),
    );
  }

  String basic(String key) => basicInfo[key]?.toString() ?? '-';
  String history(String key) => medicalHistory[key]?.toString() ?? '-';
}

int _asInt(dynamic value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

String _formatMatchedDescription(String description) {
  final sections = _MatchedDescriptionSections.from(description);
  if (!sections.hasStructuredFields) return description;
  final currentMedications = sections.patientData['Current Medications'] ??
      sections.patientData['Medication Exclusions'] ??
      '-';

  final buffer = StringBuffer()
    ..writeln('Inclusion Criteria')
    ..writeln('Pathology: ${sections.inclusion['Pathology'] ?? '-'}')
    ..writeln('Gender: ${sections.inclusion['Gender'] ?? '-'}')
    ..writeln('Age Range: ${sections.inclusion['Age Range'] ?? '-'}')
    ..writeln()
    ..writeln('Exclusion Criteria')
    ..writeln(
        'Allowed BMI Range: ${_formatAllowedBmiRange(sections.exclusion['Allowed BMI Range'])}')
    ..writeln(
        'Meaning: Exclude BMI below the minimum or above the maximum.')
    ..writeln('Diseases: ${sections.exclusion['Diseases'] ?? '-'}')
    ..writeln(
        'Medication Exclusions: ${sections.exclusion['Medication Exclusions'] ?? '-'}')
    ..writeln('Surgeries: ${sections.exclusion['Surgeries'] ?? '-'}')
    ..writeln('Pregnancy: ${sections.exclusion['Pregnancy'] ?? '-'}')
    ..writeln()
    ..writeln('Patient Data')
    ..writeln('Age: ${sections.patientData['Age'] ?? '-'}')
    ..writeln('Gender: ${sections.patientData['Gender'] ?? '-'}')
    ..writeln('BMI: ${sections.patientData['BMI'] ?? '-'}')
    ..writeln('Pathology: ${sections.patientData['Pathology'] ?? '-'}')
    ..writeln('Current Medications: $currentMedications')
    ..writeln('Surgeries: ${sections.patientData['Surgeries'] ?? '-'}')
    ..write('Pregnancies: ${sections.patientData['Pregnancies'] ?? '-'}');

  final extras = sections.extraLines;
  if (extras.isNotEmpty) {
    buffer
      ..writeln()
      ..writeln()
      ..writeln('Other Details');
    for (var i = 0; i < extras.length; i += 1) {
      if (i > 0) buffer.writeln();
      buffer.write(extras[i]);
    }
  }

  return buffer.toString();
}

class _MatchedDescriptionSections {
  _MatchedDescriptionSections({
    required this.inclusion,
    required this.exclusion,
    required this.patientData,
    required this.extraLines,
  });

  factory _MatchedDescriptionSections.from(String description) {
    final buckets = {
      _DescriptionSection.inclusion: <String, String>{},
      _DescriptionSection.exclusion: <String, String>{},
      _DescriptionSection.patientData: <String, String>{},
    };
    final extras = <String>[];
    final normalizedDescription = description.replaceAllMapped(
      RegExp(
        r'\b(Inclusion Criteria|Exclusion Criteria|Patient Data|Patient Information)\s*:?',
        caseSensitive: false,
      ),
      (match) => '\n${match.group(1)}:',
    );
    final chunks = normalizedDescription
        .split(RegExp(r'[\r\n]+'))
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty);
    var section = _DescriptionSection.inclusion;

    for (final chunk in chunks) {
      final lower = chunk.toLowerCase();
      final nextSection = _sectionForHeading(lower);
      final withoutHeading =
          nextSection == null ? chunk : _removeLeadingHeading(chunk);
      if (nextSection != null) section = nextSection;

      final fields = _extractFields(withoutHeading);
      if (fields.isEmpty) {
        if (withoutHeading.isNotEmpty) extras.add(withoutHeading);
        continue;
      }

      for (final entry in fields.entries) {
        final target = _targetSection(entry.key, section);
        buckets[target]![entry.key] ??= entry.value;
      }
    }

    return _MatchedDescriptionSections(
      inclusion: buckets[_DescriptionSection.inclusion]!,
      exclusion: buckets[_DescriptionSection.exclusion]!,
      patientData: buckets[_DescriptionSection.patientData]!,
      extraLines: extras,
    );
  }

  final Map<String, String> inclusion;
  final Map<String, String> exclusion;
  final Map<String, String> patientData;
  final List<String> extraLines;

  bool get hasStructuredFields =>
      inclusion.isNotEmpty || exclusion.isNotEmpty || patientData.isNotEmpty;
}

enum _DescriptionSection { inclusion, exclusion, patientData }

_DescriptionSection? _sectionForHeading(String text) {
  if (text.contains('patient data') || text.contains('patient information')) {
    return _DescriptionSection.patientData;
  }
  if (text.contains('exclusion criteria')) {
    return _DescriptionSection.exclusion;
  }
  if (text.contains('inclusion criteria')) {
    return _DescriptionSection.inclusion;
  }
  return null;
}

String _removeLeadingHeading(String text) {
  return text
      .replaceFirst(
        RegExp(
          r'^\s*(inclusion criteria|exclusion criteria|patient data|patient information)\s*:?\s*',
          caseSensitive: false,
        ),
        '',
      )
      .trim();
}

Map<String, String> _extractFields(String text) {
  final fields = <String, String>{};
  if (text.isEmpty) return fields;

  final labels = _descriptionLabels.map(RegExp.escape).join('|');
  final pattern = RegExp(
    '($labels)\\s*:\\s*(.*?)(?=(?:\\s*[;,|]?\\s*(?:$labels)\\s*:)|\$)',
    caseSensitive: false,
  );

  for (final match in pattern.allMatches(text)) {
    final label = _canonicalDescriptionLabel(match.group(1) ?? '');
    final value =
        (match.group(2) ?? '').trim().replaceAll(RegExp(r'[;,]\s*$'), '');
    if (label != null && value.isNotEmpty) {
      fields[label] = value;
    }
  }
  return fields;
}

_DescriptionSection _targetSection(
  String label,
  _DescriptionSection currentSection,
) {
  if (currentSection == _DescriptionSection.patientData &&
      _patientDataLabels.contains(label)) {
    return _DescriptionSection.patientData;
  }
  if (_exclusionLabels.contains(label)) {
    return _DescriptionSection.exclusion;
  }
  if (_patientOnlyLabels.contains(label)) {
    return _DescriptionSection.patientData;
  }
  return currentSection;
}

String? _canonicalDescriptionLabel(String label) {
  final normalized = label.trim().toLowerCase();
  return _labelAliases[normalized];
}

const _labelAliases = {
  'pathology': 'Pathology',
  'gender': 'Gender',
  'age range': 'Age Range',
  'bmi range': 'Allowed BMI Range',
  'allowed bmi range': 'Allowed BMI Range',
  'diseases': 'Diseases',
  'medication exclusions': 'Medication Exclusions',
  'prior medications': 'Medication Exclusions',
  'current medications': 'Current Medications',
  'medications': 'Current Medications',
  'surgeries': 'Surgeries',
  'pregnancy': 'Pregnancy',
  'age': 'Age',
  'bmi': 'BMI',
  'pregnancies': 'Pregnancies',
};

const _descriptionLabels = [
  'Medication Exclusions',
  'Current Medications',
  'Allowed BMI Range',
  'Age Range',
  'BMI Range',
  'Pregnancies',
  'Pathology',
  'Pregnancy',
  'Diseases',
  'Surgeries',
  'Gender',
  'Age',
  'BMI',
];

const _exclusionLabels = {
  'Allowed BMI Range',
  'Diseases',
  'Medication Exclusions',
  'Surgeries',
  'Pregnancy',
};

const _patientOnlyLabels = {
  'Age',
  'BMI',
  'Pregnancies',
};

const _patientDataLabels = {
  'Age',
  'Gender',
  'BMI',
  'Pathology',
  'Medication Exclusions',
  'Current Medications',
  'Surgeries',
  'Pregnancies',
};

String _formatAllowedBmiRange(String? value) {
  final raw = value?.trim() ?? '';
  if (raw.isEmpty || raw == '-') return '-';
  final match = RegExp(
    r'>\s*([\d.]+)\s+and\s+<\s*([\d.]+)',
    caseSensitive: false,
  ).firstMatch(raw);
  if (match == null) return raw;
  return '${match.group(1)} to ${match.group(2)}';
}
