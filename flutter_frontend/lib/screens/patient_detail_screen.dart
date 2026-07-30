import 'package:flutter/material.dart';

import '../models/clinical_trial.dart';
import '../models/patient.dart';
import '../services/api_service.dart';
import '../widgets/page_scaffold.dart';

class PatientDetailArgs {
  PatientDetailArgs({
    required this.patientId,
    required this.trial,
    this.relatedDoctors = const [],
  });

  final int patientId;
  final ClinicalTrial trial;
  final List<Map<String, dynamic>> relatedDoctors;
}

String _careTeamRoleLabel(dynamic value) {
  final normalized = value?.toString().trim() ?? '';
  if (normalized.isEmpty || normalized == '-') return 'Associated Doctor';
  final spaced = normalized.replaceAll('_', ' ');
  final lower = spaced.toLowerCase();
  if (lower == 'family doctor') return 'Family Doctor';
  if (lower.endsWith(' doctor')) return _titleCaseWords(spaced);
  return '${_titleCaseWords(spaced)} Doctor';
}

String _titleCaseWords(String value) {
  return value
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .map((word) =>
          '${word[0].toUpperCase()}${word.length > 1 ? word.substring(1).toLowerCase() : ''}')
      .join(' ');
}

class PatientDetailScreen extends StatefulWidget {
  const PatientDetailScreen({
    super.key,
    required this.api,
    required this.args,
  });

  static const routeName = '/patients/detail';
  final ApiService api;
  final PatientDetailArgs args;

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> {
  late Future<PatientProfile> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.getPatientProfile(widget.args.patientId);
  }

  void _reload() {
    setState(
        () => _future = widget.api.getPatientProfile(widget.args.patientId));
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<PatientProfile>(
      future: _future,
      builder: (context, snapshot) {
        final title = snapshot.data?.basic('Name') ?? 'Patient Detail';
        return ClinicalTrialScaffold(
          title: title,
          selectedSection: WorkspaceSection.trialList,
          child: snapshot.connectionState == ConnectionState.waiting
              ? const Center(child: CircularProgressIndicator())
              : snapshot.hasError
                  ? ErrorState(
                      message: snapshot.error.toString(),
                      onRetry: _reload,
                    )
                  : _content(snapshot.data!),
        );
      },
    );
  }

