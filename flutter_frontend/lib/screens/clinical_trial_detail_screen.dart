import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';

import '../models/clinical_trial.dart';
import '../models/patient.dart';
import '../services/api_service.dart';
import '../widgets/page_scaffold.dart';
import '../widgets/responsive_table.dart';
import 'clinical_trial_form_screen.dart';
import 'patient_detail_screen.dart';

class ClinicalTrialDetailArgs {
  ClinicalTrialDetailArgs(this.trialId);
  final int trialId;
}

class ClinicalTrialDetailScreen extends StatefulWidget {
  const ClinicalTrialDetailScreen({
    super.key,
    required this.api,
    required this.args,
  });

  static const routeName = '/clinical-trials/detail';
  final ApiService api;
  final ClinicalTrialDetailArgs args;

  @override
  State<ClinicalTrialDetailScreen> createState() =>
      _ClinicalTrialDetailScreenState();
}

class _ClinicalTrialDetailScreenState extends State<ClinicalTrialDetailScreen> {
  static const int _dashboardPreviewCharacterLimit = 220;
  static final List<_SemanticSummarySection> _semanticSummarySections = [
    _SemanticSummarySection(
      label: 'Conflicts',
      icon: Icons.error_outline,
      color: Colors.red.shade700,
    ),
    _SemanticSummarySection(
      label: 'Concerns',
      icon: Icons.warning_amber_outlined,
      color: Colors.amber.shade800,
    ),
    _SemanticSummarySection(
      label: 'Missing',
      icon: Icons.help_outline,
      color: Colors.blueGrey.shade600,
    ),
    _SemanticSummarySection(
      label: 'Supports',
      icon: Icons.check_circle_outline,
      color: Colors.green.shade700,
    ),
    _SemanticSummarySection(
      label: 'Other',
      icon: Icons.notes_outlined,
      color: Colors.grey.shade700,
    ),
  ];

  ClinicalTrial? _trial;
  bool _loading = true;
  String? _error;
  bool _statusUpdating = false;

  bool _matchRunning = false;
  int _activeMatchRunId = 0;
  bool _matchRunCancelled = false;
  String? _matchError;
  List<Map<String, dynamic>> _matchResults = const [];
  DateTime? _matchLastRunAt;
  final Random _matchProgressRandom = Random();
  final ValueNotifier<_MatchProgress> _matchProgress = ValueNotifier(
    const _MatchProgress(
      current: 0,
      total: 1,
      message: 'Preparing ranked patient batch',
      complete: false,
      finalizing: false,
    ),
  );
  Timer? _matchProgressAnimationTimer;
  Timer? _matchProgressStepTimer;

