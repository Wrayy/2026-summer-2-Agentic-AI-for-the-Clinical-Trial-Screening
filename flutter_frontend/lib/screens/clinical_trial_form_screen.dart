import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';

import '../models/clinical_trial.dart';
import '../services/api_service.dart';
import '../utils/document_file_picker.dart';
import '../widgets/page_scaffold.dart';
import 'clinical_trial_detail_screen.dart';

enum ClinicalTrialFormMode { create, edit }

class ClinicalTrialFormArgs {
  const ClinicalTrialFormArgs.edit({required this.trialId})
      : mode = ClinicalTrialFormMode.edit;

  final ClinicalTrialFormMode mode;
  final int trialId;
}

class ClinicalTrialEditResult {
  const ClinicalTrialEditResult({
    required this.trialId,
    required this.criteriaChanged,
    required this.clearedRankedResultCount,
  });

  final int trialId;
  final bool criteriaChanged;
  final int clearedRankedResultCount;
}

typedef DocumentPicker = Future<SelectedDocument?> Function();

class ClinicalTrialFormScreen extends StatefulWidget {
  const ClinicalTrialFormScreen({
    super.key,
    required this.api,
    this.args,
    this.documentPicker = pickDocumentFile,
  });

  static const routeName = '/clinical-trials/new';
  final ApiService api;
  final ClinicalTrialFormArgs? args;
  final DocumentPicker documentPicker;

  @override
  State<ClinicalTrialFormScreen> createState() =>
      _ClinicalTrialFormScreenState();
}

class _ClinicalTrialFormScreenState extends State<ClinicalTrialFormScreen> {
  static const Map<String, String> _requiredFieldLabels = {
    'firstName': 'First Name',
    'lastName': 'Last Name',
    'phone': 'Area Code',
    'phoneNumber': 'Phone Number',
    'email': 'Email',
    'trialName': 'Trial Name',
    'trialId': 'Trial ID',
    'country': 'Country',
    'region': 'Region / State',
    'officialTitle': 'Official Title',
    'briefSummary': 'Brief Summary',
    'detailedDescription': 'Detailed Description',
    'startDate': 'Start Date',
    'sponsor': 'Sponsor',
    'principalInvestigator': 'Principal Investigator',
    'ethicsApproval': 'Ethics Approval',
    'relatedConditions': 'Related Conditions',
    'pathology': 'Primary Pathology / Target Condition',
    'ageMin': 'Age Range Min',
    'ageMax': 'Age Range Max',
  };

  final _formKey = GlobalKey<FormState>();
  final Map<String, TextEditingController> _controllers = {};
  final Map<String, FocusNode> _focusNodes = {};
  final Map<String, String> _values = {
    'primaryPurpose': 'Treatment',
    'trialPhase': 'Not Applicable',
    'studyType': 'Interventional',
    'allocation': 'N/A',
    'interventionModel': 'N/A',
    'masking': 'None (Open Label)',
    'gender': 'Both',
    'pregnancy': 'Unrestricted',
  };
  bool _participantMasked = false;
  bool _investigatorMasked = false;
  bool _submitting = false;
  bool _initializingEdit = false;
  bool _extracting = false;
  bool _showValidationErrors = false;
  bool _loadingNextTrialId = false;
  String? _trialIdDuplicateValue;
  final ValueNotifier<_ExtractionProgress> _extractionProgress =
      ValueNotifier(const _ExtractionProgress(0, 'Preparing document.'));
  String? _selectedDocumentName;
  String? _extractionMessage;
  String? _extractionError;
  List<String> _missingRequiredFields = const [];
  List<String> _fieldsNeedingReview = const [];
  final Set<String> _reviewedFields = {};
  Map<String, dynamic>? _supplementalCriteria;
  ClinicalTrial? _editTrial;
  Map<String, dynamic>? _originalSemanticCriteriaRow;
  String? _loadedSemanticSourceType;
  bool _replaceStructuredSemanticCriteria = false;
  bool _semanticCriteriaChangedByUser = false;
  int _savedRankedResultCount = 0;
  String? _editLoadError;
  String? _cleanEditSnapshot;
  int _activeExtractionId = 0;
  final Set<int> _cancelledExtractionIds = {};
  final Map<int, Completer<void>> _extractionCancelCompleters = {};
  _FormSnapshot? _activeExtractionSnapshot;

  bool get _isEditMode => widget.args?.mode == ClinicalTrialFormMode.edit;

  TextEditingController _controller(String key) =>
      _controllers.putIfAbsent(key, () => TextEditingController());

  FocusNode _focusNode(String key) =>
      _focusNodes.putIfAbsent(key, () => FocusNode());

  Future<void> _loadNextTrialId({bool replaceInvalid = false}) async {
    if (_loadingNextTrialId) return;
    _loadingNextTrialId = true;
    try {
      final nextTrialId = await widget.api.getNextClinicalTrialId();
      if (!mounted) return;
      final currentTrialId = _controller('trialId').text.trim();
      final shouldFill = currentTrialId.isEmpty ||
          (replaceInvalid && int.tryParse(currentTrialId) == null);
      if (shouldFill) {
        setState(() {
          _controller('trialId').text = formatTrialId(nextTrialId);
          _trialIdDuplicateValue = null;
        });
      }
    } catch (_) {
      // Keep the field editable if the prefill endpoint is unavailable.
    } finally {
      _loadingNextTrialId = false;
    }
  }