  Widget _content(PatientProfile profile) {
    final doctors = profile.doctorInfo.isNotEmpty
        ? profile.doctorInfo
        : widget.args.relatedDoctors;
    final bmi = _calculatedBmi(profile);
    return ListView(
      children: [
        SectionCard(
          title: 'Patient Information',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                profile.basic('Name'),
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: [
                  _fact('Phone', profile.basic('MobileNumber')),
                  _fact('Email', profile.basic('EmailId')),
                  _fact('Age', profile.basic('Age')),
                  _fact('Gender', profile.basic('Gender')),
                  _fact('Height', '${profile.basic('height')} cm'),
                  _fact('Weight', '${profile.basic('weight')} kg'),
                  if (bmi != null) _fact('BMI', bmi),
                  _fact('Blood Type', profile.basic('bloodtype')),
                  if (!_isEmptyProfileValue(profile.basic('dateOfBirth')))
                    _fact(
                      'Date of Birth',
                      _formatProfileDate(profile.basic('dateOfBirth')),
                    ),
                  _fact(
                    'Location',
                    _joinProfileValues([
                      profile.basic('City'),
                      profile.basic('Province'),
                      profile.basic('Country'),
                    ]),
                  ),
                  if (!_isEmptyProfileValue(profile.basic('Address')))
                    _fact('Address', profile.basic('Address')),
                  if (!_isEmptyProfileValue(profile.basic('PostalCode')))
                    _fact('Postal Code', profile.basic('PostalCode')),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Care Team',
          child: Wrap(
            spacing: 16,
            runSpacing: 16,
            children: doctors.isEmpty
                ? [_fact('Associated doctor', '-')]
                : doctors.map((doctor) {
                    final type = doctor['association_type'] ??
                        doctor['Specialization'] ??
                        'Associated';
                    final name = doctor['doctor_full_name'] ??
                        doctor['name'] ??
                        '${doctor['Fname'] ?? ''} ${doctor['Lname'] ?? ''}';
                    return _fact(_careTeamRoleLabel(type), name.toString());
                  }).toList(),
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Actions',
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.mail),
                label: const Text('Message'),
              ),
              OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.smart_toy),
                label: const Text('Chatbot'),
              ),
              OutlinedButton.icon(
                onPressed: null,
                icon: const Icon(Icons.videocam),
                label: const Text('Video Call'),
              ),
              FilledButton.icon(
                onPressed: () => _openInvite(profile, doctors),
                icon: const Icon(Icons.person_add),
                label: const Text('Invite'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: 'Medical History',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _history('Diagnosis', profile.history('diagnosis')),
              _history(
                'Diagnosis Classifications',
                profile.history('diagnosisClassifications'),
              ),
              _history('Medications', profile.history('medications')),
              _history('Surgeries', profile.history('surgeries')),
              _history('Pregnancies', profile.history('pregnancies')),
              _history('Medical History', profile.history('medicalHistory')),
              _history(
                'Other Notes',
                _patientProfileOnlyNotes(profile.history('otherNotes')),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _openInvite(
    PatientProfile profile,
    List<Map<String, dynamic>> doctors,
  ) async {
    await showDialog<void>(
      context: context,
      builder: (context) => _InviteDialog(
        api: widget.api,
        profile: profile,
        trial: widget.args.trial,
        doctors: doctors,
      ),
    );
  }

  Widget _fact(String title, String value) {
    final titleStyle = Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w700,
        );
    final valueStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Theme.of(context).colorScheme.onSurface,
        );
    return SizedBox(
      width: 260,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: titleStyle),
          const SizedBox(height: 4),
          Text(value, style: valueStyle),
        ],
      ),
    );
  }

  Widget _history(String title, String value) {
    if (_isEmptyProfileValue(value)) return const SizedBox.shrink();
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.medical_services_outlined),
      title: Text(title),
      subtitle: Text(value),
    );
  }

  bool _isEmptyProfileValue(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.isEmpty || normalized == '-' || normalized == 'null';
  }

  String? _calculatedBmi(PatientProfile profile) {
    final heightCm = double.tryParse(profile.basic('height'));
    final weightKg = double.tryParse(profile.basic('weight'));
    if (heightCm == null || weightKg == null || heightCm <= 0) return null;
    final heightM = heightCm / 100;
    final bmi = weightKg / (heightM * heightM);
    return bmi.toStringAsFixed(1);
  }

  String _patientProfileOnlyNotes(String value) {
    if (_isEmptyProfileValue(value)) return value;
    final keptSentences = value
        .split(RegExp(r'(?<=[.!?])\s+'))
        .map((sentence) => sentence.trim())
        .where((sentence) => sentence.isNotEmpty)
        .where((sentence) => !_isTrialSpecificProfileNote(sentence))
        .toList();
    return keptSentences.isEmpty ? '-' : keptSentences.join(' ');
  }

  bool _isTrialSpecificProfileNote(String sentence) {
    final lower = sentence.toLowerCase();
    return lower.contains('intended') ||
        lower.contains('non-match') ||
        lower.contains('strong match') ||
        lower.contains('good match') ||
        lower.contains('likely match') ||
        lower.contains('candidate for') ||
        lower.contains('protocol review') ||
        lower.contains('nct') ||
        lower.contains('test medication') ||
        lower.contains('excluded medication') ||
        lower.contains('medication exclusion') ||
        lower.contains('exclusion criteria') ||
        lower.contains('trial-related') ||
        lower.contains('matching the trial') ||
        lower.contains('trial excludes') ||
        lower.contains('fits the trial') ||
        lower.contains('excluded from') ||
        lower.contains('eligibility should') ||
        lower.contains('demonstrate') ||
        lower.contains('demonstrates') ||
        lower.contains('useful non-match');
  }

  String _joinProfileValues(List<String> values) {
    final visible = values.where((value) => !_isEmptyProfileValue(value));
    return visible.isEmpty ? '-' : visible.join(', ');
  }

  String _formatProfileDate(String value) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return '${parsed.year.toString().padLeft(4, '0')}-'
        '${parsed.month.toString().padLeft(2, '0')}-'
        '${parsed.day.toString().padLeft(2, '0')}';
  }
}