  @override
  void dispose() {
    _matchProgressAnimationTimer?.cancel();
    _matchProgressStepTimer?.cancel();
    _matchProgress.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final trial =
          await widget.api.getSpecificClinicalTrial(widget.args.trialId);
      final storedRanked =
          await widget.api.getStoredRankedPatients(trial.trialId);
      final storedPatients = _patientsFromRankedResult(storedRanked);
      setState(() {
        _trial = trial;
        _matchResults = storedPatients;
        _matchLastRunAt = _latestEvaluationTime(storedPatients);
      });
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _patientsFromRankedResult(
    Map<String, dynamic> result,
  ) {
    return (result['patients'] as List? ?? const [])
        .whereType<Map>()
        .map(Map<String, dynamic>.from)
        .toList();
  }

  DateTime? _latestEvaluationTime(List<Map<String, dynamic>> patients) {
    DateTime? latest;
    for (final patient in patients) {
      final raw = patient['lastEvaluatedAt']?.toString();
      if (raw == null || raw.isEmpty) continue;
      final parsed = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
      if (parsed == null) continue;
      if (latest == null || parsed.isAfter(latest)) latest = parsed;
    }
    return latest;
  }

  Future<void> _runMatching(_MatchMode mode) async {
    if (_matchRunning) return;
    final trial = _trial;
    if (trial == null) return;

    final semanticCriteria = await _loadSemanticCriteriaForRun(trial.trialId);
    if (semanticCriteria == null) return;

    final remainingPatientIds =
        await _loadRemainingCandidatePatientIds(trial.trialId);
    if (!mounted) return;
    if (remainingPatientIds.isEmpty) {
      await _showNoRemainingPatientsDialog();
      return;
    }

    final requestedCount = mode == _MatchMode.next
        ? min(10, remainingPatientIds.length)
        : remainingPatientIds.length;
    if (mode == _MatchMode.all) {
      final confirmed =
          await _confirmAllPatientsRun(remainingPatientIds.length);
      if (confirmed != true) return;
    }

    final runId = _beginMatchRun();
    final previousResults = _matchResults;
    final previousLastRunAt = _matchLastRunAt;
    setState(() {
      _matchRunning = true;
      _matchError = null;
    });
    _startMatchProgress(requestedCount);
    unawaited(_showMatchProgressDialog(runId));

    try {
      final result = await widget.api.getRankedPatients(
        trial.trialId,
        mode: mode.name,
      );
      if (!_isCurrentMatchRun(runId)) return;
      final patients = _patientsFromRankedResult(result);
      _finishMatchProgress(patients.length);
      await Future<void>.delayed(const Duration(milliseconds: 500));
      if (!_isCurrentMatchRun(runId)) return;
      setState(() {
        _matchResults = _mergeRankedPatients(_matchResults, patients);
        _matchLastRunAt = DateTime.now();
      });
      _showMatchCompletionSnackBar(result);
    } catch (error) {
      if (_isCurrentMatchRun(runId)) {
        setState(() => _matchError = error.toString());
      }
    } finally {
      _finishMatchRun(
        runId,
        previousResults: previousResults,
        previousLastRunAt: previousLastRunAt,
      );
    }
  }

  Future<void> _refreshRankedMatching() async {
    final trial = _trial;
    final rankedPatientIds = _rankedPatientIds.toList()..sort();
    if (trial == null || rankedPatientIds.isEmpty) return;

    final semanticCriteria = await _loadSemanticCriteriaForRun(trial.trialId);
    if (semanticCriteria == null) return;

    await _runRankedPatientIds(
      rankedPatientIds,
      progressTotal: rankedPatientIds.length,
    );
  }

  Future<void> _runRankedPatientIds(
    List<int> patientIds, {
    required int progressTotal,
  }) async {
    final trial = _trial;
    if (trial == null || patientIds.isEmpty) return;

    final runId = _beginMatchRun();
    final previousResults = _matchResults;
    final previousLastRunAt = _matchLastRunAt;
    setState(() {
      _matchRunning = true;
      _matchError = null;
    });
    _startMatchProgress(progressTotal);
    unawaited(_showMatchProgressDialog(runId));

    try {
      final result = await widget.api.getRankedPatients(
        trial.trialId,
        patientIds: patientIds,
      );
      if (!_isCurrentMatchRun(runId)) return;
      final patients = _patientsFromRankedResult(result);
      _finishMatchProgress(patients.length);
      await Future<void>.delayed(const Duration(milliseconds: 500));
      if (!_isCurrentMatchRun(runId)) return;
      setState(() {
        _matchResults = _mergeRankedPatients(_matchResults, patients);
        _matchLastRunAt = DateTime.now();
      });
    } catch (error) {
      if (_isCurrentMatchRun(runId)) {
        setState(() => _matchError = error.toString());
      }
    } finally {
      _finishMatchRun(
        runId,
        previousResults: previousResults,
        previousLastRunAt: previousLastRunAt,
      );
    }
  }

  int _beginMatchRun() {
    _activeMatchRunId += 1;
    _matchRunCancelled = false;
    return _activeMatchRunId;
  }

  bool _isCurrentMatchRun(int runId) {
    return mounted && runId == _activeMatchRunId && !_matchRunCancelled;
  }

  void _cancelMatchRun(int runId) {
    if (runId != _activeMatchRunId) return;
    _matchRunCancelled = true;
    _matchProgressAnimationTimer?.cancel();
    _matchProgressStepTimer?.cancel();
    if (mounted) {
      setState(() {
        _matchRunning = false;
        _matchError = null;
      });
    }
  }

  void _finishMatchRun(
    int runId, {
    required List<Map<String, dynamic>> previousResults,
    required DateTime? previousLastRunAt,
  }) {
    if (runId != _activeMatchRunId) return;
    _matchProgressAnimationTimer?.cancel();
    _matchProgressStepTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _matchRunning = false;
      if (_matchRunCancelled) {
        _matchError = null;
        _matchResults = previousResults;
        _matchLastRunAt = previousLastRunAt;
      }
    });
    if (!_matchRunCancelled &&
        Navigator.of(context, rootNavigator: true).canPop()) {
      Navigator.of(context, rootNavigator: true).pop();
    }
  }

  Set<int> get _rankedPatientIds => _matchResults
      .map((patient) => int.tryParse(patient['patientId']?.toString() ?? ''))
      .whereType<int>()
      .toSet();

  Future<Map<String, dynamic>?> _loadSemanticCriteriaForRun(int trialId) async {
    try {
      final semanticCriteria = await widget.api.getSemanticCriteria(trialId);
      if (!mounted) return null;
      if (semanticCriteria == null) {
        await _showLegacyTrialDialog();
        return null;
      }
      return semanticCriteria;
    } catch (error) {
      if (!mounted) return null;
      setState(() => _matchError = error.toString());
      return null;
    }
  }

  Future<List<int>> _loadRemainingCandidatePatientIds(int trialId) async {
    final deterministic = await widget.api.getDeterministicMatch(trialId);
    final rankedIds = _rankedPatientIds;
    final patients = (deterministic['patients'] as List? ?? const [])
        .whereType<Map>()
        .map((patient) => int.tryParse(patient['patientId']?.toString() ?? ''))
        .whereType<int>()
        .where((patientId) => !rankedIds.contains(patientId))
        .toList();
    return patients;
  }

  Future<void> _showLegacyTrialDialog() {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Pipeline Setup Required'),
        content: const Text(
          'This trial does not have saved supplemental semantic criteria, so the ranked patient dashboard cannot be produced yet.\n\n'
          'To rank patients, re-input this study through the current create-trial flow by uploading a document or manually entering the trial so the supplemental criteria agent can create the required trial context.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  Future<void> _showNoRemainingPatientsDialog() {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('No Unranked Patients'),
        content: const Text(
          'All current candidate patients already have saved ranked results for this trial. Use Refresh Saved Results to recompute the displayed rows.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<bool?> _confirmAllPatientsRun(int remainingCount) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Match all $remainingCount remaining patients?'),
        content: const Text('This may take several minutes.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Match All Patients'),
          ),
        ],
      ),
    );
  }

  void _showMatchCompletionSnackBar(Map<String, dynamic> result) {
    if (!mounted) return;
    final requested = int.tryParse('${result['requestedCount'] ?? ''}') ??
        (result['patientIds'] as List? ?? const []).length;
    final matched = int.tryParse('${result['matchedCount'] ?? ''}') ??
        (result['patients'] as List? ?? const []).length;
    final skipped = int.tryParse('${result['skippedCount'] ?? ''}') ?? 0;
    final failed = int.tryParse('${result['failedCount'] ?? ''}') ?? 0;
    final message = failed > 0
        ? 'Matching incomplete: requested $requested, matched $matched, skipped $skipped, failed $failed.'
        : 'Matching complete: requested $requested, matched $matched, skipped $skipped, failed $failed.';
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  void _startMatchProgress(int total) {
    _matchProgressAnimationTimer?.cancel();
    _matchProgressStepTimer?.cancel();
    final lastEstimatedStep =
        total <= 2 ? 1 : (total * 0.6).ceil().clamp(1, total - 1);
    _matchProgress.value = _MatchProgress(
      current: 1,
      total: total,
      message: 'Reviewing patient 1 of $total',
      complete: false,
      finalizing: false,
      animatedDots: '',
    );
    var current = 1;
    var dotCount = 0;

    void scheduleNextTick() {
      final delay = Duration(
        seconds: 18 + _matchProgressRandom.nextInt(11),
      );
      _matchProgressStepTimer = Timer(delay, () {
        if (!_matchRunning) return;
        dotCount = (dotCount + 1) % 4;
        if (current < lastEstimatedStep) current += 1;
        final reviewingRemainder = current >= lastEstimatedStep && total > 1;
        _matchProgress.value = _MatchProgress(
          current: current,
          total: total,
          message: reviewingRemainder
              ? 'Reviewing remaining patients'
              : 'Reviewing patient $current of $total',
          complete: false,
          finalizing: false,
          animatedDots: List.filled(dotCount, '.').join(),
        );
        scheduleNextTick();
      });
    }

    _matchProgressAnimationTimer =
        Timer.periodic(const Duration(milliseconds: 550), (_) {
      if (!_matchRunning) return;
      dotCount = (dotCount + 1) % 4;
      _matchProgress.value = _MatchProgress(
        current: current,
        total: total,
        message: current >= lastEstimatedStep && total > 1
            ? 'Reviewing remaining patients'
            : 'Reviewing patient $current of $total',
        complete: false,
        finalizing: false,
        animatedDots: List.filled(dotCount, '.').join(),
      );
    });
    scheduleNextTick();
  }

  void _finishMatchProgress(int completedCount) {
    _matchProgressAnimationTimer?.cancel();
    _matchProgressStepTimer?.cancel();
    final total =
        completedCount <= 0 ? _matchProgress.value.total : completedCount;
    _matchProgress.value = _MatchProgress(
      current: total,
      total: total,
      message: 'Finished ranking $total patient${total == 1 ? '' : 's'}',
      complete: true,
      finalizing: false,
    );
  }

  Future<void> _showMatchProgressDialog(int runId) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => ValueListenableBuilder<_MatchProgress>(
        valueListenable: _matchProgress,
        builder: (context, progress, _) => _MatchProgressDialog(
          progress: progress,
          onCancel: progress.complete || progress.finalizing
              ? null
              : () {
                  _cancelMatchRun(runId);
                  Navigator.of(context, rootNavigator: true).pop();
                },
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _mergeRankedPatients(
    List<Map<String, dynamic>> existing,
    List<Map<String, dynamic>> incoming,
  ) {
    final byPatientId = <int, Map<String, dynamic>>{};
    for (final patient in [...existing, ...incoming]) {
      final patientId = int.tryParse(patient['patientId']?.toString() ?? '');
      if (patientId != null) byPatientId[patientId] = patient;
    }
    final merged = byPatientId.values.toList()
      ..sort(
        (a, b) => (b['score'] as num? ?? 0).compareTo(a['score'] as num? ?? 0),
      );
    return [
      for (var index = 0; index < merged.length; index++)
        {...merged[index], 'rank': index + 1},
    ];
  }

  @override
  Widget build(BuildContext context) {
    return ClinicalTrialScaffold(
      title: _trial?.name ?? 'Clinical Trial',
      actions: [
        IconButton(
          tooltip: 'Edit Trial',
          onPressed: _trial == null ? null : _openEditTrial,
          icon: const Icon(Icons.edit_outlined),
        ),
        IconButton(
          tooltip: 'Delete Trial',
          onPressed: _trial == null ? null : _confirmDeleteTrial,
          icon: const Icon(Icons.delete_outline),
        ),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorState(message: _error!, onRetry: _load)
              : _content(context, _trial!),
    );
  }

  Widget _content(BuildContext context, ClinicalTrial trial) {
    return ListView(
      children: [
        _summary(trial),
        const SizedBox(height: 16),
        _matchRunnerSection(),
        const SizedBox(height: 16),
        _detailTable(trial),
      ],
    );
  }

  Future<void> _openEditTrial() async {
    final trial = _trial;
    if (trial == null) return;
    final result = await Navigator.push<ClinicalTrialEditResult>(
      context,
      MaterialPageRoute(
        builder: (_) => ClinicalTrialFormScreen(
          api: widget.api,
          args: ClinicalTrialFormArgs.edit(trialId: trial.trialId),
        ),
      ),
    );
    if (result == null || !mounted) return;

    await _load();
    if (!mounted) return;
    final message = result.criteriaChanged
        ? 'Trial updated. Previous ranked results were cleared because the '
            'eligibility criteria changed. Run matching again to generate '
            'updated rankings.'
        : 'Trial updated successfully.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _confirmDeleteTrial() async {
    final trial = _trial;
    if (trial == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Clinical Trial?'),
        content: Text(
          'Delete "${trial.name}"?\n\nThis also removes its saved supplemental criteria, ranked dashboard results, patient links, and trial actions from the local POC database.',
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
    if (confirmed != true) return;

    try {
      await widget.api.deleteClinicalTrial(trial.trialId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Clinical trial deleted.')),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _changeTrialStatus({
    required int status,
    required String statusLabel,
    required String actionLabel,
    bool confirm = false,
  }) async {
    final trial = _trial;
    if (trial == null || _statusUpdating) return;

    if (confirm) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('$actionLabel?'),
          content: Text(
            'Change "${trial.name}" to $statusLabel?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(actionLabel),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    setState(() => _statusUpdating = true);
    try {
      await widget.api.updateClinicalTrialStatus(
        trialId: trial.trialId,
        status: status,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Trial status changed to $statusLabel.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) setState(() => _statusUpdating = false);
    }
  }

  Widget _matchRunnerSection() {
    final hasResults = _matchResults.isNotEmpty;

    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Flexible(
                            child: Text(
                              'Ranked Patient Match Dashboard',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Tooltip(
                            message: 'How matching works',
                            child: IconButton(
                              visualDensity: VisualDensity.compact,
                              icon: const Icon(Icons.info_outline),
                              onPressed: _showMatchingProcessDialog,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  alignment: WrapAlignment.end,
                  children: [
                    if (hasResults)
                      OutlinedButton.icon(
                        onPressed:
                            _matchRunning ? null : _refreshRankedMatching,
                        icon: const Icon(Icons.replay),
                        label: const Text('Refresh Saved Results'),
                      ),
                    MenuAnchor(
                      menuChildren: [
                        MenuItemButton(
                          onPressed: _matchRunning
                              ? null
                              : () => _runMatching(_MatchMode.next),
                          leadingIcon: const Icon(Icons.playlist_add),
                          child: const Text('Match Next 10 Patients'),
                        ),
                        MenuItemButton(
                          onPressed: _matchRunning
                              ? null
                              : () => _runMatching(_MatchMode.all),
                          leadingIcon: const Icon(Icons.groups_outlined),
                          child: const Text('Match All Patients'),
                        ),
                      ],
                      builder: (context, controller, child) {
                        return FilledButton.icon(
                          onPressed: _matchRunning
                              ? null
                              : () {
                                  if (controller.isOpen) {
                                    controller.close();
                                  } else {
                                    controller.open();
                                  }
                                },
                          icon: _matchRunning
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.play_arrow),
                          label: const Text('Match Patients'),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            _matchRunnerStatus(hasResults),
            if (hasResults) ...[
              const SizedBox(height: 12),
              _matchRunnerTable(),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _showMatchingProcessDialog() {
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('How Matching Works'),
        content: SingleChildScrollView(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'The dashboard combines deterministic matching with AI-assisted semantic matching.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                Text(
                  'Pipeline Steps',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 6),
                const Text(
                  '- Deterministic Matching Agent checks objective rule-based criteria such as gender, age, allowed BMI, and pregnancy exclusion.\n'
                  '- Semantic Patient-Trial Comparison Agent reviews the clinical meaning of trial criteria against each patient record.\n'
                  '- Eligibility Scoring Agent combines deterministic results and semantic assessments into the weighted match score.\n'
                  '- Explanation and Recommendation Agent summarizes why the patient received that score/status and suggests next steps.',
                ),
                const SizedBox(height: 16),
                Text(
                  'Deterministic Matching',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'These are exact rule-based checks:\n'
                  '- Gender\n'
                  '- Age range\n'
                  '- Allowed BMI range\n'
                  '- Pregnancy exclusion',
                ),
                const SizedBox(height: 16),
                Text(
                  'AI-Assisted Semantic Matching',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'These are interpreted by clinical meaning because wording can vary:\n'
                  '- Primary Pathology / Target Condition\n'
                  '- Related Conditions\n'
                  '- Disease exclusions\n'
                  '- Surgery exclusions\n'
                  '- Medication exclusions\n'
                  '- Additional Trial / Criteria Information Not Captured by the Base Form',
                ),
                const SizedBox(height: 12),
                const Text(
                  'The semantic review compares those trial criteria against the patient clinical record, including diagnoses, medications, surgeries, history, and notes.',
                ),
                const SizedBox(height: 12),
                const Text(
                  'The AI-assisted review looks for clinical meaning rather than exact text matches, so phrases like "resistant hypertension," "uncontrolled blood pressure," and "hypertension history" can be interpreted together instead of requiring identical wording.',
                ),
                const SizedBox(height: 16),
                Text(
                  'Scoring Weight',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 6),
                _scoringWeightTable(),
                const SizedBox(height: 12),
                const Text(
                  'Hard deterministic exclusions are handled before the percentage model. If a patient triggers a confirmed hard exclusion, their score is capped in the 0-25 range and the status becomes Not Eligible.',
                ),
                const SizedBox(height: 8),
                const Text(
                  'Semantic criteria are scored from the AI assessment for each criterion: Supported and Not Applicable count positively, Conflict lowers the relevant bucket most strongly, Concern lowers it moderately, and Missing adds no score credit while flagging review. Missing evidence means the match is uncertain, not confirmed. High-severity conflicts can still force Needs Review even when the numeric score is strong.',
                ),
                const SizedBox(height: 16),
                Text(
                  'Why Refreshed Scores Can Change',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Refresh Saved Results reruns the AI semantic comparison agent and the AI explanation agent. The scoring formula is deterministic, but the semantic comparison agent can return slightly different criteria assessments, conflicts, concerns, or missing-information judgments on different runs, even for the same trial and patient. Since the scoring formula uses those semantic assessments as input, the final score can move slightly after a refresh. In general, strong candidates should remain in a similar position; large ranking changes usually mean the refreshed semantic review found a meaningfully different clinical concern or support factor.',
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _scoringWeightTable() {
    const rows = [
      ['Objective eligibility', '25%', 'Gender, age, allowed BMI, pregnancy'],
      [
        'Core clinical fit',
        '35%',
        'Primary pathology / target condition and related conditions',
      ],
      [
        'Clinical exclusion safety',
        '25%',
        'Disease, surgery, medication, safety, and contraindication conflicts',
      ],
      [
        'Additional trial / criteria fit',
        '15%',
        'Additional Trial / Criteria Information Not Captured by the Base Form',
      ],
    ];
    return Table(
      columnWidths: const {
        0: FlexColumnWidth(1.35),
        1: FixedColumnWidth(56),
        2: FlexColumnWidth(2.1),
      },
      border: TableBorder.all(
        color: Theme.of(context).colorScheme.outlineVariant,
      ),
      children: [
        TableRow(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
          children: const [
            _ScoringCell('Criteria area', isHeader: true),
            _ScoringCell('Weight', isHeader: true),
            _ScoringCell('Fields included', isHeader: true),
          ],
        ),
        for (final row in rows)
          TableRow(
            children: [
              _ScoringCell(row[0]),
              _ScoringCell(row[1]),
              _ScoringCell(row[2]),
            ],
          ),
      ],
    );
  }

  Widget _matchRunnerStatus(bool hasResults) {
    if (_matchError != null) {
      return _statusChip(
        'Failed: $_matchError',
        Icons.error_outline,
        Theme.of(context).colorScheme.error,
      );
    }
    if (_matchRunning) {
      return const SizedBox.shrink();
    }
    if (!hasResults) {
      return _statusChip(
        'Not started',
        Icons.circle_outlined,
        Theme.of(context).colorScheme.onSurfaceVariant,
      );
    }
    final ranAt = _matchLastRunAt;
    final color = Theme.of(context).colorScheme.primary;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Wrap(
        spacing: 18,
        runSpacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          _dashboardMetaItem(
            Icons.check_circle_outline,
            'Saved ranked results',
            color,
          ),
          if (ranAt != null)
            _dashboardMetaItem(
              Icons.schedule,
              'Updated ${_formatDashboardDate(ranAt)}',
              Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          _dashboardMetaItem(
            Icons.groups_outlined,
            '${_matchResults.length} patients scored',
            Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }

  Widget _dashboardMetaItem(IconData icon, String text, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Text(
          text,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }

  String _formatDashboardDate(DateTime dateTime) {
    final local = dateTime.toLocal();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${months[local.month - 1]} ${local.day}, ${local.year} at $hour:$minute $period';
  }

  Widget _statusChip(String message, IconData icon, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 8),
        Expanded(child: Text(message)),
      ],
    );
  }

  Widget _matchRunnerTable() {
    final rows = List<Map<String, dynamic>>.from(_matchResults)
      ..sort(
          (a, b) => (a['rank'] as num? ?? 0).compareTo(b['rank'] as num? ?? 0));

    return ResponsiveTable(
      dataRowMinHeight: 88,
      dataRowMaxHeight: 220,
      columns: [
        _centeredDashboardColumn('Rank', width: 56),
        _centeredDashboardColumn('Patient', width: 160),
        _centeredDashboardColumn('Match Score', width: 150),
        _centeredDashboardColumn('Match Status', width: 140),
        _centeredDashboardColumn('Deterministic Summary', width: 230),
        _centeredDashboardColumn('Semantic Summary', width: 260),
        _centeredDashboardColumn('Recommendation', width: 240),
        _centeredDashboardColumn('Explanation', width: 260),
      ],
      rows: rows.map((patient) {
        final status = patient['status']?.toString() ?? 'Needs Review';
        final color = _statusColor(status);
        final score = (patient['score'] as num?)?.toInt() ?? 0;
        return DataRow(cells: [
          DataCell(_dashboardCenteredCell(
            width: 56,
            child: Text('${patient['rank'] ?? '-'}'),
          )),
          DataCell(_dashboardCenteredCell(
            width: 160,
            child: _patientCell(patient),
          )),
          DataCell(_dashboardCenteredCell(
            width: 150,
            child: _scoreCell(score, color),
          )),
          DataCell(_dashboardCenteredCell(
            width: 140,
            child: _statusPill(status, color),
          )),
          DataCell(_dashboardCenteredCell(
            width: 230,
            child: _summaryBulletsCell(
              patient,
              Map<String, dynamic>.from(patient['deterministicResult'] ?? {}),
            ),
          )),
          DataCell(_dashboardCenteredCell(
            width: 260,
            child: _semanticSummaryCell(
              Map<String, dynamic>.from(patient['semanticComparison'] ?? {}),
            ),
          )),
          DataCell(_dashboardCenteredCell(
            width: 240,
            child: _suggestedActionCell(patient, color),
          )),
          DataCell(_dashboardCenteredCell(
            width: 260,
            child: _explanationCell(patient),
          )),
        ]);
      }).toList(),
    );
  }

  Widget _dashboardCenteredCell({
    required double width,
    required Widget child,
  }) {
    return SizedBox(
      width: width,
      child: Align(
        alignment: Alignment.center,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: child,
        ),
      ),
    );
  }

  DataColumn _centeredDashboardColumn(String label, {required double width}) {
    return DataColumn(
      label: SizedBox(
        width: width,
        child: Center(
          child: Text(
            label,
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }

  Widget _patientCell(Map<String, dynamic> patient) {
    final patientName = patient['patientName']?.toString() ?? '-';
    final patientId = int.tryParse(patient['patientId']?.toString() ?? '');
    return SizedBox(
      width: 160,
      child: Tooltip(
        message: patientId == null ? '' : 'Open patient profile',
        child: InkWell(
          onTap: patientId == null ? null : () => _openRankedPatient(patient),
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  patientName,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: patientId == null
                        ? null
                        : Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  'Patient ID: ${patient['patientId'] ?? '-'}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _scoreCell(int score, Color color) {
    return SizedBox(
      width: 120,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.circle, size: 10, color: color),
              const SizedBox(width: 6),
              Text('$score%',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: score / 100,
              minHeight: 6,
              color: color,
              backgroundColor: color.withValues(alpha: 0.15),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusPill(String status, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style:
            TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }

  Widget _dashboardBullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 6, right: 8),
            child: Container(
              width: 5,
              height: 5,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.onSurface,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }

  Widget _summaryBulletsCell(
    Map<String, dynamic> patient,
    Map<String, dynamic> deterministicResult,
  ) {
    final lines = _deterministicSummaryLines(deterministicResult);
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 230),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (lines.isEmpty)
            const Text('No deterministic criteria evaluated.')
          else
            ...lines.map((line) => _dashboardBullet(line)),
          const SizedBox(height: 4),
          TextButton(
            onPressed: () =>
                _showDeterministicSummaryDialog(patient, deterministicResult),
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, 32),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Full deterministic summary'),
          ),
        ],
      ),
    );
  }

  Future<void> _showDeterministicSummaryDialog(
    Map<String, dynamic> patient,
    Map<String, dynamic> deterministicResult,
  ) async {
    final patientId = int.tryParse(patient['patientId']?.toString() ?? '');
    PatientProfile? profile;
    if (patientId != null) {
      try {
        profile = await widget.api.getPatientProfile(patientId);
      } catch (_) {
        profile = null;
      }
    }
    if (!mounted) return;

    final rows = _deterministicDetailRows(
      deterministicResult,
      patientProfile: profile,
    );
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Full Deterministic Summary'),
        content: SizedBox(
          width: 720,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columns: const [
                DataColumn(label: Text('Criteria')),
                DataColumn(label: Text('Patient Data')),
                DataColumn(label: Text('Result')),
              ],
              rows: rows
                  .map(
                    (row) => DataRow(
                      cells: [
                        DataCell(SizedBox(
                          width: 230,
                          child: Text(row.criteria),
                        )),
                        DataCell(SizedBox(
                          width: 220,
                          child: Text(row.patientData),
                        )),
                        DataCell(_deterministicResultChip(row.result)),
                      ],
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _deterministicResultChip(String result) {
    final normalized = result.toLowerCase();
    final colorScheme = Theme.of(context).colorScheme;
    final color = normalized == 'matched'
        ? colorScheme.primary
        : normalized == 'failed'
            ? colorScheme.error
            : colorScheme.onSurfaceVariant;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        result,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _semanticSummaryCell(Map<String, dynamic> semanticComparison) {
    final lines = _semanticSummaryLines(semanticComparison);
    return _dashboardPreviewListCell(
      title: 'Semantic Summary',
      lines: lines,
      previewLines: _semanticSummaryPreviewLines(lines),
      emptyText: 'No semantic criteria evaluated.',
      width: 260,
    );
  }

  Widget _explanationCell(Map<String, dynamic> patient) {
    final explanation = _clinicalRationaleExplanation(patient);
    final error = patient['error']?.toString();
    if (error != null && error.isNotEmpty) {
      return ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 260),
        child: Text(
          'Explanation unavailable: $error',
          style: TextStyle(color: Theme.of(context).colorScheme.error),
        ),
      );
    }
    return _dashboardPreviewTextCell(
      text: explanation.isEmpty ? 'No explanation generated.' : explanation,
      width: 260,
      showFullButton:
          explanation.isNotEmpty && _isOverDashboardPreviewLimit(explanation),
      onViewFull: () => _showExplanationDialog(patient),
      fullButtonLabel: 'Full explanation',
    );
  }

  Future<void> _showExplanationDialog(Map<String, dynamic> patient) {
    final explanation = _clinicalRationaleExplanation(patient);
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(patient['patientName']?.toString() ?? 'Patient'),
        content: SizedBox(
          width: 560,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                SelectableText(
                  explanation.isEmpty
                      ? 'No clinical rationale generated.'
                      : explanation,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  String _clinicalRationaleExplanation(Map<String, dynamic> patient) {
    final explanation = patient['explanation']?.toString() ?? '';
    final suggestedActions = (patient['suggestedActions'] as List? ?? const [])
        .map((item) => item.toString())
        .toList();
    return _removeSuggestedActionText(explanation, suggestedActions);
  }

  String _removeSuggestedActionText(
    String explanation,
    List<String> suggestedActions,
  ) {
    final cleanExplanation = _cleanSummaryText(explanation);
    if (cleanExplanation.isEmpty) return '';

    final sentences = _splitSentences(cleanExplanation);
    final filtered = sentences
        .where((sentence) =>
            !_isSuggestedActionSentence(sentence, suggestedActions))
        .toList();
    if (filtered.isEmpty) return '';
    return filtered.join(' ');
  }

  List<String> _splitSentences(String text) {
    final sentences = <String>[];
    final buffer = StringBuffer();
    for (var index = 0; index < text.length; index += 1) {
      final char = text[index];
      buffer.write(char);
      final isSentenceEnd = char == '.' || char == '!' || char == '?';
      final isLast = index == text.length - 1;
      final nextIsSpace = !isLast && text[index + 1].trim().isEmpty;
      if ((isSentenceEnd && nextIsSpace) || isLast) {
        final sentence = buffer.toString().trim();
        if (sentence.isNotEmpty) sentences.add(sentence);
        buffer.clear();
      }
    }
    return sentences;
  }

  bool _isSuggestedActionSentence(
    String sentence,
    List<String> suggestedActions,
  ) {
    final lower = sentence.toLowerCase().trim();
    const actionPhrases = [
      'suggested action',
      'suggested actions',
      'suggested next step',
      'suggested next steps',
      'next step',
      'next steps',
      'recommended action',
      'recommended actions',
      'recommendation',
      'recommendations',
      'confirm details',
      'invite patient',
      'do not invite',
      'request confirmation',
    ];
    if (actionPhrases.any((phrase) => lower.startsWith(phrase))) return true;
    if (lower.contains('suggested action') ||
        lower.contains('suggested next step') ||
        lower.contains('recommended action') ||
        lower.contains('next step is') ||
        lower.contains('next steps are')) {
      return true;
    }

    final normalizedSentence = _normalizeForComparison(sentence);
    for (final action in suggestedActions) {
      final normalizedAction = _normalizeForComparison(action);
      if (normalizedAction.length < 20) continue;
      final actionPrefix = normalizedAction.length > 60
          ? normalizedAction.substring(0, 60)
          : normalizedAction;
      if (normalizedSentence.contains(actionPrefix)) return true;
    }
    return false;
  }

  String _normalizeForComparison(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  Widget _suggestedActionCell(Map<String, dynamic> patient, Color _) {
    final primaryAction = _displayPrimaryAction(patient['primaryAction']);
    final suggestedActions = (patient['suggestedActions'] as List? ?? const [])
        .map((item) => item.toString())
        .toList();
    final visibleActions = _suggestedActionsPreviewLines(suggestedActions);
    final hasFullActions = suggestedActions.isNotEmpty;

    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 240),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          RichText(
            textAlign: TextAlign.start,
            text: TextSpan(
              style: Theme.of(context).textTheme.bodyMedium,
              children: [
                TextSpan(
                  text: 'Recommendation: ',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                TextSpan(text: primaryAction),
              ],
            ),
          ),
          if (visibleActions.isNotEmpty) ...[
            const SizedBox(height: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children:
                  visibleActions.map((line) => _dashboardBullet(line)).toList(),
            ),
            if (hasFullActions)
              _viewFullTextButton(
                'Full next steps',
                () => _showSuggestedNextStepsDialog(suggestedActions),
              ),
          ],
        ],
      ),
    );
  }

  Widget _dashboardPreviewListCell({
    required String title,
    required List<String> lines,
    List<String>? previewLines,
    required String emptyText,
    required double width,
  }) {
    final visibleLines = previewLines ?? _previewLines(lines);
    final showFull = lines.isNotEmpty &&
        (previewLines != null || _areLinesOverDashboardPreviewLimit(lines));
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: width),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: lines.isEmpty
            ? [Text(emptyText, style: Theme.of(context).textTheme.bodyMedium)]
            : [
                ...visibleLines.map(
                  (line) => _dashboardBullet(line),
                ),
                if (showFull)
                  _viewFullTextButton(
                    'Full ${title.toLowerCase()}',
                    () => _showDashboardTextDialog(
                      title: title,
                      lines: lines,
                    ),
                  ),
              ],
      ),
    );
  }

  Widget _dashboardPreviewTextCell({
    required String text,
    required double width,
    required bool showFullButton,
    required VoidCallback onViewFull,
    required String fullButtonLabel,
  }) {
    final preview = _previewText(text);
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: width),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            preview,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            softWrap: true,
          ),
          if (showFullButton) _viewFullTextButton(fullButtonLabel, onViewFull),
        ],
      ),
    );
  }

  Widget _viewFullTextButton(String label, VoidCallback onPressed) {
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton(
        style: TextButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: const Size(0, 28),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        onPressed: onPressed,
        child: Text(label),
      ),
    );
  }

  Future<void> _showDashboardTextDialog({
    required String title,
    required List<String> lines,
  }) {
    final isSemanticSummary = title == 'Semantic Summary';
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SizedBox(
          width: 620,
          child: SingleChildScrollView(
            child: isSemanticSummary
                ? _semanticSummaryDialogContent(lines)
                : SelectableText(
                    lines.isEmpty
                        ? 'No details available.'
                        : lines.map((line) => '- $line').join('\n'),
                  ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _showSuggestedNextStepsDialog(List<String> actions) {
    final cleanActions = actions
        .map(_cleanSummaryText)
        .where((action) => action.isNotEmpty)
        .toList();
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Suggested Next Steps'),
        content: SizedBox(
          width: 640,
          child: SingleChildScrollView(
            child: cleanActions.isEmpty
                ? const Text('No suggested next steps available.')
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Review these follow-up items before contacting or inviting the patient.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 14),
                      for (var index = 0;
                          index < cleanActions.length;
                          index += 1)
                        _suggestedNextStepRow(
                          index: index,
                          text: cleanActions[index],
                        ),
                    ],
                  ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _suggestedNextStepRow({
    required int index,
    required String text,
  }) {
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: colorScheme.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colorScheme.primary.withValues(alpha: 0.15)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colorScheme.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '${index + 1}',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SelectableText(
              text,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _semanticSummaryDialogContent(List<String> lines) {
    final grouped = _groupSemanticSummaryLines(lines);
    if (grouped.values.every((items) => items.isEmpty)) {
      return const Text('No semantic details available.');
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final section in _semanticSummarySections)
          if (grouped[section.label]?.isNotEmpty ?? false) ...[
            _semanticSummarySectionHeader(
              section,
              grouped[section.label]!.length,
            ),
            const SizedBox(height: 8),
            ...grouped[section.label]!.map(
              (line) => _semanticSummaryDetailRow(section, line),
            ),
            const SizedBox(height: 14),
          ],
      ],
    );
  }

  Widget _semanticSummarySectionHeader(
    _SemanticSummarySection section,
    int count,
  ) {
    return Row(
      children: [
        Icon(section.icon, size: 18, color: section.color),
        const SizedBox(width: 8),
        Text(
          '${section.label} ($count)',
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
      ],
    );
  }

  Widget _semanticSummaryDetailRow(
    _SemanticSummarySection section,
    String text,
  ) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: section.color.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: section.color.withValues(alpha: 0.18)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Icon(section.icon, size: 16, color: section.color),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _semanticSummaryDetailText(text),
          ),
        ],
      ),
    );
  }

  Widget _semanticSummaryDetailText(String text) {
    final criterionMatch = RegExp(
      r'\bCriterion:\s*',
      caseSensitive: false,
    ).firstMatch(text);
    if (criterionMatch == null) {
      return SelectableText(
        text,
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }

    final patientText = text.substring(0, criterionMatch.start).trim();
    final criterionText = text.substring(criterionMatch.end).trim();
    final baseStyle = Theme.of(context).textTheme.bodyMedium;
    final labelStyle = baseStyle?.copyWith(fontWeight: FontWeight.w700);

    return SelectableText.rich(
      TextSpan(
        style: baseStyle,
        children: [
          if (patientText.isNotEmpty) ...[
            TextSpan(text: 'Patient: ', style: labelStyle),
            TextSpan(text: patientText),
            const TextSpan(text: '\n'),
          ],
          if (criterionText.isNotEmpty) ...[
            TextSpan(text: 'Criterion: ', style: labelStyle),
            TextSpan(text: criterionText),
          ],
        ],
      ),
    );
  }

  Map<String, List<String>> _groupSemanticSummaryLines(List<String> lines) {
    final grouped = {
      for (final section in _semanticSummarySections) section.label: <String>[],
    };
    for (final rawLine in lines) {
      final parsed = _parseSemanticSummaryLine(rawLine);
      grouped[parsed.section]!.add(parsed.text);
    }
    return grouped;
  }

  _ParsedSemanticSummaryLine _parseSemanticSummaryLine(String rawLine) {
    final cleanLine = _cleanSummaryText(rawLine);
    final lower = cleanLine.toLowerCase();

    if (lower.startsWith('supports:')) {
      return _ParsedSemanticSummaryLine(
        section: 'Supports',
        text: cleanLine.substring('Supports:'.length).trim(),
      );
    }
    if (lower.startsWith('missing:')) {
      return _ParsedSemanticSummaryLine(
        section: 'Missing',
        text: cleanLine.substring('Missing:'.length).trim(),
      );
    }
    if (lower.contains('conflict:')) {
      return _ParsedSemanticSummaryLine(
        section: 'Conflicts',
        text: cleanLine.replaceFirst(RegExp(r'^.*conflict:\s*'), '').trim(),
      );
    }
    if (lower.contains('concern:')) {
      return _ParsedSemanticSummaryLine(
        section: 'Concerns',
        text: cleanLine.replaceFirst(RegExp(r'^.*concern:\s*'), '').trim(),
      );
    }
    return _ParsedSemanticSummaryLine(section: 'Other', text: cleanLine);
  }

  List<String> _previewLines(List<String> lines) {
    final visible = <String>[];
    var usedCharacters = 0;
    for (final line in lines) {
      final cleanLine = _cleanSummaryText(line);
      if (cleanLine.isEmpty) continue;
      final nextTotal = usedCharacters + cleanLine.length;
      if (visible.isNotEmpty && nextTotal > _dashboardPreviewCharacterLimit) {
        break;
      }
      if (nextTotal > _dashboardPreviewCharacterLimit) {
        visible.add(_previewText(cleanLine));
        break;
      }
      visible.add(cleanLine);
      usedCharacters = nextTotal;
      if (visible.length >= 3) break;
    }
    return visible;
  }

  bool _areLinesOverDashboardPreviewLimit(List<String> lines) {
    if (lines.length > _previewLines(lines).length) return true;
    return lines.join(' ').length > _dashboardPreviewCharacterLimit;
  }

  bool _isOverDashboardPreviewLimit(String text) {
    return text.replaceAll(RegExp(r'\s+'), ' ').trim().length >
        _dashboardPreviewCharacterLimit;
  }

  String _previewText(String text) {
    final compact = text.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (compact.length <= _dashboardPreviewCharacterLimit) return compact;
    return '${compact.substring(0, _dashboardPreviewCharacterLimit - 3)}...';
  }

  List<String> _semanticSummaryPreviewLines(List<String> lines) {
    if (lines.isEmpty) return const [];
    var conflicts = 0;
    var concerns = 0;
    var missing = 0;
    var supports = 0;
    for (final rawLine in lines) {
      final line = rawLine.toLowerCase();
      if (line.contains('conflict')) {
        conflicts += 1;
      } else if (line.contains('concern')) {
        concerns += 1;
      } else if (line.startsWith('missing')) {
        missing += 1;
      } else if (line.startsWith('supports')) {
        supports += 1;
      }
    }

    final preview = <String>[];
    if (conflicts > 0 || concerns > 0) {
      final parts = <String>[
        if (conflicts > 0) '$conflicts conflict${conflicts == 1 ? '' : 's'}',
        if (concerns > 0) '$concerns concern${concerns == 1 ? '' : 's'}',
      ];
      preview.add('${parts.join(' and ')} need clinical review.');
    }
    if (missing > 0) {
      preview.add(
        '$missing missing detail${missing == 1 ? '' : 's'} should be confirmed.',
      );
    }
    if (supports > 0) {
      preview.add(
        '$supports semantic factor${supports == 1 ? '' : 's'} support eligibility.',
      );
    }
    if (preview.isEmpty) {
      preview.add(
        '${lines.length} semantic detail${lines.length == 1 ? '' : 's'} available.',
      );
    }
    return preview.take(3).toList();
  }

  List<String> _suggestedActionsPreviewLines(List<String> actions) {
    final cleanActions = actions
        .map(_cleanSummaryText)
        .where((action) => action.isNotEmpty)
        .toList();
    if (cleanActions.isEmpty) return const [];
    return [
      '${cleanActions.length} suggested next step${cleanActions.length == 1 ? '' : 's'} generated.',
    ];
  }

  String _displayPrimaryAction(dynamic action) {
    final text = action?.toString().trim();
    if (text == null || text.isEmpty || text == 'Request Confirmation') {
      return 'Confirm Details';
    }
    return text;
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Strong Match':
      case 'Likely Match':
        return Colors.green;
      case 'Needs Review':
        return Colors.amber.shade800;
      case 'Weak Match':
      case 'Not Eligible':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  static const _deterministicFieldLabels = {
    'pathology': 'Primary pathology / target condition',
    'gender': 'Gender',
    'age': 'Age',
    'bmi': 'BMI',
    'diseases': 'Diseases',
    'priorMedications': 'Medication exclusions',
    'surgeries': 'Surgeries',
    'pregnancy': 'Pregnancy status',
  };

  List<String> _deterministicSummaryLines(
      Map<String, dynamic> deterministicResult) {
    final matched = _stringList(deterministicResult['matchedFields']);
    final failed = _stringList(deterministicResult['failedFields']);
    final missing = _stringList(deterministicResult['missingFields']);
    final hardExclusions =
        _stringList(deterministicResult['hardExclusionFlags']).toSet();

    String label(String field) => _deterministicFieldLabels[field] ?? field;

    final lines = <String>[];
    for (final field in matched) {
      lines.add('${label(field)} matches trial criteria.');
    }
    for (final field in failed) {
      lines.add(hardExclusions.contains(field)
          ? '${label(field)} triggers a hard exclusion.'
          : '${label(field)} does not match trial criteria.');
    }
    for (final field in missing) {
      lines.add('${label(field)} could not be evaluated (data missing).');
    }
    return lines;
  }

  List<_DeterministicDetailRow> _deterministicDetailRows(
    Map<String, dynamic> deterministicResult, {
    PatientProfile? patientProfile,
  }) {
    final details = _mapList(deterministicResult['criteriaDetails']);
    if (details.isNotEmpty) {
      return details
          .map(
            (detail) => _repairDeterministicDetailRow(
              _DeterministicDetailRow(
                field: detail['field']?.toString(),
                criteria: detail['criterion']?.toString() ?? '-',
                patientData: detail['patientData']?.toString() ?? '-',
                result: detail['outcome']?.toString() ?? 'Needs Review',
              ),
              patientProfile: patientProfile,
            ),
          )
          .toList();
    }

    final matched = _stringList(deterministicResult['matchedFields']);
    final failed = _stringList(deterministicResult['failedFields']);
    final missing = _stringList(deterministicResult['missingFields']);
    final rows = <_DeterministicDetailRow>[];

    String label(String field) => _deterministicFieldLabels[field] ?? field;
    for (final field in matched) {
      rows.add(_DeterministicDetailRow(
        field: field,
        criteria: label(field),
        patientData: 'Available in saved deterministic result',
        result: 'Matched',
      ));
    }
    for (final field in failed) {
      rows.add(_DeterministicDetailRow(
        field: field,
        criteria: label(field),
        patientData: 'Available in saved deterministic result',
        result: 'Failed',
      ));
    }
    for (final field in missing) {
      rows.add(_DeterministicDetailRow(
        field: field,
        criteria: label(field),
        patientData: 'Not Available',
        result: 'Missing',
      ));
    }
    if (rows.isEmpty) {
      rows.add(const _DeterministicDetailRow(
        field: null,
        criteria: 'Deterministic criteria',
        patientData: 'Not Available',
        result: 'Not Evaluated',
      ));
    }
    return rows;
  }

  _DeterministicDetailRow _repairDeterministicDetailRow(
    _DeterministicDetailRow row, {
    PatientProfile? patientProfile,
  }) {
    if (!_isPregnancyDeterministicRow(row)) return row;
    final pregnancies = patientProfile?.history('pregnancies').trim() ?? '';
    if (pregnancies.isEmpty || pregnancies == '-') return row;
    return row.copyWith(patientData: 'Pregnancies: $pregnancies');
  }

  bool _isPregnancyDeterministicRow(_DeterministicDetailRow row) {
    final field = row.field?.toLowerCase().trim();
    final criteria = row.criteria.toLowerCase();
    return field == 'pregnancy' || criteria.contains('pregnancy exclusion');
  }

  List<String> _semanticSummaryLines(Map<String, dynamic> semanticComparison) {
    if (semanticComparison.isEmpty) return const [];
    final error = semanticComparison['error']?.toString().trim();
    if (error != null && error.isNotEmpty) {
      return const ['Semantic review unavailable.'];
    }

    final assessments = _mapList(semanticComparison['criteriaAssessments']);
    if (assessments.isNotEmpty) {
      final priority = {
        'Conflict': 0,
        'Concern': 1,
        'Missing': 2,
        'Supported': 3,
        'Not Applicable': 4,
      };
      final sortedAssessments = List<Map<String, dynamic>>.from(assessments)
        ..sort((a, b) {
          final aOutcome = a['outcome']?.toString() ?? '';
          final bOutcome = b['outcome']?.toString() ?? '';
          return (priority[aOutcome] ?? 5).compareTo(priority[bOutcome] ?? 5);
        });
      final lines = sortedAssessments
          .map(_semanticAssessmentLine)
          .where((line) => line.isNotEmpty)
          .toList();
      if (lines.isNotEmpty) return lines;
    }

    final lines = <String>[];
    for (final item in _mapList(semanticComparison['potentialConflicts'])) {
      final severity = item['severity']?.toString();
      final description = _semanticDescription(item);
      if (description.isNotEmpty) {
        lines.add('${_severityPrefix(severity)}conflict: $description');
      }
    }
    for (final item in _mapList(semanticComparison['concerns'])) {
      final severity = item['severity']?.toString();
      final description = _semanticDescription(item);
      if (description.isNotEmpty) {
        lines.add('${_severityPrefix(severity)}concern: $description');
      }
    }
    for (final item in _stringList(semanticComparison['missingInformation'])) {
      final description = _cleanSummaryText(item);
      if (description.isNotEmpty) lines.add('Missing: $description');
    }
    for (final item in _stringList(semanticComparison['supportingFactors'])) {
      final description = _cleanSummaryText(item);
      if (description.isNotEmpty) lines.add('Supports: $description');
    }
    return lines;
  }

  String _semanticAssessmentLine(Map<String, dynamic> assessment) {
    final outcome = assessment['outcome']?.toString() ?? '';
    if (outcome == 'Not Applicable') return '';
    final rawCriterion = assessment['criterion']?.toString().trim() ?? '';
    final rawExplanation = assessment['explanation']?.toString().trim() ?? '';
    final detail = _semanticAssessmentDetail(rawCriterion, rawExplanation);
    if (detail.isEmpty) return '';
    final severity = assessment['severity']?.toString();
    switch (outcome) {
      case 'Supported':
        return 'Supports: $detail';
      case 'Conflict':
        return '${_severityPrefix(severity)}conflict: $detail';
      case 'Concern':
        return '${_severityPrefix(severity)}concern: $detail';
      case 'Missing':
        return 'Missing: $detail';
      default:
        return detail;
    }
  }

  String _semanticAssessmentDetail(String criterion, String explanation) {
    final cleanCriterion = _cleanSummaryText(criterion);
    final cleanExplanation = _cleanSummaryText(explanation);
    if (cleanExplanation.isEmpty) return cleanCriterion;
    if (cleanCriterion.isEmpty) return cleanExplanation;
    return '$cleanExplanation Criterion: $cleanCriterion';
  }

  String _semanticDescription(Map<String, dynamic> item) {
    final rawDescription = item['description']?.toString().trim() ?? '';
    final rawCriterion = item['criterion']?.toString().trim() ?? '';
    return _cleanSummaryText(
      rawDescription.isNotEmpty ? rawDescription : rawCriterion,
    );
  }

  String _severityPrefix(String? severity) {
    if (severity == null || severity.isEmpty) return '';
    return '$severity ';
  }

  String _cleanSummaryText(String value) {
    return value.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  List<String> _stringList(dynamic value) {
    if (value is! List) return const [];
    return value.map((item) => item.toString()).toList();
  }

  Widget _summary(ClinicalTrial trial) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(trial.name, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 12),
            _textBlock('Official Title', trial.text('official_title')),
            _textBlock('Brief Summary', trial.text('brief_summary')),
            _textBlock(
                'Detailed Description', trial.text('detailed_description')),
            Wrap(
              spacing: 24,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _fact('Start Date', trial.text('start_date')),
                if (trial.text('end_date') != '-')
                  _fact('End Date', trial.text('end_date')),
                _statusMenu(trial.status),
              ],
            ),
            const SizedBox(height: 12),
            _statusInfo(trial.status),
          ],
        ),
      ),
    );
  }

  List<_TrialStatusAction> _statusActionsFor(String status) {
    return switch (status) {
      'Under Review' => [
          const _TrialStatusAction(
            label: 'Activate Trial',
            icon: Icons.play_arrow,
            status: 1,
            statusLabel: 'Ongoing',
            tooltip: 'Move this reviewed trial into active recruitment.',
          ),
          const _TrialStatusAction(
            label: 'Reject Trial',
            icon: Icons.block,
            status: 3,
            statusLabel: 'Rejected',
            tooltip: 'Mark this trial as not approved for this workspace.',
            confirm: true,
          ),
        ],
      'Ongoing' => [
          const _TrialStatusAction(
            label: 'Mark Completed',
            icon: Icons.check_circle_outline,
            status: 2,
            statusLabel: 'Completed',
            tooltip:
                'Close this trial when recruitment or trial work is finished.',
            confirm: true,
          ),
          const _TrialStatusAction(
            label: 'Reject Trial',
            icon: Icons.block,
            status: 3,
            statusLabel: 'Rejected',
            tooltip:
                'Stop this trial if it should no longer continue in this workspace.',
            confirm: true,
          ),
        ],
      _ => const <_TrialStatusAction>[],
    };
  }

  Widget _statusMenu(String status) {
    final actions = _statusActionsFor(status);
    return Wrap(
      spacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        const Text('Status: ', style: TextStyle(fontWeight: FontWeight.w700)),
        PopupMenuButton<_TrialStatusAction>(
          enabled: !_statusUpdating && actions.isNotEmpty,
          tooltip:
              actions.isEmpty ? 'No status actions available' : 'Change status',
          onSelected: (action) => _changeTrialStatus(
            status: action.status,
            statusLabel: action.statusLabel,
            actionLabel: action.label,
            confirm: action.confirm,
          ),
          itemBuilder: (context) => actions
              .map(
                (action) => PopupMenuItem<_TrialStatusAction>(
                  value: action,
                  child: ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(action.icon),
                    title: Text(action.label),
                    subtitle: Text(action.tooltip),
                  ),
                ),
              )
              .toList(),
          child: _StatusMenuButton(
            label: status,
            enabled: actions.isNotEmpty,
            loading: _statusUpdating,
          ),
        ),
      ],
    );
  }

  Widget _statusInfo(String status) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.info_outline,
          size: 18,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            _statusDescription(status),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ),
      ],
    );
  }

  Widget _detailTable(ClinicalTrial trial) {
    final rows = {
      'Company Name': _detailValue(trial.text('company_name')),
      'Trial ID': trial.formattedTrialId,
      'Related Conditions': _detailValue(trial.text('related_conditions')),
      'Trial Status': _detailValue(trial.text('trial_status')),
      'Trial Phase': _detailValue(trial.text('trial_phase')),
      'Study Type': _detailValue(trial.text('study_type')),
      'Allocation': _detailValue(trial.text('allocation')),
      'Intervention Model': _detailValue(trial.text('intervention_model')),
      'Masking': _detailValue(trial.text('masking')),
      'Primary Purpose': _detailValue(trial.text('primary_purpose')),
      'Locations': _detailValue(trial.text('locations')),
      'Principal Investigator':
          _detailValue(trial.text('principal_investigator')),
      'Sponsor': _detailValue(trial.text('sponsor')),
      'Ethics Approval': _detailValue(trial.text('ethics_approval')),
      'Inclusion Criteria - Primary Pathology / Target Condition':
          _detailValue(trial.text('pathology')),
      'Inclusion Criteria - Age Range': _detailValue(trial.text('age_range')),
      'Inclusion Criteria - Gender': _detailValue(trial.text('gender')),
      'Exclusion Criteria - Allowed BMI Range':
          _formatAllowedBmiRangeWithMeaning(
        trial.exclusionCriteria['BMI']?.toString(),
      ),
      'Exclusion Criteria - Diseases':
          _exclusionValue(trial.exclusionCriteria['Diseases']),
      'Exclusion Criteria - Pregnancy':
          _exclusionValue(trial.exclusionCriteria['Pregnancy']),
      'Exclusion Criteria - Surgeries':
          _exclusionValue(trial.exclusionCriteria['Surgeries']),
      'Exclusion Criteria - Medication Exclusions': _exclusionValue(
        trial.exclusionCriteria['Prior Medications'] ??
            trial.exclusionCriteria['PriorMedications'],
      ),
    };
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Detailed Information',
                style: Theme.of(context).textTheme.titleMedium),
            ResponsiveTable(
              columns: const [
                DataColumn(label: Text('Criteria')),
                DataColumn(label: Text('Details')),
              ],
              rows: rows.entries
                  .map(
                (entry) => DataRow(
                  cells: [
                    DataCell(Text(entry.key)),
                    DataCell(_detailValueText(entry.value)),
                  ],
                ),
              )
                  .followedBy([_additionalTrialInformationRow(trial)]).toList(),
            ),
          ],
        ),
      ),
    );
  }

  DataRow _additionalTrialInformationRow(ClinicalTrial trial) {
    return DataRow(
      cells: [
        const DataCell(
          Text(
            'Additional Trial / Criteria Information Not Captured by the Base Form',
          ),
        ),
        DataCell(
          TextButton.icon(
            onPressed: () => _showAdditionalTrialInformationDialog(trial),
            icon: const Icon(Icons.open_in_new, size: 18),
            label: const Text('View additional criteria'),
            style: TextButton.styleFrom(
              alignment: Alignment.centerLeft,
              minimumSize: Size.zero,
              padding: EdgeInsets.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _showAdditionalTrialInformationDialog(ClinicalTrial trial) {
    final semanticCriteriaFuture =
        widget.api.getSemanticCriteria(trial.trialId);
    return showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(
          'Additional Trial / Criteria Information Not Captured by the Base Form',
        ),
        content: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: FutureBuilder<Map<String, dynamic>?>(
            future: semanticCriteriaFuture,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const SizedBox(
                  height: 96,
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError) {
                return _dialogNotice(
                  'Could not load additional trial information: ${snapshot.error}',
                  Icons.error_outline,
                  Theme.of(context).colorScheme.error,
                );
              }
              return _additionalTrialInformationContent(snapshot.data);
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Widget _additionalTrialInformationContent(Map<String, dynamic>? row) {
    final colorScheme = Theme.of(context).colorScheme;
    if (row == null) {
      return _dialogNotice(
        'No additional trial information was saved for this trial.',
        Icons.info_outline,
        colorScheme.onSurfaceVariant,
      );
    }

    final criteria = _semanticCriteriaJson(row['criteria_json']);
    final items = (criteria['additionalTrialInformation'] as List?) ?? const [];
    final notes = _stringList(criteria['missingOrAmbiguousCriteria']);
    final summary = _optionalString(row['summary']);
    final rawSourceType = row['source_type'] ?? row['sourceType'];
    final sourceType = _formatSemanticCriteriaSource(
      rawSourceType,
    );
    final isManualEntry = rawSourceType == 'manual_form';

    final hasContent =
        items.isNotEmpty || notes.isNotEmpty || (summary?.isNotEmpty ?? false);
    if (!hasContent) {
      return _dialogNotice(
        'No additional trial information was saved for this trial.',
        Icons.info_outline,
        colorScheme.onSurfaceVariant,
      );
    }

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (sourceType != null) ...[
            Text(
              'Source: $sourceType',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 12),
          ],
          if (summary != null && summary.isNotEmpty) ...[
            Text(summary),
            const SizedBox(height: 16),
          ],
          if (items.isEmpty)
            _dialogNotice(
              'No additional criteria were saved.',
              Icons.info_outline,
              colorScheme.onSurfaceVariant,
            )
          else ...[
            Text(
              'Additional Criteria',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            for (final item in items.whereType<Map>())
              _additionalTrialInformationItem(
                Map<String, dynamic>.from(item),
              ),
          ],
          if (!isManualEntry) ...[
            const SizedBox(height: 12),
            Text(
              'Additional Extraction Notes',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            if (notes.isEmpty)
              Text(
                'No additional extraction notes were returned for this trial.',
                style: TextStyle(
                  color: colorScheme.onSurfaceVariant,
                  fontStyle: FontStyle.italic,
                ),
              )
            else
              for (final note in notes)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('- '),
                      Expanded(child: Text(note)),
                    ],
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _additionalTrialInformationItem(Map<String, dynamic> item) {
    final category = _optionalString(item['category']) ?? 'General';
    final criterion = _optionalString(item['criterion']) ?? '';
    final rationale = _optionalString(item['rationale']);
    final relevance = _optionalString(item['relevance']) ?? 'Unspecified';
    final relevanceLabel =
        category == 'Manual Entry' ? 'User provided' : relevance;
    final title = category == 'Manual Entry'
        ? criterion
        : criterion.isEmpty
            ? category
            : '$category: $criterion';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: category == 'Manual Entry' ? 116 : 86,
            child: Chip(
              label: Text(
                relevanceLabel,
                style: const TextStyle(fontSize: 11),
              ),
              visualDensity: VisualDensity.compact,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                if (rationale != null && rationale.isNotEmpty)
                  Text(
                    rationale,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dialogNotice(String message, IconData icon, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 8),
        Expanded(child: Text(message)),
      ],
    );
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

  String? _optionalString(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
  }

  String? _formatSemanticCriteriaSource(dynamic value) {
    final source = _optionalString(value);
    if (source == null) return null;
    return switch (source) {
      'manual_form' => 'Manual entry',
      'supplemental_agent' => 'Document upload',
      _ => source,
    };
  }

  void _openRankedPatient(Map<String, dynamic> patient) {
    final trial = _trial;
    final patientId = int.tryParse(patient['patientId']?.toString() ?? '');
    if (trial == null || patientId == null) return;
    Navigator.pushNamed(
      context,
      PatientDetailScreen.routeName,
      arguments: PatientDetailArgs(
        patientId: patientId,
        trial: trial,
      ),
    );
  }

  Widget _textBlock(String title, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(value),
        ],
      ),
    );
  }

  Widget _fact(String title, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$title: ', style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(value),
      ],
    );
  }

  String _detailValue(dynamic value) {
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty || text == '-') return 'Not Applicable';
    if (text.toUpperCase() == 'N/A') return 'Not Applicable';
    return text;
  }

  Widget _detailValueText(String value) {
    final isEmptyState = value == 'No exclusion criteria specified' ||
        value == 'No BMI exclusion criteria specified' ||
        value == 'Not Applicable';
    if (!isEmptyState) return Text(value);
    return Text(
      value,
      style: TextStyle(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        fontStyle: FontStyle.italic,
      ),
    );
  }

  String _exclusionValue(dynamic value) {
    final text = value?.toString().trim() ?? '';
    if (text.isEmpty || text == '-') return 'No exclusion criteria specified';
    return text;
  }

  String _formatAllowedBmiRangeWithMeaning(String? value) {
    final allowedRange = _formatAllowedBmiRange(value);
    if (allowedRange == '-') return 'No BMI exclusion criteria specified';
    final bounds = allowedRange.split(' to ');
    if (bounds.length == 2) {
      return '$allowedRange (exclude BMI below ${bounds[0]} or above ${bounds[1]})';
    }
    return '$allowedRange (exclude BMI outside the allowed range)';
  }

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

  String _statusDescription(String status) => switch (status) {
        'Under Review' =>
          'The trial exists in the system but has not been activated for active recruitment.',
        'Ongoing' =>
          'The trial is active and can be treated as open for current recruitment work.',
        'Completed' =>
          'The trial has finished and is no longer active for recruitment.',
        'Rejected' =>
          'The trial was not approved to continue in this workspace.',
        _ => 'Status information is not available.',
      };
}

class _StatusMenuButton extends StatelessWidget {
  const _StatusMenuButton({
    required this.label,
    required this.enabled,
    required this.loading,
  });

  final String label;
  final bool enabled;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final foreground = enabled
        ? colorScheme.primary
        : colorScheme.onSurface.withValues(alpha: 0.72);
    final border = enabled
        ? colorScheme.primary.withValues(alpha: 0.55)
        : colorScheme.outlineVariant;

    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (loading)
            SizedBox.square(
              dimension: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: foreground,
              ),
            )
          else
            Icon(
              enabled ? Icons.keyboard_arrow_down : Icons.lock_outline,
              size: 18,
              color: foreground,
            ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _TrialStatusAction {
  const _TrialStatusAction({
    required this.label,
    required this.icon,
    required this.status,
    required this.statusLabel,
    required this.tooltip,
    this.confirm = false,
  });

  final String label;
  final IconData icon;
  final int status;
  final String statusLabel;
  final String tooltip;
  final bool confirm;
}

class _ScoringCell extends StatelessWidget {
  const _ScoringCell(this.text, {this.isHeader = false});

  final String text;
  final bool isHeader;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: isHeader ? FontWeight.w700 : FontWeight.w400,
            ),
      ),
    );
  }
}

enum _MatchMode { next, all }

class _DeterministicDetailRow {
  const _DeterministicDetailRow({
    required this.field,
    required this.criteria,
    required this.patientData,
    required this.result,
  });

  final String? field;
  final String criteria;
  final String patientData;
  final String result;

  _DeterministicDetailRow copyWith({
    String? patientData,
  }) {
    return _DeterministicDetailRow(
      field: field,
      criteria: criteria,
      patientData: patientData ?? this.patientData,
      result: result,
    );
  }
}

class _SemanticSummarySection {
  const _SemanticSummarySection({
    required this.label,
    required this.icon,
    required this.color,
  });

  final String label;
  final IconData icon;
  final Color color;
}

class _ParsedSemanticSummaryLine {
  const _ParsedSemanticSummaryLine({
    required this.section,
    required this.text,
  });

  final String section;
  final String text;
}

class _MatchProgress {
  const _MatchProgress({
    required this.current,
    required this.total,
    required this.message,
    required this.complete,
    required this.finalizing,
    this.animatedDots = '',
  });

  final int current;
  final int total;
  final String message;
  final bool complete;
  final bool finalizing;
  final String animatedDots;

  double? get value {
    if (finalizing && !complete) return null;
    if (total <= 0) return 0;
    return (current / total).clamp(0, 1).toDouble();
  }
}

class _MatchProgressDialog extends StatelessWidget {
  const _MatchProgressDialog({
    required this.progress,
    required this.onCancel,
  });

  final _MatchProgress progress;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final message = progress.complete
        ? progress.message
        : '${progress.message}${progress.animatedDots}';

    return AlertDialog(
      title: const Text('Ranking Patients'),
      content: SizedBox(
        width: 460,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: progress.value,
                minHeight: 8,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                SizedBox.square(
                  dimension: 24,
                  child: progress.complete
                      ? Icon(
                          Icons.check_circle,
                          color: colorScheme.primary,
                          size: 24,
                        )
                      : CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: colorScheme.primary,
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    message,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              ],
            ),
            if (!progress.complete) ...[
              const SizedBox(height: 8),
              Text(
                'This may take a while for large patient sets.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
              ),
            ],
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