  Future<bool> _checkTrialIdAvailability({bool showSnackBar = false}) async {
    if (_isEditMode) return true;
    final trialId = _controller('trialId').text.trim();
    if (trialId.isEmpty || int.tryParse(trialId) == null) return false;

    try {
      final exists = await widget.api.checkTrialIdExists(trialId);
      if (!mounted) return false;
      setState(() {
        _trialIdDuplicateValue = exists ? trialId : null;
      });
      _formKey.currentState?.validate();
      if (exists && showSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Trial ID already exists. Choose another trial ID.'),
          ),
        );
      }
      return !exists;
    } catch (error) {
      if (!mounted) return false;
      if (showSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not check Trial ID: $error')),
        );
      }
      return false;
    }
  }

  @override
  void initState() {
    super.initState();
    if (_isEditMode) {
      unawaited(_loadTrialForEdit());
    } else {
      unawaited(_loadNextTrialId(replaceInvalid: true));
    }
  }

  Future<void> _loadTrialForEdit() async {
    final trialId = widget.args?.trialId;
    if (trialId == null) return;
    setState(() {
      _initializingEdit = true;
      _editLoadError = null;
    });
    try {
      final trial = await widget.api.getSpecificClinicalTrial(trialId);
      final semanticCriteria = await widget.api.getSemanticCriteria(trialId);
      final storedRanked = await widget.api.getStoredRankedPatients(trialId);
      if (!mounted) return;
      setState(() {
        _editTrial = trial;
        _originalSemanticCriteriaRow = semanticCriteria;
        _savedRankedResultCount =
            (storedRanked['patients'] as List? ?? const []).length;
      });
      _populateEditForm(trial, semanticCriteria);
    } catch (error) {
      if (!mounted) return;
      setState(() => _editLoadError = error.toString());
    } finally {
      if (mounted) setState(() => _initializingEdit = false);
    }
  }

  void _populateEditForm(
    ClinicalTrial trial,
    Map<String, dynamic>? semanticCriteria,
  ) {
    String text(String key) {
      final value = trial.data[key];
      final raw = value?.toString().trim() ?? '';
      return raw == '-' ? '' : raw;
    }

    void setText(String key, String value) {
      _controller(key).text = value;
    }

    setText('firstName', text('contact_first_name'));
    setText('middleName', text('contact_middle_name'));
    setText('lastName', text('contact_last_name'));
    setText('phone', text('contact_area_code'));
    setText('phoneNumber', text('contact_phone_number'));
    setText('email', text('contact_email'));
    setText('trialName', text('trial_name'));
    setText('trialId', formatTrialId(trial.data['trial_id']));
    setText('officialTitle', text('official_title'));
    setText('briefSummary', text('brief_summary'));
    setText('detailedDescription', text('detailed_description'));
    setText('startDate', _dateOnly(trial.data['start_date']));
    setText('endDate', _dateOnly(trial.data['end_date']));
    setText('sponsor', text('sponsor'));
    setText('principalInvestigator', text('principal_investigator'));
    setText('ethicsApproval', text('ethics_approval'));
    setText('relatedConditions', text('related_conditions'));
    setText('pathology', text('pathology'));
    _applyLocation(text('locations'));
    _applyAgeRange(text('age_range'));

    final exclusionCriteria = trial.exclusionCriteria;
    _applyBmiRange(exclusionCriteria['BMI']);
    setText('diseases', _stringValue(exclusionCriteria['Diseases']) ?? '');
    setText('surgeries', _stringValue(exclusionCriteria['Surgeries']) ?? '');
    setText(
      'priorMedications',
      _stringValue(
            exclusionCriteria['PriorMedications'] ??
                exclusionCriteria['Prior Medications'],
          ) ??
          '',
    );

    final criteriaJson = _semanticCriteriaJson(
      semanticCriteria?['criteria_json'],
    );
    final sourceType = semanticCriteria?['source_type']?.toString();
    setState(() {
      _setDropdownValue('primaryPurpose', text('primary_purpose'));
      _setDropdownValue('trialPhase', text('trial_phase'));
      _setDropdownValue('studyType', text('study_type'));
      _setDropdownValue('allocation', text('allocation'));
      _setDropdownValue('interventionModel', text('intervention_model'));
      _applyStoredMasking(text('masking'));
      _setDropdownValue('gender', text('gender'));
      _setDropdownValue('pregnancy', exclusionCriteria['Pregnancy']);
      _loadedSemanticSourceType = sourceType;
      _replaceStructuredSemanticCriteria = false;
      _selectedDocumentName = null;
      _semanticCriteriaChangedByUser = false;
      _supplementalCriteria = sourceType != null
          ? {
              ...criteriaJson,
              'summary': semanticCriteria?['summary'] ?? '',
            }
          : null;
      _controller('additionalCriteriaInformation').text =
          sourceType == 'manual_form'
              ? _manualCriteriaTextFromCriteriaJson(criteriaJson)
              : '';
      _missingRequiredFields = const [];
      _fieldsNeedingReview = const [];
      _reviewedFields.clear();
      _trialIdDuplicateValue = null;
    });
    _cleanEditSnapshot = _formStateFingerprint();
  }

  String _dateOnly(dynamic value) {
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty || text == '-') return '';
    final parsed = DateTime.tryParse(text.replaceFirst(' ', 'T'));
    if (parsed == null) return text.split('T').first;
    return parsed.toIso8601String().split('T').first;
  }

  void _applyStoredMasking(String value) {
    final text = value.trim();
    final lower = text.toLowerCase();
    if (lower.startsWith('double')) {
      _values['masking'] = 'Double';
      _participantMasked =
          lower.contains('participant') || !lower.contains('(');
      _investigatorMasked =
          lower.contains('investigator') || !lower.contains('(');
      return;
    }
    if (lower.startsWith('single')) {
      _values['masking'] = 'Single';
      _participantMasked = lower.contains('participant');
      _investigatorMasked = lower.contains('investigator');
      return;
    }
    _values['masking'] = 'None (Open Label)';
    _participantMasked = false;
    _investigatorMasked = false;
  }

  Map<String, dynamic> _semanticCriteriaJson(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    if (value is String && value.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(value);
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {
        return const <String, dynamic>{};
      }
    }
    return const <String, dynamic>{};
  }

  String _manualCriteriaTextFromCriteriaJson(
      Map<String, dynamic> criteriaJson) {
    final items =
        (criteriaJson['additionalTrialInformation'] as List?) ?? const [];
    return items
        .whereType<Map>()
        .map((item) => _stringValue(item['criterion']) ?? '')
        .where((item) => item.trim().isNotEmpty)
        .join('\n\n');
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    for (final focusNode in _focusNodes.values) {
      focusNode.dispose();
    }
    _extractionProgress.dispose();
    super.dispose();
  }

  String _formStateFingerprint() {
    final controllerValues = <String, String>{};
    final keys = _controllers.keys.toList()..sort();
    for (final key in keys) {
      controllerValues[key] = _controller(key).text;
    }
    return _stableJson({
      'controllers': controllerValues,
      'values': Map<String, String>.from(_values),
      'participantMasked': _participantMasked,
      'investigatorMasked': _investigatorMasked,
      'selectedDocumentName': _selectedDocumentName,
      'supplementalCriteria': _supplementalCriteria,
      'replaceStructuredSemanticCriteria': _replaceStructuredSemanticCriteria,
      'semanticCriteriaChangedByUser': _semanticCriteriaChangedByUser,
    });
  }

  bool get _hasUnsavedEditChanges =>
      _isEditMode &&
      _cleanEditSnapshot != null &&
      _formStateFingerprint() != _cleanEditSnapshot;

  Future<void> _cancelEdit() async {
    if (!_isEditMode || _submitting || _initializingEdit) return;
    if (!_hasUnsavedEditChanges) {
      _returnToTrialDetail();
      return;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text('Unsaved changes will be lost.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep Editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard Changes'),
          ),
        ],
      ),
    );
    if (discard == true && mounted) _returnToTrialDetail();
  }

  void _returnToTrialDetail() {
    final trialId = widget.args?.trialId ?? _editTrial?.trialId;
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
      return;
    }
    if (trialId != null) {
      Navigator.pushReplacementNamed(
        context,
        ClinicalTrialDetailScreen.routeName,
        arguments: ClinicalTrialDetailArgs(trialId),
      );
    }
  }

  Future<void> _submit() async {
    setState(() => _showValidationErrors = true);
    if (!_formKey.currentState!.validate()) return;
    final pendingReviewFields = _pendingReviewFieldLabels();
    if (pendingReviewFields.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Review flagged fields before '
            '${_isEditMode ? 'saving changes' : 'creating the trial'}: '
            '${pendingReviewFields.join(', ')}.',
          ),
        ),
      );
      return;
    }
    if (!_isEditMode) {
      final trialIdAvailable =
          await _checkTrialIdAvailability(showSnackBar: true);
      if (!trialIdAvailable || !mounted) return;
    }
    setState(() => _submitting = true);
    final formData = _buildFormData();
    try {
      if (_isEditMode) {
        await _submitEdit(formData);
      } else {
        await _submitCreate(formData);
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Map<String, dynamic> _buildFormData() {
    final formData = <String, dynamic>{
      'phone': _controller('phone').text,
      'country': _controller('country').text,
      'region': _controller('region').text,
      'startDate': _controller('startDate').text,
      'endDate': _controller('endDate').text,
      'primaryPurpose': _values['primaryPurpose'],
      'trialPhase': _values['trialPhase'],
      'studyType': _values['studyType'],
      'allocation': _values['allocation'],
      'interventionModel': _values['interventionModel'],
      'masking': _values['masking'],
      'maskingDetails': {
        'participant': _participantMasked,
        'investigator': _investigatorMasked,
      },
      'sponsor': _controller('sponsor').text,
      'principalInvestigator': _controller('principalInvestigator').text,
      'pathology': _controller('pathology').text.trim(),
      'ageRange': '${_controller('ageMin').text}-${_controller('ageMax').text}',
      'gender': _values['gender'],
      'bmi': _bmiCondition(),
      'diseases': _controller('diseases').text.trim(),
      'surgeries': _controller('surgeries').text.trim(),
      'priorMedications': _controller('priorMedications').text,
      'pregnancy': _values['pregnancy'],
      'firstName': _controller('firstName').text,
      'middleName': _controller('middleName').text,
      'lastName': _controller('lastName').text,
      'phoneNumber': _controller('phoneNumber').text,
      'email': _controller('email').text,
      'trialName': _controller('trialName').text,
      'trialId': _controller('trialId').text,
      'officialTitle': _controller('officialTitle').text,
      'briefSummary': _controller('briefSummary').text,
      'detailedDescription': _controller('detailedDescription').text,
      'additionalCriteriaInformation':
          _controller('additionalCriteriaInformation').text,
      'relatedConditions': _controller('relatedConditions').text,
      'ethicsApproval': _controller('ethicsApproval').text,
    };
    return formData;
  }

  Future<void> _submitCreate(Map<String, dynamic> formData) async {
    await widget.api.createClinicalTrial(formData);
    await _saveSupplementalCriteriaIfAny(
      formData['trialId'] as String,
      formData,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Clinical trial created successfully.')),
    );
    Navigator.pushReplacementNamed(
      context,
      ClinicalTrialDetailScreen.routeName,
      arguments: ClinicalTrialDetailArgs(
        int.parse(formData['trialId'] as String),
      ),
    );
  }

  Future<void> _submitEdit(Map<String, dynamic> formData) async {
    final semanticUpdate = _semanticCriteriaUpdateForEdit();
    final criteriaChangedForWarning =
        _criteriaChangedForWarning(formData, semanticUpdate);
    if (_savedRankedResultCount > 0 && criteriaChangedForWarning) {
      final confirmed = await _confirmCriteriaChangingEdit();
      if (confirmed != true) return;
    }

    final result = await widget.api.updateClinicalTrial(
      formData,
      semanticCriteria: semanticUpdate,
    );
    if (!mounted) return;

    final editResult = ClinicalTrialEditResult(
      trialId: int.parse(formData['trialId'] as String),
      criteriaChanged: result['criteriaChanged'] == true,
      clearedRankedResultCount:
          int.tryParse(result['clearedRankedResultCount']?.toString() ?? '') ??
              0,
    );
    if (Navigator.canPop(context)) {
      Navigator.pop(context, editResult);
      return;
    }
    Navigator.pushReplacementNamed(
      context,
      ClinicalTrialDetailScreen.routeName,
      arguments: ClinicalTrialDetailArgs(editResult.trialId),
    );
  }

  Future<Map<String, dynamic>?> _supplementalCriteriaForSubmit(
    Map<String, dynamic> formData,
  ) async {
    if (_supplementalCriteria != null) {
      return _supplementalCriteriaWithManualText(_supplementalCriteria!);
    }
    if (_selectedDocumentName == null) {
      final manualCriteria =
          _controller('additionalCriteriaInformation').text.trim();
      final Map<String, dynamic> supplemental = {
        'additionalTrialInformation': [
          if (manualCriteria.isNotEmpty)
            {
              'category': 'Manual Entry',
              'criterion': manualCriteria,
              'sourceText': manualCriteria,
              'relevance': 'High',
              'notes': null,
            },
        ],
        'summary': manualCriteria.isEmpty
            ? ''
            : 'Manual additional trial / criteria information entered by the user.',
        'missingOrAmbiguousCriteria': const <String>[],
      };
      if (mounted) {
        setState(() => _supplementalCriteria = supplemental);
      }
      return supplemental;
    }
    try {
      final supplemental =
          await widget.api.extractManualSupplementalCriteria(formData);
      if (mounted) {
        setState(() => _supplementalCriteria = supplemental);
      }
      return supplemental;
    } catch (error) {
      if (!mounted) return null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Clinical trial created, but manual supplemental criteria extraction failed: $error',
          ),
        ),
      );
      return null;
    }
  }

  Map<String, dynamic> _supplementalCriteriaWithManualText(
    Map<String, dynamic> supplemental,
  ) {
    if (_selectedDocumentName != null) return supplemental;
    final manualText = _controller('additionalCriteriaInformation').text.trim();
    if (manualText.isEmpty) return supplemental;

    final existingItems =
        (supplemental['additionalTrialInformation'] as List? ?? const [])
            .whereType<Map>()
            .map(Map<String, dynamic>.from)
            .toList();
    final duplicate = existingItems.any(
      (item) =>
          _normalizedCriterionKey(item['criterion']) ==
          _normalizedCriterionKey(manualText),
    );
    if (duplicate) return supplemental;

    return {
      ...supplemental,
      'additionalTrialInformation': [
        ...existingItems,
        {
          'category': 'Manual Entry',
          'criterion': manualText,
          'sourceText': manualText,
          'relevance': 'High',
          'notes': null,
        },
      ],
      'summary': _stringValue(supplemental['summary']) ??
          'Manual additional trial / criteria information entered by the user.',
    };
  }

  Future<void> _saveSupplementalCriteriaIfAny(
    String trialId,
    Map<String, dynamic> formData,
  ) async {
    final supplemental = await _supplementalCriteriaForSubmit(formData);
    if (supplemental == null || supplemental['error'] != null) return;
    final items =
        (supplemental['additionalTrialInformation'] as List?) ?? const [];
    final summary = _stringValue(supplemental['summary']) ?? '';
    final missingOrAmbiguous =
        _stringList(supplemental['missingOrAmbiguousCriteria']);
    final sourceType =
        _selectedDocumentName == null ? 'manual_form' : 'supplemental_agent';
    if (items.isEmpty &&
        summary.isEmpty &&
        missingOrAmbiguous.isEmpty &&
        sourceType != 'manual_form') {
      return;
    }

    try {
      await widget.api.saveSemanticCriteria(
        trialId: trialId,
        additionalTrialInformation:
            items.whereType<Map>().map(Map<String, dynamic>.from).toList(),
        summary: summary,
        missingOrAmbiguousCriteria: missingOrAmbiguous,
        sourceType: sourceType,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Trial created, but saving supplemental criteria failed: $error',
          ),
        ),
      );
    }
  }

  String _bmiCondition() {
    final min = _controller('bmiMin').text;
    final max = _controller('bmiMax').text;
    if (min.isEmpty && max.isEmpty) return _isEditMode ? '' : '> 1 and < 99';
    if (min.isNotEmpty && max.isNotEmpty) return '> $min and < $max';
    if (min.isNotEmpty) return '> $min';
    return '< $max';
  }

  Map<String, dynamic>? _semanticCriteriaUpdateForEdit() {
    if (!_isEditMode) return null;
    if (_selectedDocumentName != null && _supplementalCriteria != null) {
      final supplemental = _supplementalCriteriaWithManualText(
        _supplementalCriteria!,
      );
      if (supplemental['error'] != null) return null;
      return {
        'changed': true,
        'sourceType': 'supplemental_agent',
        'additionalTrialInformation':
            (supplemental['additionalTrialInformation'] as List? ?? const [])
                .whereType<Map>()
                .map(Map<String, dynamic>.from)
                .toList(),
        'summary': _stringValue(supplemental['summary']) ?? '',
        'missingOrAmbiguousCriteria':
            _stringList(supplemental['missingOrAmbiguousCriteria']),
      };
    }

    final sourceType = _originalSemanticCriteriaRow?['source_type']?.toString();
    if (_semanticCriteriaChangedByUser && _supplementalCriteria != null) {
      final supplemental = _supplementalCriteriaWithManualText(
        _supplementalCriteria!,
      );
      if (supplemental['error'] != null) return null;
      return {
        'changed': true,
        'sourceType': sourceType ?? _loadedSemanticSourceType ?? 'manual_form',
        'additionalTrialInformation':
            (supplemental['additionalTrialInformation'] as List? ?? const [])
                .whereType<Map>()
                .map(Map<String, dynamic>.from)
                .toList(),
        'summary': _stringValue(supplemental['summary']) ?? '',
        'missingOrAmbiguousCriteria':
            _stringList(supplemental['missingOrAmbiguousCriteria']),
      };
    }

    final shouldUseManual = sourceType == null ||
        sourceType == 'manual_form' ||
        _replaceStructuredSemanticCriteria;
    if (!shouldUseManual) return null;

    final manualText = _controller('additionalCriteriaInformation').text.trim();
    final originalText = _manualCriteriaTextFromCriteriaJson(
      _semanticCriteriaJson(_originalSemanticCriteriaRow?['criteria_json']),
    ).trim();
    if (sourceType == 'manual_form' &&
        _normalizeText(manualText) == _normalizeText(originalText)) {
      return null;
    }
    if (sourceType == null && manualText.isEmpty) return null;

    return _manualSemanticCriteriaPayload(manualText);
  }

  Map<String, dynamic> _manualSemanticCriteriaPayload(String manualText) {
    return {
      'changed': true,
      'sourceType': 'manual_form',
      'additionalTrialInformation': [
        if (manualText.isNotEmpty)
          {
            'category': 'Manual Entry',
            'criterion': manualText,
            'sourceText': manualText,
            'relevance': 'High',
            'notes': null,
          },
      ],
      'summary': manualText.isEmpty
          ? ''
          : 'Manual additional trial / criteria information entered by the user.',
      'missingOrAmbiguousCriteria': const <String>[],
    };
  }

  bool _criteriaChangedForWarning(
    Map<String, dynamic> formData,
    Map<String, dynamic>? semanticUpdate,
  ) {
    final trial = _editTrial;
    if (trial == null) return false;
    final oldSnapshot = _criteriaSnapshotFromTrial(
      trial,
      _originalSemanticCriteriaRow,
    );
    final effectiveSemanticRow = semanticUpdate == null
        ? _originalSemanticCriteriaRow
        : {
            'source_type': semanticUpdate['sourceType'],
            'summary': semanticUpdate['summary'],
            'criteria_json': {
              'additionalTrialInformation':
                  semanticUpdate['additionalTrialInformation'] ?? const [],
              'missingOrAmbiguousCriteria':
                  semanticUpdate['missingOrAmbiguousCriteria'] ?? const [],
            },
          };
    final nextSnapshot = _criteriaSnapshotFromForm(
      formData,
      effectiveSemanticRow,
    );
    return _stableJson(oldSnapshot) != _stableJson(nextSnapshot);
  }

  Map<String, dynamic> _criteriaSnapshotFromTrial(
    ClinicalTrial trial,
    Map<String, dynamic>? semanticRow,
  ) {
    final exclusionCriteria = trial.exclusionCriteria;
    return {
      'relatedConditions': _normalizeClinicalList(
        trial.data['related_conditions'],
      ),
      'pathology': _normalizeClinicalList(trial.data['pathology']),
      'ageRange': _normalizeAgeRange(trial.data['age_range']),
      'gender': _normalizeText(trial.data['gender']),
      'exclusionCriteria': {
        'bmi': _normalizeBmiRange(exclusionCriteria['BMI']),
        'diseases': _normalizeClinicalList(exclusionCriteria['Diseases']),
        'surgeries': _normalizeClinicalList(exclusionCriteria['Surgeries']),
        'priorMedications': _normalizeClinicalList(
          exclusionCriteria['PriorMedications'] ??
              exclusionCriteria['Prior Medications'],
        ),
        'pregnancy': _normalizeText(exclusionCriteria['Pregnancy']),
      },
      'semanticCriteria': _normalizeSemanticCriteriaRow(semanticRow),
    };
  }

  Map<String, dynamic> _criteriaSnapshotFromForm(
    Map<String, dynamic> formData,
    Map<String, dynamic>? semanticRow,
  ) {
    return {
      'relatedConditions':
          _normalizeClinicalList(formData['relatedConditions']),
      'pathology': _normalizeClinicalList(formData['pathology']),
      'ageRange': _normalizeAgeRange(formData['ageRange']),
      'gender': _normalizeText(formData['gender']),
      'exclusionCriteria': {
        'bmi': _normalizeBmiRange(formData['bmi']),
        'diseases': _normalizeClinicalList(formData['diseases']),
        'surgeries': _normalizeClinicalList(formData['surgeries']),
        'priorMedications':
            _normalizeClinicalList(formData['priorMedications']),
        'pregnancy': _normalizeText(formData['pregnancy']),
      },
      'semanticCriteria': _normalizeSemanticCriteriaRow(semanticRow),
    };
  }

  String? _normalizeText(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return null;
    return text.replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
  }

  List<String> _normalizeClinicalList(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return const [];
    final items = text
        .split(RegExp(r'[,;\n]+'))
        .map(_normalizeText)
        .whereType<String>()
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    return items;
  }

  Map<String, num?> _normalizeAgeRange(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return const <String, num?>{'min': null, 'max': null};
    final numbers = RegExp(r'\d+(?:\.\d+)?')
        .allMatches(text)
        .map((match) => num.tryParse(match.group(0)!))
        .whereType<num>()
        .toList();
    if (numbers.length == 1 &&
        (text.trimLeft().startsWith('-') || text.contains('<'))) {
      return {'min': null, 'max': numbers[0]};
    }
    return {
      'min': numbers.isNotEmpty ? numbers[0] : null,
      'max': numbers.length > 1 ? numbers[1] : null,
    };
  }

  Map<String, dynamic> _normalizeBmiRange(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return const {'min': null, 'max': null};
    final numbers = RegExp(r'\d+(?:\.\d+)?')
        .allMatches(text)
        .map((match) => num.tryParse(match.group(0)!))
        .whereType<num>()
        .toList();
    if (numbers.length >= 2) {
      final sorted = [numbers[0], numbers[1]]..sort();
      return {'min': sorted[0], 'max': sorted[1]};
    }
    if (numbers.length == 1 && text.contains('>')) {
      return {'min': numbers[0], 'max': null};
    }
    if (numbers.length == 1 && text.contains('<')) {
      return {'min': null, 'max': numbers[0]};
    }
    if (numbers.length == 1 && text.trimLeft().startsWith('-')) {
      return {'min': null, 'max': numbers[0]};
    }
    return {'min': null, 'max': null, 'raw': _normalizeText(text)};
  }

  Map<String, dynamic>? _normalizeSemanticCriteriaRow(
    Map<String, dynamic>? row,
  ) {
    if (row == null) return null;
    return _normalizeJson({
      'sourceType': row['source_type'] ?? row['sourceType'],
      'summary': row['summary'],
      'criteriaJson': _semanticCriteriaJson(row['criteria_json']),
    }) as Map<String, dynamic>?;
  }

  dynamic _normalizeJson(dynamic value) {
    if (value == null) return null;
    if (value is String) return _normalizeText(value);
    if (value is num || value is bool) return value;
    if (value is List) {
      final items = value
          .map(_normalizeJson)
          .where((item) => item != null)
          .toList()
        ..sort((a, b) => _stableJson(a).compareTo(_stableJson(b)));
      return items;
    }
    if (value is Map) {
      final normalized = <String, dynamic>{};
      final keys = value.keys.map((key) => key.toString()).toList()..sort();
      for (final key in keys) {
        final item = _normalizeJson(value[key]);
        if (item != null) normalized[key] = item;
      }
      return normalized;
    }
    return _normalizeText(value);
  }

  String _stableJson(dynamic value) {
    if (value is Map) {
      final keys = value.keys.map((key) => key.toString()).toList()..sort();
      return '{${keys.map(
            (key) => '${jsonEncode(key)}:${_stableJson(value[key])}',
          ).join(',')}}';
    }
    if (value is List) {
      return '[${value.map(_stableJson).join(',')}]';
    }
    return jsonEncode(value);
  }

  Future<bool?> _confirmCriteriaChangingEdit() {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Saved Ranked Results?'),
        content: const Text(
          'The eligibility criteria changed. The saved ranked dashboard was '
          'generated using the previous criteria and will be cleared. Run '
          'matching again after saving to generate updated rankings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save Changes'),
          ),
        ],
      ),
    );
  }

  Future<void> _pickAndExtractDocument() async {
    _ExtractionDialogController? progressDialog;
    _FormSnapshot? extractionSnapshot;
    int? extractionId;

    try {
      final selectedFile = await _pickDocumentFile();
      if (selectedFile == null) {
        return;
      }
      extractionId = ++_activeExtractionId;
      _cancelledExtractionIds.remove(extractionId);
      _extractionCancelCompleters[extractionId] = Completer<void>();
      extractionSnapshot = _captureFormSnapshot();
      _activeExtractionSnapshot = extractionSnapshot;
      setState(() {
        _extractionError = null;
        _extractionMessage = null;
        _selectedDocumentName = null;
        _missingRequiredFields = const [];
        _fieldsNeedingReview = const [];
        _reviewedFields.clear();
        _supplementalCriteria = null;
        _replaceStructuredSemanticCriteria = false;
        _semanticCriteriaChangedByUser = false;
        _showValidationErrors = false;
        _trialIdDuplicateValue = null;
      });
      _controller('additionalCriteriaInformation').clear();

      if (!mounted) return;
      _updateExtractionProgress(0, 'Preparing ${selectedFile.name}.');
      setState(() => _extracting = true);
      progressDialog = _showExtractionProgressDialog(extractionId);
      await progressDialog.waitUntilRendered();

      await _runExtractionStep(
        extractionId,
        0,
        'Preparing ${selectedFile.name}.',
        () async {},
      );
      await _runExtractionStep(
        extractionId,
        1,
        'Uploading ${selectedFile.name}.',
        () async {},
      );
      final extraction = await _runExtractionStep(
        extractionId,
        2,
        'Extracting structured trial fields from the document.',
        () => widget.api.extractTrialFields(
          filename: selectedFile.name,
          bytes: selectedFile.bytes,
        ),
      );
      await _runExtractionStep(
        extractionId,
        3,
        'Applying extracted fields to the form.',
        () async => _applyExtractedFields(extraction),
      );

      if (!mounted || _isExtractionCancelled(extractionId)) {
        throw const _ExtractionCancelled();
      }
      await _runExtractionStep(
        extractionId,
        4,
        'Ready for review.',
        () async {},
      );
      _updateExtractionProgress(
        4,
        'Document extraction complete. Review the populated fields.',
        complete: true,
      );

      if (!mounted || _isExtractionCancelled(extractionId)) {
        throw const _ExtractionCancelled();
      }
      setState(() {
        _selectedDocumentName = selectedFile.name;
        _extractionMessage =
            'Extracted fields from ${selectedFile.name}. Review the form before '
            '${_isEditMode ? 'saving changes' : 'creating the trial'}.';
        _showValidationErrors = true;
      });
      _formKey.currentState?.validate();
      if (progressDialog.wasRendered) {
        await Future<void>.delayed(const Duration(milliseconds: 700));
      }
    } on _ExtractionCancelled {
      if (mounted && extractionSnapshot != null) {
        _restoreFormSnapshot(extractionSnapshot);
      }
    } catch (error) {
      if (!mounted) return;
      final message = error.toString();
      _updateExtractionProgress(
        _extractionProgress.value.stepIndex,
        message,
        failed: true,
      );
      setState(() => _extractionError = message);
      if (progressDialog?.wasRendered == true) {
        await Future<void>.delayed(const Duration(milliseconds: 1400));
      }
    } finally {
      if (mounted) {
        setState(() => _extracting = false);
        progressDialog?.close();
      }
      if (extractionSnapshot != null &&
          identical(_activeExtractionSnapshot, extractionSnapshot)) {
        _activeExtractionSnapshot = null;
      }
      if (extractionId != null) {
        _extractionCancelCompleters.remove(extractionId);
      }
    }
  }

  Future<T> _runExtractionStep<T>(
    int extractionId,
    int stepIndex,
    String detail,
    Future<T> Function() action,
  ) async {
    if (_isExtractionCancelled(extractionId)) {
      throw const _ExtractionCancelled();
    }
    _updateExtractionProgress(stepIndex, detail);
    final stopwatch = Stopwatch()..start();
    try {
      final cancelFuture = _extractionCancelCompleters[extractionId]?.future;
      final result = cancelFuture == null
          ? await action()
          : await Future.any<T>([
              action(),
              cancelFuture.then<T>((_) => throw const _ExtractionCancelled()),
            ]);
      if (_isExtractionCancelled(extractionId)) {
        throw const _ExtractionCancelled();
      }
      return result;
    } finally {
      final remaining = 500 - stopwatch.elapsedMilliseconds;
      if (remaining > 0) {
        await Future<void>.delayed(Duration(milliseconds: remaining));
      }
      if (_isExtractionCancelled(extractionId)) {
        throw const _ExtractionCancelled();
      }
    }
  }

  bool _isExtractionCancelled(int extractionId) =>
      extractionId != _activeExtractionId ||
      _cancelledExtractionIds.contains(extractionId);

  void _cancelExtraction(int extractionId) {
    if (extractionId != _activeExtractionId) return;
    _cancelledExtractionIds.add(extractionId);
    final cancelCompleter = _extractionCancelCompleters[extractionId];
    if (cancelCompleter != null && !cancelCompleter.isCompleted) {
      cancelCompleter.complete();
    }
    final snapshot = _activeExtractionSnapshot;
    if (snapshot != null) _restoreFormSnapshot(snapshot);
    if (mounted) setState(() => _extracting = false);
  }

  _FormSnapshot _captureFormSnapshot() {
    final controllerValues = <String, String>{};
    for (final entry in _controllers.entries) {
      controllerValues[entry.key] = entry.value.text;
    }
    return _FormSnapshot(
      controllerValues: controllerValues,
      values: Map<String, String>.from(_values),
      participantMasked: _participantMasked,
      investigatorMasked: _investigatorMasked,
      selectedDocumentName: _selectedDocumentName,
      extractionMessage: _extractionMessage,
      extractionError: _extractionError,
      missingRequiredFields: List<String>.from(_missingRequiredFields),
      fieldsNeedingReview: List<String>.from(_fieldsNeedingReview),
      reviewedFields: Set<String>.from(_reviewedFields),
      supplementalCriteria: _cloneJsonMap(_supplementalCriteria),
      replaceStructuredSemanticCriteria: _replaceStructuredSemanticCriteria,
      semanticCriteriaChangedByUser: _semanticCriteriaChangedByUser,
      showValidationErrors: _showValidationErrors,
      trialIdDuplicateValue: _trialIdDuplicateValue,
    );
  }

  void _restoreFormSnapshot(_FormSnapshot snapshot) {
    for (final entry in snapshot.controllerValues.entries) {
      _controller(entry.key).text = entry.value;
    }
    setState(() {
      _values
        ..clear()
        ..addAll(snapshot.values);
      _participantMasked = snapshot.participantMasked;
      _investigatorMasked = snapshot.investigatorMasked;
      _selectedDocumentName = snapshot.selectedDocumentName;
      _extractionMessage = snapshot.extractionMessage;
      _extractionError = snapshot.extractionError;
      _missingRequiredFields =
          List<String>.from(snapshot.missingRequiredFields);
      _fieldsNeedingReview = List<String>.from(snapshot.fieldsNeedingReview);
      _reviewedFields
        ..clear()
        ..addAll(snapshot.reviewedFields);
      _supplementalCriteria = _cloneJsonMap(snapshot.supplementalCriteria);
      _replaceStructuredSemanticCriteria =
          snapshot.replaceStructuredSemanticCriteria;
      _semanticCriteriaChangedByUser = snapshot.semanticCriteriaChangedByUser;
      _showValidationErrors = snapshot.showValidationErrors;
      _trialIdDuplicateValue = snapshot.trialIdDuplicateValue;
    });
  }

  Map<String, dynamic>? _cloneJsonMap(Map<String, dynamic>? value) {
    if (value == null) return null;
    return Map<String, dynamic>.from(jsonDecode(jsonEncode(value)) as Map);
  }

  void _updateExtractionProgress(
    int stepIndex,
    String detail, {
    bool failed = false,
    bool complete = false,
  }) {
    _extractionProgress.value = _ExtractionProgress(
      stepIndex,
      detail,
      failed: failed,
      complete: complete,
    );
  }

  _ExtractionDialogController _showExtractionProgressDialog(int extractionId) {
    final controller = _ExtractionDialogController();
    final dialogFuture = showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        controller.dialogContext = dialogContext;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          controller.markRendered();
        });
        return ValueListenableBuilder<_ExtractionProgress>(
          valueListenable: _extractionProgress,
          builder: (context, progress, _) {
            return _ExtractionProgressDialog(
              progress: progress,
              onCancel: progress.complete
                  ? null
                  : () {
                      _cancelExtraction(extractionId);
                      controller.close();
                    },
            );
          },
        );
      },
    );
    unawaited(dialogFuture.whenComplete(() {
      controller.markClosed();
    }).catchError((Object _) {}));
    return controller;
  }

  Future<SelectedDocument?> _pickDocumentFile() => widget.documentPicker();

  Future<void> _applyExtractedFields(Map<String, dynamic> extraction) async {
    final fields = extraction['extractedFields'];
    if (fields is! Map) return;
    final extracted = Map<String, dynamic>.from(fields);

    void setText(String key, dynamic value) {
      final text = _stringValue(value);
      if (text != null && text.isNotEmpty) _controller(key).text = text;
    }

    setText('trialName', extracted['trialName']);
    setText('officialTitle', extracted['officialTitle']);
    setText('briefSummary', extracted['briefSummary']);
    setText('detailedDescription', extracted['detailedDescription']);
    setText('startDate', extracted['startDate']);
    setText('endDate', extracted['endDate']);
    setText('sponsor', extracted['sponsor']);
    setText('principalInvestigator', extracted['principalInvestigator']);
    setText('ethicsApproval', extracted['ethicsApproval']);
    setText('relatedConditions', extracted['relatedConditions']);
    setText('priorMedications', extracted['priorMedications']);
    setText('pathology', extracted['pathology']);
    setText('diseases', extracted['diseases']);
    setText('surgeries', extracted['surgeries']);
    _applyLocation(extracted['location']);
    _applyAgeRange(extracted['ageRange']);
    _applyBmiRange(extracted['bmiRange']);

    setState(() {
      _setDropdownValue('primaryPurpose', extracted['primaryPurpose']);
      _setDropdownValue('trialPhase', extracted['trialPhase']);
      _setDropdownValue('studyType', extracted['studyType']);
      _setDropdownValue('allocation', extracted['allocation']);
      _setDropdownValue('interventionModel', extracted['interventionModel']);
      _setDropdownValue('masking', extracted['masking']);
      _applyMaskingDetails(extracted['maskingDetails'], _values['masking']);
      _setDropdownValue('gender', extracted['gender']);
      _setDropdownValue('pregnancy', extracted['pregnancy']);
      _missingRequiredFields = _stringList(extraction['missingRequiredFields']);
      _fieldsNeedingReview = {
        ..._stringList(
          extraction['fieldsNeedingReview'],
        ).where((field) => field != 'trialId'),
      }.toList();
      _reviewedFields.clear();
      final supplemental = extraction['supplementalCriteria'];
      _supplementalCriteria =
          supplemental is Map ? Map<String, dynamic>.from(supplemental) : null;
      _semanticCriteriaChangedByUser = false;
      if (_isEditMode && _supplementalCriteria != null) {
        _loadedSemanticSourceType = 'supplemental_agent';
        _replaceStructuredSemanticCriteria = false;
      }
    });
    if (!_isEditMode) {
      await _loadNextTrialId(replaceInvalid: true);
    }
  }

  void _applyMaskingDetails(dynamic value, dynamic maskingValue) {
    final details = value is Map ? Map<String, dynamic>.from(value) : null;
    final participant = details?['participant'];
    final investigator = details?['investigator'];
    if (participant is bool) _participantMasked = participant;
    if (investigator is bool) _investigatorMasked = investigator;

    final maskingText = _stringValue(maskingValue)?.toLowerCase().trim();
    if (details == null && maskingText == 'double') {
      _participantMasked = true;
      _investigatorMasked = true;
    }
    if (maskingText == 'none (open label)' ||
        maskingText == 'open label' ||
        maskingText == 'open-label') {
      _participantMasked = false;
      _investigatorMasked = false;
    }
  }

  void _setDropdownValue(String key, dynamic value) {
    final text = _stringValue(value);
    if (text != null && text.isNotEmpty) {
      _values[key] = _normalizeDropdownValue(key, text);
    }
  }

  void _setDropdownValueFromUser(String key, String? value) {
    setState(() {
      _values[key] = value ?? '';
      if (key == 'masking') {
        _syncMaskingCheckboxesForChoice(_values[key]);
      }
    });
  }

  void _syncMaskingCheckboxesForChoice(String? value) {
    final maskingText = value?.toLowerCase().trim();
    if (maskingText == 'double') {
      _participantMasked = true;
      _investigatorMasked = true;
    }
    if (maskingText == 'none (open label)' ||
        maskingText == 'open label' ||
        maskingText == 'open-label') {
      _participantMasked = false;
      _investigatorMasked = false;
    }
  }

  String _normalizeDropdownValue(String key, String value) {
    final normalized = value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    final options = switch (key) {
      'primaryPurpose' => [
          'Treatment',
          'Prevention',
          'Diagnostic',
          'Supportive Care',
        ],
      'trialPhase' => _trialPhaseOptions,
      'studyType' => ['Interventional', 'Observational'],
      'allocation' => _allocationOptions,
      'interventionModel' => _interventionModelOptions,
      'masking' => ['None (Open Label)', 'Single', 'Double'],
      'gender' => ['Male', 'Female', 'Both'],
      'pregnancy' => ['Yes', 'No', 'Unrestricted'],
      _ => const <String>[],
    };

    for (final option in options) {
      final optionKey =
          option.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
      if (normalized == optionKey || normalized.contains(optionKey)) {
        return option;
      }
    }
    if (key == 'trialPhase') {
      if (normalized == 'PHASE1') return 'Phase I';
      if (normalized == 'PHASE2') return 'Phase II';
      if (normalized == 'PHASE3') return 'Phase III';
      if (normalized == 'PHASE4') return 'Phase IV';
      if (normalized == 'EARLYPHASE1') return 'Early Phase I';
      if (normalized == 'PHASE12' || normalized == 'PHASE1PHASE2') {
        return 'Phase I/II';
      }
      if (normalized == 'PHASE23' || normalized == 'PHASE2PHASE3') {
        return 'Phase II/III';
      }
      if (normalized == 'NA' || normalized == 'NOTAPPLICABLE') {
        return 'Not Applicable';
      }
    }
    if ((key == 'allocation' || key == 'interventionModel') &&
        (normalized == 'NA' || normalized == 'NOTAPPLICABLE')) {
      return 'N/A';
    }
    return value;
  }

  void _applyLocation(dynamic value) {
    final location = _stringValue(value);
    if (location == null || location.isEmpty) return;
    final parts = location
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.length >= 2) {
      _controller('region').text = parts.take(parts.length - 1).join(', ');
      _controller('country').text = parts.last;
    } else if (_looksLikeCountry(location)) {
      _controller('country').text = location;
    } else {
      _controller('region').text = location;
    }
  }

  bool _looksLikeCountry(String value) {
    final normalized = value.toUpperCase().replaceAll(RegExp(r'[^A-Z]'), '');
    const knownCountries = {
      'UNITEDSTATES',
      'UNITEDSTATESOFAMERICA',
      'USA',
      'US',
      'CANADA',
      'UNITEDKINGDOM',
      'UK',
      'ENGLAND',
      'AUSTRALIA',
      'GERMANY',
      'FRANCE',
      'SPAIN',
      'ITALY',
      'NETHERLANDS',
      'BELGIUM',
      'SWITZERLAND',
      'SWEDEN',
      'NORWAY',
      'DENMARK',
      'FINLAND',
      'IRELAND',
      'JAPAN',
      'CHINA',
      'INDIA',
      'BRAZIL',
      'MEXICO',
    };
    return knownCountries.contains(normalized);
  }

  void _applyAgeRange(dynamic value) {
    if (value is Map) {
      _controller('ageMin').text = _stringValue(value['min']) ?? '';
      _controller('ageMax').text = _stringValue(value['max']) ?? '';
      return;
    }
    final text = _stringValue(value);
    if (text == null) return;
    final numbers = RegExp(r'\d+').allMatches(text).map((m) => m.group(0)!);
    final values = numbers.toList();
    if (values.length == 1 &&
        (text.trimLeft().startsWith('-') || text.contains('<'))) {
      _controller('ageMax').text = values.first;
      return;
    }
    if (values.isNotEmpty) _controller('ageMin').text = values.first;
    if (values.length > 1) _controller('ageMax').text = values[1];
  }

  void _applyBmiRange(dynamic value) {
    final text = _stringValue(value);
    if (text == null) return;
    final numbers =
        RegExp(r'\d+(?:\.\d+)?').allMatches(text).map((m) => m.group(0)!);
    final values = numbers.toList();
    if (values.length == 1 &&
        (text.trimLeft().startsWith('-') || text.contains('<'))) {
      _controller('bmiMax').text = values.first;
      return;
    }
    if (values.isNotEmpty) _controller('bmiMin').text = values.first;
    if (values.length > 1) _controller('bmiMax').text = values[1];
  }

  String? _stringValue(dynamic value) {
    if (value == null) return null;
    if (value is List) return value.where((item) => item != null).join(', ');
    if (value is Map) {
      return value.values.where((item) => item != null).join('-');
    }
    final text = value.toString().trim();
    return text.isEmpty || text.toLowerCase() == 'null' ? null : text;
  }

  List<String> _stringList(dynamic value) {
    if (value is! List) return const [];
    return value
        .map((item) => item.toString())
        .where((item) => item.trim().isNotEmpty)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return ClinicalTrialScaffold(
      title: _isEditMode ? 'Edit Trial' : 'Create Clinical Trial',
      selectedSection: WorkspaceSection.createTrial,
      toolbarHeight: 72,
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 12),
          child: _topActions(),
        ),
      ],
      child: _formBody(),
    );
  }

  Widget _formBody() {
    if (_initializingEdit) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_editLoadError != null) {
      return ErrorState(message: _editLoadError!, onRetry: _loadTrialForEdit);
    }

    return PopScope(
      canPop: !_isEditMode || !_hasUnsavedEditChanges,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _isEditMode) unawaited(_cancelEdit());
      },
      child: Form(
        key: _formKey,
        autovalidateMode: _showValidationErrors
            ? AutovalidateMode.always
            : AutovalidateMode.disabled,
        child: ListView(
          children: [
            _extractionStatus(),
            _contactInformationSection(),
            _trialBasicInformationSection(),
            _descriptionsSection(),
            _trialDetailsSection(),
            _inclusionCriteriaSection(),
            _exclusionCriteriaSection(),
            _semanticCriteriaReplacementSection(),
            if (_showManualAdditionalCriteriaSection())
              _manualAdditionalCriteriaSection(),
            _supplementalCriteriaPanel(),
          ],
        ),
      ),
    );
  }

  bool _showManualAdditionalCriteriaSection() {
    if (!_isEditMode) return _selectedDocumentName == null;
    if (_selectedDocumentName != null) return false;
    return _loadedSemanticSourceType == null ||
        _loadedSemanticSourceType == 'manual_form' ||
        _replaceStructuredSemanticCriteria;
  }

  Widget _contactInformationSection() {
    return _sectionRows('Contact Information', [
      [
        _field('firstName', 'First Name', required: true),
        _field('middleName', 'Middle Name'),
        _field('lastName', 'Last Name', required: true),
      ],
      [
        _field('email', 'Email', required: true),
        _field('phoneNumber', 'Phone Number', required: true),
        _field('phone', 'Area Code', required: true),
      ],
    ]);
  }

  Widget _trialBasicInformationSection() {
    return _sectionRows('Trial Basic Information', [
      [_field('officialTitle', 'Official Title', required: true)],
      [
        _field('trialName', 'Trial Name', required: true),
        _trialIdField(),
      ],
      [
        _field('country', 'Country', required: true),
        _field(
          'region',
          'Region / State',
          required: true,
          expandedEditor: true,
          expandedHelperText: 'Use commas for multiple regions/states.',
        ),
      ],
    ]);
  }

  Widget _descriptionsSection() {
    return _sectionRows('Descriptions', [
      [
        _field('briefSummary', 'Brief Summary', maxLines: 4, required: true),
        _field(
          'detailedDescription',
          'Detailed Description',
          maxLines: 4,
          required: true,
        ),
      ],
    ]);
  }

  Widget _manualAdditionalCriteriaSection() {
    return _sectionRows(
      'Additional Trial / Criteria Information Not Captured by the Base Form',
      [
        [
          _field(
            'additionalCriteriaInformation',
            'Additional Trial / Criteria Information',
            maxLines: 5,
            helperText:
                'For manual entry only: add eligibility details not captured by the form.',
            expandedEditor: true,
            expandedHelperText:
                'Add eligibility details not captured above, such as lab '
                'thresholds, medication requirements, blood pressure ranges, '
                'organ function limits, recent events, washout periods, or '
                'other inclusion/exclusion rules.',
          ),
        ],
      ],
    );
  }

  Widget _semanticCriteriaReplacementSection() {
    if (!_isEditMode ||
        _selectedDocumentName != null ||
        _loadedSemanticSourceType == null ||
        _loadedSemanticSourceType == 'manual_form' ||
        _replaceStructuredSemanticCriteria) {
      return const SizedBox.shrink();
    }

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.lock_outline,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Saved document-extracted additional criteria are preserved as '
                'structured data. Use the add and edit actions below for '
                'targeted changes. Replace them only if you want to discard '
                'the saved extracted criteria and enter new manual criteria.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const SizedBox(width: 12),
            OutlinedButton.icon(
              onPressed: _submitting
                  ? null
                  : () {
                      setState(() {
                        _replaceStructuredSemanticCriteria = true;
                        _controller('additionalCriteriaInformation').clear();
                        _supplementalCriteria = null;
                        _semanticCriteriaChangedByUser = false;
                      });
                    },
              icon: const Icon(Icons.edit_note),
              label: const Text('Replace Criteria'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _trialDetailsSection() {
    return _sectionRows('Trial Details', [
      [
        _dropdown('primaryPurpose', 'Primary Purpose',
            ['Treatment', 'Prevention', 'Diagnostic', 'Supportive Care']),
        _dropdown(
          'studyType',
          'Study Type',
          ['Interventional', 'Observational'],
        ),
        _dropdown('trialPhase', 'Trial Phase', _trialPhaseOptions),
      ],
      [
        _field('startDate', 'Start Date (YYYY-MM-DD)', required: true),
        _field('endDate', 'End Date (YYYY-MM-DD)'),
      ],
      [
        _dropdown('allocation', 'Allocation', _allocationOptions),
        _dropdown(
          'interventionModel',
          'Intervention Model',
          _interventionModelOptions,
        ),
      ],
      [
        _maskingDetailsGroup(),
      ],
      [
        _field('sponsor', 'Sponsor', required: true),
        _field('principalInvestigator', 'Principal Investigator',
            required: true),
        _field('ethicsApproval', 'Ethics Approval', required: true),
      ],
    ]);
  }

  Widget _inclusionCriteriaSection() {
    return _sectionRows('Inclusion Criteria', [
      [
        _autocompleteField(
          'pathology',
          'Primary Pathology / Target Condition',
          _pathologyOptions,
          required: true,
          helperText: 'Start typing or enter a condition.',
          expandedEditor: true,
          expandedHelperText:
              'Use this for the main target condition. Add related wording in Related Conditions.',
        ),
        _autocompleteField(
          'relatedConditions',
          'Related Conditions',
          _conditionOptions,
          required: true,
          allowMultiple: true,
          helperText: 'Use commas for multiple conditions.',
          expandedEditor: true,
        ),
      ],
      [
        _dropdown('gender', 'Gender', ['Male', 'Female', 'Both']),
        _field('ageMin', 'Age Range Min', required: true),
        _field('ageMax', 'Age Range Max', required: true),
      ],
    ]);
  }

  Widget _exclusionCriteriaSection() {
    return _sectionRows('Exclusion Criteria', [
      [
        _field(
          'bmiMin',
          'Min Allowed BMI',
          helperText: 'Patients below this BMI are excluded.',
        ),
        _field(
          'bmiMax',
          'Max Allowed BMI',
          helperText: 'Patients above this BMI are excluded.',
        ),
        _dropdown(
          'pregnancy',
          'Pregnancy Exclusion',
          ['Yes', 'No', 'Unrestricted'],
          helperText: 'Yes means pregnant patients are excluded.',
        ),
      ],
      [
        _autocompleteField(
          'diseases',
          'Diseases',
          _diseaseOptions,
          allowMultiple: true,
          helperText: 'Use commas for multiple disease exclusions.',
          expandedEditor: true,
        ),
        _autocompleteField(
          'surgeries',
          'Surgeries',
          _surgeryOptions,
          allowMultiple: true,
          helperText: 'Use commas for multiple surgery exclusions.',
          expandedEditor: true,
        ),
        _autocompleteField(
          'priorMedications',
          'Medication Exclusions',
          _medicationOptions,
          allowMultiple: true,
          helperText: 'Use commas for multiple medication exclusions.',
          expandedEditor: true,
        ),
      ],
    ]);
  }

  Widget _sectionRows(String title, List<List<Widget>> rows) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                return Column(
                  children: [
                    for (var index = 0; index < rows.length; index++) ...[
                      if (index > 0) const SizedBox(height: 12),
                      _formRow(rows[index], constraints.maxWidth),
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _uploadAction() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        FilledButton.icon(
          onPressed: _extracting || _submitting || _initializingEdit
              ? null
              : _pickAndExtractDocument,
          icon: _extracting
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.upload_file),
          label: const Text('Upload Document'),
        ),
        Text(
          'Accepted: PDF, DOCX, JSON, TXT, MD',
          style: Theme.of(context).textTheme.labelSmall,
        ),
      ],
    );
  }

  Widget _topActions() {
    final compact = MediaQuery.sizeOf(context).width < 1100;
    if (compact) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: 'Upload Document',
            onPressed: _extracting || _submitting || _initializingEdit
                ? null
                : _pickAndExtractDocument,
            icon: _extracting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.upload_file),
          ),
          if (_isEditMode)
            IconButton(
              tooltip: 'Cancel editing',
              onPressed: _submitting || _initializingEdit ? null : _cancelEdit,
              icon: const Icon(Icons.close),
            ),
          IconButton.filled(
            tooltip: _isEditMode ? 'Save Changes' : 'Create Trial',
            onPressed: _submitting || _initializingEdit ? null : _submit,
            icon: _submitting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check),
          ),
        ],
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _uploadAction(),
        const SizedBox(width: 8),
        if (_isEditMode)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: OutlinedButton.icon(
              onPressed: _submitting || _initializingEdit ? null : _cancelEdit,
              icon: const Icon(Icons.close),
              label: const Text('Cancel'),
            ),
          ),
        FilledButton.icon(
          onPressed: _submitting || _initializingEdit ? null : _submit,
          icon: _submitting
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.check),
          label: Text(_isEditMode ? 'Save Changes' : 'Create Trial'),
        ),
      ],
    );
  }

  Widget _extractionStatus() {
    final missingRequiredFields = _visibleMissingRequiredFields();
    final hasStatus = _selectedDocumentName != null ||
        _extractionMessage != null ||
        _extractionError != null ||
        missingRequiredFields.isNotEmpty ||
        _fieldsNeedingReview.isNotEmpty;
    if (!hasStatus) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_extractionMessage != null) ...[
            _notice(_extractionMessage!, Icons.check_circle_outline,
                Theme.of(context).colorScheme.primary),
          ],
          if (_extractionError != null) ...[
            const SizedBox(height: 8),
            _notice(_extractionError!, Icons.error_outline,
                Theme.of(context).colorScheme.error),
          ],
          if (missingRequiredFields.isNotEmpty ||
              _pendingReviewFields().isNotEmpty) ...[
            const SizedBox(height: 8),
            _reviewNotice(missingRequiredFields),
          ],
        ],
      ),
    );
  }

  Widget _notice(String message, IconData icon, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 8),
        Expanded(child: Text(message)),
      ],
    );
  }

  Widget _reviewNotice(List<String> missingRequiredFields) {
    final missing = missingRequiredFields.join(', ');
    final review = _pendingReviewFieldLabels().join(', ');
    final message = [
      if (missing.isNotEmpty) 'Missing required fields: $missing.',
      if (review.isNotEmpty) 'Needs review: $review.',
    ].join('\n');
    return _notice(
      message,
      Icons.fact_check_outlined,
      Theme.of(context).colorScheme.tertiary,
    );
  }

  List<String> _visibleMissingRequiredFields() {
    final missingLabels = <String>{};
    if (_showValidationErrors) {
      missingLabels.addAll(_localMissingRequiredFields());
    }

    for (final field in _missingRequiredFields) {
      final key = field.trim();
      if (key.isEmpty) continue;
      final isFilledRequiredField = _requiredFieldLabels.containsKey(key) &&
          _controller(key).text.trim().isNotEmpty;
      if (!isFilledRequiredField) {
        missingLabels.add(_fieldLabelForReview(key));
      }
    }

    return missingLabels.toList();
  }

  List<String> _localMissingRequiredFields() {
    return _requiredFieldLabels.entries
        .where((entry) => _controller(entry.key).text.trim().isEmpty)
        .map((entry) => entry.value)
        .toList();
  }

  String _fieldLabelForReview(String field) {
    final normalized = _normalizeReviewFieldKey(field);
    const explicitLabels = {
      'bmiRange': 'BMI Range',
      'bmi': 'BMI Range',
      'BMI': 'BMI Range',
      'principalInvestigator': 'Principal Investigator',
      'investigator': 'Principal Investigator',
      'maskingDetails': 'Masking Details',
      'participantMasked': 'Mask Participant',
      'investigatorMasked': 'Mask Investigator',
    };
    final explicit = explicitLabels[normalized];
    if (explicit != null) return explicit;
    final mapped = _requiredFieldLabels[normalized];
    if (mapped != null) return mapped;
    final spaced = normalized
        .replaceAllMapped(
          RegExp(r'([a-z])([A-Z])'),
          (match) => '${match.group(1)} ${match.group(2)}',
        )
        .split('.')
        .join(' ')
        .replaceAll('_', ' ')
        .trim();
    if (spaced.isEmpty) return normalized;
    return spaced[0].toUpperCase() + spaced.substring(1);
  }

  Set<String> _pendingReviewFields() {
    return _fieldsNeedingReview
        .map(_normalizeReviewFieldKey)
        .where((field) => field.isNotEmpty && !_reviewedFields.contains(field))
        .toSet();
  }

  String _normalizeReviewFieldKey(String field) {
    final trimmed = field.trim();
    return switch (trimmed) {
      'maskingDetails.participant' => 'participantMasked',
      'maskingDetails.investigator' => 'investigatorMasked',
      _ => trimmed,
    };
  }

  List<String> _pendingReviewFieldLabels() {
    return _pendingReviewFields().map(_fieldLabelForReview).toSet().toList();
  }

  Set<String> _reviewKeysForControl(String key) {
    switch (key) {
      case 'country':
      case 'region':
        return {'location', 'country', 'region'};
      case 'ageMin':
      case 'ageMax':
        return {'ageRange', 'ageMin', 'ageMax'};
      case 'bmiMin':
      case 'bmiMax':
        return {'bmiRange', 'bmiMin', 'bmiMax'};
      case 'masking':
      case 'participantMasked':
      case 'investigatorMasked':
        return {
          'masking',
          'maskingDetails',
          'participantMasked',
          'investigatorMasked',
        };
      case 'principalInvestigator':
        return {'principalInvestigator', 'investigator'};
      default:
        return {key};
    }
  }

  Set<String> _pendingReviewKeysForControl(String key) {
    final pending = _pendingReviewFields();
    return _reviewKeysForControl(
      key,
    ).where((reviewKey) => pending.contains(reviewKey)).toSet();
  }

  bool _controlNeedsReview(String key) {
    return _pendingReviewKeysForControl(key).isNotEmpty;
  }

  void _markControlReviewed(String key) {
    setState(() {
      _reviewedFields.addAll(_pendingReviewKeysForControl(key));
    });
  }

  InputDecoration _inputDecoration(
    String key,
    String label, {
    bool required = false,
    String? helperText,
    bool expandedEditor = false,
    String? expandedHelperText,
  }) {
    final needsReview = _controlNeedsReview(key);
    final colorScheme = Theme.of(context).colorScheme;
    final reviewColor = colorScheme.tertiary;
    final borderRadius = BorderRadius.circular(4);
    final suffixIcons = <Widget>[
      if (needsReview)
        Tooltip(
          message: 'Needs review',
          child: Icon(
            Icons.warning_amber_rounded,
            color: reviewColor,
          ),
        ),
      if (expandedEditor)
        IconButton(
          tooltip: 'View or edit full field',
          icon: const Icon(Icons.open_in_full),
          onPressed: () => _openExpandedTextEditor(
            key,
            label,
            helperText: expandedHelperText ?? helperText,
          ),
        ),
    ];

    return InputDecoration(
      labelText: _fieldLabel(label, required: required),
      helperText: helperText,
      helperMaxLines: 2,
      suffixIcon: suffixIcons.isEmpty
          ? null
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: suffixIcons,
            ),
      enabledBorder: needsReview
          ? OutlineInputBorder(
              borderRadius: borderRadius,
              borderSide: BorderSide(color: reviewColor, width: 1.4),
            )
          : null,
      focusedBorder: needsReview
          ? OutlineInputBorder(
              borderRadius: borderRadius,
              borderSide: BorderSide(color: reviewColor, width: 2),
            )
          : null,
    );
  }

  Widget _formRow(List<Widget> children, double availableWidth) {
    if (availableWidth < 720) {
      return Column(
        children: [
          for (var index = 0; index < children.length; index++) ...[
            if (index > 0) const SizedBox(height: 12),
            SizedBox(width: double.infinity, child: children[index]),
          ],
        ],
      );
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < children.length; index++) ...[
          if (index > 0) const SizedBox(width: 12),
          Expanded(child: children[index]),
        ],
      ],
    );
  }

  Future<void> _openExpandedTextEditor(
    String key,
    String label, {
    String? helperText,
  }) async {
    final controller = _controller(key);
    final dialogController = TextEditingController(text: controller.text);
    final needsReview = _controlNeedsReview(key);
    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        final colorScheme = Theme.of(dialogContext).colorScheme;
        return AlertDialog(
          title: Text(label),
          content: SizedBox(
            width: 640,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: dialogController,
                  minLines: 8,
                  maxLines: 12,
                  decoration: InputDecoration(
                    helperText: helperText,
                    helperMaxLines: 2,
                    border: const OutlineInputBorder(),
                  ),
                ),
                if (needsReview) ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.warning_amber_rounded,
                        color: colorScheme.tertiary,
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Needs review from uploaded document',
                          style: Theme.of(dialogContext)
                              .textTheme
                              .bodySmall
                              ?.copyWith(
                                color: colorScheme.tertiary,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () {
                          _markControlReviewed(key);
                          Navigator.pop(dialogContext, dialogController.text);
                        },
                        icon: const Icon(Icons.check_circle_outline, size: 16),
                        label: const Text('Mark reviewed'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(dialogContext, dialogController.text),
              child: const Text('Apply'),
            ),
          ],
        );
      },
    );
    dialogController.dispose();
    if (result == null) return;
    setState(() {
      controller.text = result;
      controller.selection = TextSelection.collapsed(offset: result.length);
    });
  }

  Widget _reviewableControl(String key, Widget child) {
    if (!_controlNeedsReview(key)) return child;
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        child,
        const SizedBox(height: 4),
        Row(
          children: [
            Icon(
              Icons.warning_amber_rounded,
              size: 16,
              color: colorScheme.tertiary,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                'Needs review from uploaded document',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.tertiary,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            TextButton.icon(
              onPressed: () => _markControlReviewed(key),
              icon: const Icon(Icons.check_circle_outline, size: 16),
              label: const Text('Mark reviewed'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _maskingDetailsGroup() {
    final needsReview = _controlNeedsReview('masking');
    final colorScheme = Theme.of(context).colorScheme;
    final reviewColor = colorScheme.tertiary;
    return _reviewableControl(
      'masking',
      Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          border: Border.all(
            color: needsReview ? reviewColor : colorScheme.outlineVariant,
            width: needsReview ? 1.4 : 1,
          ),
          borderRadius: BorderRadius.circular(4),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final dropdown = _dropdown(
              'masking',
              'Masking',
              ['None (Open Label)', 'Single', 'Double'],
              reviewable: false,
            );
            final participant = _maskingCheckbox(
              value: _participantMasked,
              onChanged: (value) =>
                  setState(() => _participantMasked = value ?? false),
              label: 'Mask Participant',
            );
            final investigator = _maskingCheckbox(
              value: _investigatorMasked,
              onChanged: (value) =>
                  setState(() => _investigatorMasked = value ?? false),
              label: 'Mask Investigator',
            );

            if (constraints.maxWidth < 720) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  dropdown,
                  const SizedBox(height: 8),
                  participant,
                  investigator,
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: dropdown),
                const SizedBox(width: 16),
                Expanded(child: participant),
                const SizedBox(width: 16),
                Expanded(child: investigator),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _maskingCheckbox({
    required bool value,
    required ValueChanged<bool?> onChanged,
    required String label,
  }) {
    return CheckboxListTile(
      value: value,
      onChanged: onChanged,
      title: Text(label),
      contentPadding: EdgeInsets.zero,
      dense: true,
      controlAffinity: ListTileControlAffinity.leading,
    );
  }

  Map<String, dynamic> _emptySupplementalCriteria() {
    return {
      'additionalTrialInformation': const <Map<String, dynamic>>[],
      'summary': '',
      'missingOrAmbiguousCriteria': const <String>[],
    };
  }

  List<Map<String, dynamic>> _currentSupplementalItems() {
    final supplemental = _supplementalCriteria ?? _emptySupplementalCriteria();
    return (supplemental['additionalTrialInformation'] as List? ?? const [])
        .whereType<Map>()
        .map(Map<String, dynamic>.from)
        .toList();
  }

  void _setSupplementalItems(List<Map<String, dynamic>> items) {
    final supplemental = _supplementalCriteria ?? _emptySupplementalCriteria();
    setState(() {
      _supplementalCriteria = {
        ...supplemental,
        'additionalTrialInformation': items,
        'summary': _stringValue(supplemental['summary']) ??
            (items.isEmpty
                ? ''
                : 'Additional trial criteria reviewed by the user.'),
        'missingOrAmbiguousCriteria':
            _stringList(supplemental['missingOrAmbiguousCriteria']),
      };
      _semanticCriteriaChangedByUser = true;
    });
  }

  Future<void> _showCriterionEditor({
    int? index,
    Map<String, dynamic>? existing,
  }) async {
    final action = await showDialog<_CriterionEditorResult>(
      context: context,
      builder: (context) => _CriterionEditorDialog(
        title: index == null ? 'Add criterion' : 'Edit criterion',
        initialCriterion: _stringValue(existing?['criterion']) ?? '',
        initialCategory: _stringValue(existing?['category']) ?? 'User Added',
        initialRelevance: _normalizeRelevance(existing?['relevance']),
        initialNotes: _stringValue(existing?['notes']) ?? '',
        existing: existing,
        isNewCriterion: index == null,
        hasDuplicateCriterion: (criterion) =>
            _hasDuplicateCriterion(criterion, exceptIndex: index),
      ),
    );

    if (action == null || !mounted) return;

    final before = index == null ? null : existing;
    if (action.delete) {
      if (index == null) return;
      final confirmed = await _confirmDeleteCriterion();
      if (confirmed != true || !mounted) return;
      final items = _currentSupplementalItems();
      if (index >= 0 && index < items.length) {
        items.removeAt(index);
        _setSupplementalItems(items);
      }
      return;
    }

    final savedItem = action.item;
    if (savedItem == null) return;
    if (before != null &&
        _stableJson(_normalizeJson(before)) ==
            _stableJson(_normalizeJson(savedItem))) {
      return;
    }

    final items = _currentSupplementalItems();
    if (index == null) {
      items.add(savedItem);
    } else if (index >= 0 && index < items.length) {
      items[index] = savedItem;
    }
    _setSupplementalItems(items);
  }

  Future<bool?> _confirmDeleteCriterion() {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete criterion?'),
        content: const Text(
          'This removes the criterion from the trial criteria list. Other criteria and their metadata will be preserved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.delete_outline),
            label: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  bool _hasDuplicateCriterion(String criterion, {int? exceptIndex}) {
    final key = _normalizedCriterionKey(criterion);
    final items = _currentSupplementalItems();
    for (var index = 0; index < items.length; index += 1) {
      if (index == exceptIndex) continue;
      if (_normalizedCriterionKey(items[index]['criterion']) == key) {
        return true;
      }
    }
    return false;
  }

  String _normalizedCriterionKey(dynamic value) {
    return (_stringValue(value) ?? '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim()
        .toLowerCase();
  }

  String _normalizeRelevance(dynamic value) {
    final text = _stringValue(value);
    if (text == 'High' || text == 'Medium' || text == 'Low') return text!;
    return 'Medium';
  }

  String? _criterionSourceLabel(Map<String, dynamic> item) {
    if (item['origin'] == 'user_added') return 'User added';
    if (item['userEdited'] == true) return 'Edited';
    final sourceText = _stringValue(item['sourceText']);
    if (sourceText != null && sourceText.isNotEmpty) return 'Extracted';
    if (_loadedSemanticSourceType == 'manual_form' ||
        _selectedDocumentName == null) {
      return 'Manual';
    }
    return null;
  }

  Widget _supplementalCriteriaPanel() {
    final showManualEditor = _showManualAdditionalCriteriaSection();
    final supplemental = _supplementalCriteria;
    if (supplemental == null && !showManualEditor) {
      return const SizedBox.shrink();
    }
    final effectiveSupplemental = supplemental ?? _emptySupplementalCriteria();

    final items =
        (effectiveSupplemental['additionalTrialInformation'] as List?) ??
            const [];
    final summary = _stringValue(effectiveSupplemental['summary']);
    final missingOrAmbiguous =
        _stringList(effectiveSupplemental['missingOrAmbiguousCriteria']);
    final agentError = _stringValue(effectiveSupplemental['error']);

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Additional Trial / Criteria Information Not Captured by the Base Form',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton.icon(
                onPressed: _submitting ? null : () => _showCriterionEditor(),
                icon: const Icon(Icons.add),
                label: const Text('Add criterion'),
              ),
            ),
            const SizedBox(height: 12),
            if (agentError != null)
              _notice(
                'Supplemental criteria extraction failed: $agentError',
                Icons.error_outline,
                Theme.of(context).colorScheme.error,
              )
            else ...[
              if (summary != null && summary.isNotEmpty) ...[
                Text(summary, style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 12),
              ],
              if (items.isEmpty)
                Text(
                  'No supplemental criteria beyond the structured fields were found.',
                  style: Theme.of(context).textTheme.bodySmall,
                )
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _supplementalCriteriaHeader(),
                    const SizedBox(height: 8),
                    ...items
                        .whereType<Map>()
                        .toList()
                        .asMap()
                        .entries
                        .map((entry) => _supplementalCriterionTile(
                              entry.key,
                              Map<String, dynamic>.from(entry.value),
                            )),
                  ],
                ),
              const SizedBox(height: 12),
              _additionalExtractionNotes(missingOrAmbiguous),
            ],
          ],
        ),
      ),
    );
  }

  Widget _additionalExtractionNotes(List<String> notes) {
    final colorScheme = Theme.of(context).colorScheme;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outlineVariant),
        borderRadius: BorderRadius.circular(6),
      ),
      child: ExpansionTile(
        initiallyExpanded: false,
        leading: Icon(
          Icons.notes_outlined,
          color: colorScheme.onSurfaceVariant,
        ),
        title: const Text('Additional Extraction Notes'),
        subtitle: const Text(
          'Optional context about unclear document details.',
        ),
        tilePadding: const EdgeInsets.symmetric(horizontal: 12),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'These notes are not separate matching rules. Use them only as '
              'extra context if you want to review what the document did not '
              'clearly specify.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          const SizedBox(height: 8),
          if (notes.isEmpty)
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'No additional extraction notes were returned for this document.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            )
          else
            for (final note in notes)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('- '),
                    Expanded(child: Text(note)),
                  ],
                ),
              ),
        ],
      ),
    );
  }

  Widget _supplementalCriteriaHeader() {
    final textTheme = Theme.of(context).textTheme;
    final color = Theme.of(context).colorScheme.onSurfaceVariant;
    return Row(
      children: [
        SizedBox(
          width: 74,
          child: Text(
            'Importance',
            style: textTheme.labelMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Extracted Criteria / Notes',
            style: textTheme.labelMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _supplementalCriterionTile(int index, Map<String, dynamic> item) {
    final category = _stringValue(item['category']) ?? 'General';
    final criterion = _stringValue(item['criterion']) ?? '';
    final relevance = _stringValue(item['relevance']) ?? 'Medium';
    final notes = _stringValue(item['notes']);
    final label = _criterionSourceLabel(item);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: SizedBox(
              width: 74,
              child: Chip(
                label: Text(relevance, style: const TextStyle(fontSize: 11)),
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LayoutBuilder(
                  builder: (context, constraints) {
                    final criterionText = Text(
                      '$category: $criterion',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    );
                    final sourceChip = label == null
                        ? null
                        : Chip(
                            label: Text(
                              label,
                              style: const TextStyle(fontSize: 11),
                            ),
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          );
                    if (sourceChip == null) return criterionText;
                    if (constraints.maxWidth < 360) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          criterionText,
                          const SizedBox(height: 4),
                          sourceChip,
                        ],
                      );
                    }
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: criterionText),
                        const SizedBox(width: 8),
                        SizedBox(width: 92, child: Align(child: sourceChip)),
                      ],
                    );
                  },
                ),
                if (notes != null && notes.isNotEmpty)
                  Text(notes, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Edit criterion',
            onPressed: _submitting
                ? null
                : () => _showCriterionEditor(index: index, existing: item),
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
    );
  }

  Widget _field(
    String key,
    String label, {
    bool required = false,
    int maxLines = 1,
    String? helperText,
    bool expandedEditor = false,
    String? expandedHelperText,
  }) {
    return _reviewableControl(
      key,
      TextFormField(
        controller: _controller(key),
        maxLines: maxLines,
        decoration: _inputDecoration(
          key,
          label,
          required: required,
          helperText: helperText,
          expandedEditor: expandedEditor,
          expandedHelperText: expandedHelperText,
        ),
        validator: required
            ? (value) => value == null || value.trim().isEmpty
                ? '$label is required'
                : null
            : null,
      ),
    );
  }

  Widget _autocompleteField(
    String key,
    String label,
    List<String> options, {
    bool required = false,
    bool allowMultiple = false,
    String? helperText,
    bool expandedEditor = false,
    String? expandedHelperText,
  }) {
    final controller = _controller(key);
    final focusNode = _focusNode(key);
    return RawAutocomplete<String>(
      textEditingController: controller,
      focusNode: focusNode,
      optionsBuilder: (textEditingValue) {
        final query = _autocompleteQuery(textEditingValue.text, allowMultiple);
        if (query.isEmpty) return options;
        return options.where(
          (option) => option.toLowerCase().contains(query.toLowerCase()),
        );
      },
      onSelected: (selection) {
        final replacement = allowMultiple
            ? _replaceLastAutocompleteToken(controller.text, selection)
            : selection;
        controller.text = replacement;
        controller.selection = TextSelection.collapsed(
          offset: controller.text.length,
        );
      },
      fieldViewBuilder: (context, fieldController, fieldFocusNode, onSubmit) {
        return _reviewableControl(
          key,
          TextFormField(
            controller: fieldController,
            focusNode: fieldFocusNode,
            decoration: _inputDecoration(
              key,
              label,
              required: required,
              helperText: helperText,
              expandedEditor: expandedEditor,
              expandedHelperText: expandedHelperText,
            ),
            validator: required
                ? (value) => value == null || value.trim().isEmpty
                    ? '$label is required'
                    : null
                : null,
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, displayOptions) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220, maxWidth: 420),
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: displayOptions.length,
                itemBuilder: (context, index) {
                  final option = displayOptions.elementAt(index);
                  return ListTile(
                    dense: true,
                    title: Text(option),
                    onTap: () => onSelected(option),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }

  String _autocompleteQuery(String text, bool allowMultiple) {
    if (!allowMultiple) return text.trim();
    final lastComma = text.lastIndexOf(',');
    return (lastComma == -1 ? text : text.substring(lastComma + 1)).trim();
  }

  String _replaceLastAutocompleteToken(String text, String selection) {
    final lastComma = text.lastIndexOf(',');
    if (lastComma == -1) return selection;
    final prefix = text.substring(0, lastComma).trim();
    if (prefix.isEmpty) return selection;
    return '$prefix, $selection';
  }

  Widget _trialIdField() {
    return TextFormField(
      controller: _controller('trialId'),
      readOnly: _isEditMode,
      decoration: _inputDecoration(
        'trialId',
        'Trial ID',
        required: true,
        helperText: _isEditMode
            ? 'Trial ID is read-only because related criteria and ranked results reference it.'
            : null,
      ),
      keyboardType: TextInputType.number,
      onChanged: (value) {
        if (_isEditMode) return;
        if (_trialIdDuplicateValue != null &&
            _trialIdDuplicateValue != value.trim()) {
          setState(() => _trialIdDuplicateValue = null);
        }
      },
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Trial ID is required';
        }
        final trialId = value.trim();
        if (int.tryParse(trialId) == null) return 'Trial ID must be a number';
        if (_trialIdDuplicateValue == trialId) {
          return 'Trial ID already exists';
        }
        return null;
      },
      onEditingComplete: () async {
        if (_isEditMode) return;
        setState(() => _showValidationErrors = true);
        await _checkTrialIdAvailability(showSnackBar: true);
      },
    );
  }

  String _fieldLabel(String label, {required bool required}) {
    return required ? '$label *' : label;
  }

  Widget _dropdown(
    String key,
    String label,
    List<String> options, {
    String? helperText,
    bool reviewable = true,
  }) {
    final currentValue = _values[key];
    final displayOptions = [
      ...options,
      if (currentValue != null &&
          currentValue.isNotEmpty &&
          !options.contains(currentValue))
        currentValue,
    ];
    final dropdown = DropdownButtonFormField<String>(
      initialValue: currentValue,
      isExpanded: true,
      decoration: _inputDecoration(key, label, helperText: helperText),
      selectedItemBuilder: (context) =>
          displayOptions.map((option) => _dropdownOptionText(option)).toList(),
      items: displayOptions
          .map(
            (option) => DropdownMenuItem(
              value: option,
              child: _dropdownOptionText(option),
            ),
          )
          .toList(),
      onChanged: (value) => _setDropdownValueFromUser(key, value),
    );
    if (!reviewable) return dropdown;
    return _reviewableControl(key, dropdown);
  }

  Widget _dropdownOptionText(String option) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        option,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        softWrap: false,
      ),
    );
  }
}