class _InviteDialog extends StatefulWidget {
  const _InviteDialog({
    required this.api,
    required this.profile,
    required this.trial,
    required this.doctors,
  });

  final ApiService api;
  final PatientProfile profile;
  final ClinicalTrial trial;
  final List<Map<String, dynamic>> doctors;

  @override
  State<_InviteDialog> createState() => _InviteDialogState();
}

class _InviteDialogState extends State<_InviteDialog> {
  late final TextEditingController _messageController;
  Map<String, dynamic>? _selectedDoctor;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.doctors.isNotEmpty) _selectedDoctor = widget.doctors.first;
    _messageController = TextEditingController(text: _defaultMessage());
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  String _defaultMessage() {
    return 'Dear ${widget.profile.basic('Name')},\n\n'
        'We are pleased to invite you to participate in our clinical trial, '
        '${widget.trial.name}.\n\n'
        'This trial aims to explore new treatment options and improve patient outcomes.\n\n'
        'Please let us know if you have any questions or need further information.\n\n'
        'Best regards,\n${widget.api.companyName}.';
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      final exists = await widget.api.checkExistingInvite(
        widget.trial.trialId,
        int.parse(widget.profile.basic('id')),
      );
      if (exists) {
        throw ApiException(
            'An active invitation already exists for this patient.');
      }
      final actionId =
          await widget.api.createInviteAction(widget.trial.trialId);
      await widget.api.createInviteRequest(
        actionId: actionId,
        receivedUserType: 3,
        receivedUserId: int.parse(widget.profile.basic('id')),
        inviteMessage: _messageController.text,
        isPrimaryRequest: true,
      );
      final doctorId = _doctorId(_selectedDoctor);
      if (doctorId != null) {
        await widget.api.createInviteRequest(
          actionId: actionId,
          receivedUserType: 2,
          receivedUserId: doctorId,
          inviteMessage: _messageController.text,
          isPrimaryRequest: false,
        );
      }
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invitation sent successfully.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  int? _doctorId(Map<String, dynamic>? doctor) {
    final raw = doctor?['doctor_id'] ?? doctor?['id'];
    if (raw is int) return raw;
    return int.tryParse(raw?.toString() ?? '');
  }

  String _doctorLabel(Map<String, dynamic> doctor) {
    final type = doctor['association_type'] ?? doctor['Specialization'] ?? '';
    final name = doctor['doctor_full_name'] ??
        doctor['name'] ??
        '${doctor['Fname'] ?? ''} ${doctor['Lname'] ?? ''}';
    return '${_careTeamRoleLabel(type)}: $name'.trim();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Patient Invite'),
      content: SizedBox(
        width: 560,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<Map<String, dynamic>>(
              initialValue: _selectedDoctor,
              decoration: const InputDecoration(labelText: 'Doctor Name'),
              items: widget.doctors
                  .map(
                    (doctor) => DropdownMenuItem(
                      value: doctor,
                      child: Text(_doctorLabel(doctor)),
                    ),
                  )
                  .toList(),
              onChanged: (doctor) => setState(() => _selectedDoctor = doctor),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _messageController,
              minLines: 8,
              maxLines: 12,
              decoration: const InputDecoration(labelText: 'Invite message'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _submitting ? null : _submit,
          icon: _submitting
              ? const SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.send),
          label: const Text('Submit Invitation'),
        ),
      ],
    );
  }
}