const _trialPhaseOptions = [
  'Early Phase I',
  'Phase I',
  'Phase I/II',
  'Phase II',
  'Phase II/III',
  'Phase III',
  'Phase IV',
  'Not Applicable',
];

const _allocationOptions = [
  'Randomized',
  'Non-randomized',
  'N/A',
];

const _interventionModelOptions = [
  'Single Group',
  'Parallel',
  'Crossover',
  'Sequential Assignment',
  'Factorial',
  'N/A',
];

const _pathologyOptions = [
  'Hypertension',
  'Type 2 Diabetes',
  'Asthma',
  'Breast Cancer',
  'Chronic Kidney Disease',
  'Chronic Obstructive Pulmonary Disease',
  'Heart Failure',
  'Rheumatoid Arthritis',
];

const _conditionOptions = [
  ..._pathologyOptions,
  'Obesity',
  'Renal Disease',
  'Cardiovascular Disease',
  'Liver Disease',
  'Active Malignancy',
  'Uncontrolled Infection',
];

const _diseaseOptions = [
  'Cardiovascular Diseases',
  'Endocrine Diseases',
  'Respiratory Diseases',
  'Digestive Diseases',
  'Renal Disease',
  'Neurological Diseases',
  'Immunological Diseases',
  'Infectious Diseases',
  'Cancer',
  'Liver Disease',
  'Dermatological Diseases',
  'Musculoskeletal Diseases',
  'Mental Health Disorders',
];

const _surgeryOptions = [
  'Recent surgeries',
  'Recent abdominal surgery',
  'Recent brain surgery',
  'Thoracic surgery',
  'Recent lung surgery',
  'Joint replacement surgery',
  'Recent joint surgery',
  'Recent breast surgery',
  'Recent thoracic surgery',
  'Recent bowel surgery',
];

const _medicationOptions = [
  'Anticoagulants',
  'Corticosteroids',
  'Immunosuppressants',
  'Chemotherapy',
  'Biologic therapy',
  'Insulin',
  'GLP-1 receptor agonists',
  'ACE inhibitors',
  'Beta blockers',
  'Investigational drug',
];

class _CriterionEditorDialog extends StatefulWidget {
  const _CriterionEditorDialog({
    required this.title,
    required this.initialCriterion,
    required this.initialCategory,
    required this.initialRelevance,
    required this.initialNotes,
    required this.existing,
    required this.isNewCriterion,
    required this.hasDuplicateCriterion,
  });

  final String title;
  final String initialCriterion;
  final String initialCategory;
  final String initialRelevance;
  final String initialNotes;
  final Map<String, dynamic>? existing;
  final bool isNewCriterion;
  final bool Function(String criterion) hasDuplicateCriterion;

  @override
  State<_CriterionEditorDialog> createState() => _CriterionEditorDialogState();
}

class _CriterionEditorDialogState extends State<_CriterionEditorDialog> {
  late final TextEditingController _criterionController;
  late final TextEditingController _categoryController;
  late final TextEditingController _notesController;
  late String _relevance;
  String? _errorText;

  @override
  void initState() {
    super.initState();
    _criterionController = TextEditingController(text: widget.initialCriterion);
    _categoryController = TextEditingController(text: widget.initialCategory);
    _notesController = TextEditingController(text: widget.initialNotes);
    _relevance = widget.initialRelevance;
  }

  @override
  void dispose() {
    _criterionController.dispose();
    _categoryController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  void _save() {
    final criterion = _criterionController.text.trim();
    if (criterion.isEmpty) {
      setState(() => _errorText = 'Criterion text is required.');
      return;
    }
    if (widget.hasDuplicateCriterion(criterion)) {
      setState(() => _errorText = 'This exact criterion is already listed.');
      return;
    }

    final category = _categoryController.text.trim();
    final notes = _notesController.text.trim();
    final nextItem = {
      ...?widget.existing,
      'category': category.isEmpty ? 'User Added' : category,
      'criterion': criterion,
      'relevance': _relevance,
      'notes': notes.isEmpty ? null : notes,
      if (widget.isNewCriterion) 'origin': 'user_added',
      if (!widget.isNewCriterion && widget.existing?['origin'] != 'user_added')
        'userEdited': true,
    };

    Navigator.pop(context, _CriterionEditorResult.save(nextItem));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _criterionController,
                decoration: const InputDecoration(
                  labelText: 'Criterion',
                  border: OutlineInputBorder(),
                ),
                minLines: 2,
                maxLines: 4,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _categoryController,
                decoration: const InputDecoration(
                  labelText: 'Category',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _relevance,
                decoration: const InputDecoration(
                  labelText: 'Importance',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'High', child: Text('High')),
                  DropdownMenuItem(value: 'Medium', child: Text('Medium')),
                  DropdownMenuItem(value: 'Low', child: Text('Low')),
                ],
                onChanged: (value) {
                  if (value != null) {
                    setState(() => _relevance = value);
                  }
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'Notes',
                  border: OutlineInputBorder(),
                ),
                minLines: 2,
                maxLines: 4,
              ),
              if (_errorText != null) ...[
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    _errorText!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        if (!widget.isNewCriterion)
          TextButton.icon(
            onPressed: () =>
                Navigator.pop(context, const _CriterionEditorResult.delete()),
            icon: const Icon(Icons.delete_outline),
            label: const Text('Delete'),
          ),
        FilledButton(
          onPressed: _save,
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _CriterionEditorResult {
  const _CriterionEditorResult.save(this.item) : delete = false;
  const _CriterionEditorResult.delete()
      : item = null,
        delete = true;

  final Map<String, dynamic>? item;
  final bool delete;
}

class _ExtractionProgress {
  const _ExtractionProgress(
    this.stepIndex,
    this.detail, {
    this.failed = false,
    this.complete = false,
  });

  final int stepIndex;
  final String detail;
  final bool failed;
  final bool complete;
}

class _ExtractionProgressDialog extends StatelessWidget {
  const _ExtractionProgressDialog({
    required this.progress,
    required this.onCancel,
  });

  static const _steps = [
    'Prepare file',
    'Upload',
    'Extract fields',
    'Apply fields',
    'Review',
  ];

  final _ExtractionProgress progress;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final stepIndex = progress.stepIndex.clamp(0, _steps.length - 1);
    final colorScheme = Theme.of(context).colorScheme;

    return AlertDialog(
      title: Text(
        progress.failed
            ? 'Document Extraction Failed'
            : progress.complete
                ? 'Document Extraction Complete'
                : 'Extracting Trial Fields',
      ),
      content: SizedBox(
        width: 460,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                minHeight: 8,
                value: (stepIndex + 1) / _steps.length,
                color: progress.failed ? colorScheme.error : null,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              progress.detail,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: progress.failed ? colorScheme.error : null,
                  ),
            ),
            const SizedBox(height: 16),
            for (var index = 0; index < _steps.length; index++)
              _ExtractionStepRow(
                label: _steps[index],
                index: index,
                currentIndex: stepIndex,
                failed: progress.failed,
                complete: progress.complete,
              ),
          ],
        ),
      ),
      actions: [
        if (onCancel != null)
          TextButton(
            onPressed: onCancel,
            child: const Text('Cancel'),
          ),
      ],
    );
  }
}

class _ExtractionCancelled implements Exception {
  const _ExtractionCancelled();
}

class _ExtractionDialogController {
  final Completer<void> _rendered = Completer<void>();
  BuildContext? dialogContext;
  bool wasRendered = false;
  bool _closed = false;

  Future<void> waitUntilRendered() async {
    try {
      await _rendered.future.timeout(const Duration(milliseconds: 500));
    } on TimeoutException {
      wasRendered = true;
    }
  }

  void markRendered() {
    wasRendered = true;
    if (!_rendered.isCompleted) _rendered.complete();
  }

  void markClosed() {
    _closed = true;
  }

  void close() {
    if (_closed) return;
    final context = dialogContext;
    if (context == null) return;
    _closed = true;
    Navigator.of(context).pop();
  }
}

class _FormSnapshot {
  const _FormSnapshot({
    required this.controllerValues,
    required this.values,
    required this.participantMasked,
    required this.investigatorMasked,
    required this.selectedDocumentName,
    required this.extractionMessage,
    required this.extractionError,
    required this.missingRequiredFields,
    required this.fieldsNeedingReview,
    required this.reviewedFields,
    required this.supplementalCriteria,
    required this.replaceStructuredSemanticCriteria,
    required this.semanticCriteriaChangedByUser,
    required this.showValidationErrors,
    required this.trialIdDuplicateValue,
  });

  final Map<String, String> controllerValues;
  final Map<String, String> values;
  final bool participantMasked;
  final bool investigatorMasked;
  final String? selectedDocumentName;
  final String? extractionMessage;
  final String? extractionError;
  final List<String> missingRequiredFields;
  final List<String> fieldsNeedingReview;
  final Set<String> reviewedFields;
  final Map<String, dynamic>? supplementalCriteria;
  final bool replaceStructuredSemanticCriteria;
  final bool semanticCriteriaChangedByUser;
  final bool showValidationErrors;
  final String? trialIdDuplicateValue;
}

class _ExtractionStepRow extends StatelessWidget {
  const _ExtractionStepRow({
    required this.label,
    required this.index,
    required this.currentIndex,
    required this.failed,
    required this.complete,
  });

  final String label;
  final int index;
  final int currentIndex;
  final bool failed;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isFailed = failed && index == currentIndex;
    final isComplete = complete ? index <= currentIndex : index < currentIndex;
    final isCurrent = !failed && !complete && index == currentIndex;
    final backgroundColor = isFailed
        ? colorScheme.errorContainer.withValues(alpha: 0.65)
        : isCurrent
            ? colorScheme.primaryContainer
            : isComplete
                ? colorScheme.primary.withValues(alpha: 0.10)
                : colorScheme.surfaceContainerHighest.withValues(alpha: 0.55);
    final foregroundColor = isFailed
        ? colorScheme.error
        : isCurrent || isComplete
            ? colorScheme.primary
            : colorScheme.onSurfaceVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isFailed
              ? colorScheme.error.withValues(alpha: 0.4)
              : isCurrent
                  ? colorScheme.primary.withValues(alpha: 0.35)
                  : Colors.transparent,
        ),
      ),
      child: Row(
        children: [
          SizedBox.square(
            dimension: 28,
            child: Center(
              child: isCurrent
                  ? SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: colorScheme.primary,
                      ),
                    )
                  : Icon(
                      isFailed
                          ? Icons.error
                          : isComplete
                              ? Icons.check_circle
                              : Icons.circle_outlined,
                      color: foregroundColor,
                      size: 22,
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: isCurrent || isComplete
                    ? colorScheme.onSurface
                    : colorScheme.onSurfaceVariant,
                fontWeight:
                    isCurrent || isFailed ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
