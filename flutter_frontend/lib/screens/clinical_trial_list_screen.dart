import 'package:flutter/material.dart';

import '../models/clinical_trial.dart';
import '../services/api_service.dart';
import '../widgets/page_scaffold.dart';
import '../widgets/responsive_table.dart';
import '../widgets/status_chip.dart';
import 'clinical_trial_detail_screen.dart';
import 'clinical_trial_form_screen.dart';

class ClinicalTrialListScreen extends StatefulWidget {
  const ClinicalTrialListScreen({super.key, required this.api});

  final ApiService api;

  @override
  State<ClinicalTrialListScreen> createState() =>
      _ClinicalTrialListScreenState();
}

class _ClinicalTrialListScreenState extends State<ClinicalTrialListScreen> {
  late Future<List<ClinicalTrial>> _future;
  int _sortColumnIndex = 0;
  bool _sortAscending = true;
  int _rowsPerPage = 10;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _future = widget.api.getDetailedClinicalTrials();
  }

  void _reload() {
    setState(() {
      _future = widget.api.getDetailedClinicalTrials();
      _page = 0;
    });
  }

  void _sortBy(int columnIndex, bool ascending) {
    setState(() {
      _sortColumnIndex = columnIndex;
      _sortAscending = ascending;
      _page = 0;
    });
  }

  List<ClinicalTrial> _sortedTrials(List<ClinicalTrial> trials) {
    final sorted = List<ClinicalTrial>.of(trials);
    sorted.sort((a, b) {
      final comparison = _compareValues(
        _sortValue(a, _sortColumnIndex),
        _sortValue(b, _sortColumnIndex),
      );
      return _sortAscending ? comparison : -comparison;
    });
    return sorted;
  }

  Object _sortValue(ClinicalTrial trial, int columnIndex) {
    return switch (columnIndex) {
      0 => trial.name,
      1 => trial.trialId,
      2 => trial.text('related_conditions'),
      3 => trial.text('trial_phase'),
      4 => trial.status,
      5 => trial.text('study_type'),
      6 => trial.text('locations'),
      7 => trial.text('principal_investigator'),
      8 => trial.text('sponsor'),
      9 => trial.text('ethics_approval'),
      _ => trial.name,
    };
  }

  int _compareValues(Object left, Object right) {
    if (left is num && right is num) return left.compareTo(right);
    return left.toString().toLowerCase().compareTo(
          right.toString().toLowerCase(),
        );
  }

  List<ClinicalTrial> _visibleTrials(List<ClinicalTrial> trials) {
    final page = _effectivePage(trials.length);
    final start = page * _rowsPerPage;
    if (start >= trials.length) return const [];
    final end = start + _rowsPerPage;
    return trials.sublist(start, end > trials.length ? trials.length : end);
  }

  int _effectivePage(int totalRows) {
    if (totalRows <= 0) return 0;
    final maxPage = (totalRows - 1) ~/ _rowsPerPage;
    if (_page <= maxPage) return _page;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _page > maxPage) {
        setState(() => _page = maxPage);
      }
    });
    return maxPage;
  }

  void _changeRowsPerPage(int? value) {
    if (value == null) return;
    setState(() {
      _rowsPerPage = value;
      _page = 0;
    });
  }

  Future<void> _openTrial(ClinicalTrial trial) async {
    final shouldReload = await Navigator.pushNamed(
      context,
      ClinicalTrialDetailScreen.routeName,
      arguments: ClinicalTrialDetailArgs(trial.trialId),
    );
    if (!mounted) return;
    if (shouldReload == true) _reload();
  }

  @override
  Widget build(BuildContext context) {
    return ClinicalTrialScaffold(
      title: 'Clinical Trial List',
      selectedSection: WorkspaceSection.trialList,
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _reload,
          icon: const Icon(Icons.refresh),
        ),
        FilledButton.icon(
          onPressed: () async {
            await Navigator.pushNamed(
                context, ClinicalTrialFormScreen.routeName);
            _reload();
          },
          icon: const Icon(Icons.add),
          label: const Text('Add'),
        ),
        const SizedBox(width: 12),
      ],
      child: FutureBuilder<List<ClinicalTrial>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ErrorState(
              message: snapshot.error.toString(),
              onRetry: _reload,
            );
          }
          final trials = snapshot.data ?? const [];
          final sortedTrials = _sortedTrials(trials);
          final currentPage = _effectivePage(sortedTrials.length);
          final visibleTrials = _visibleTrials(sortedTrials);
          final firstRow =
              trials.isEmpty ? 0 : (currentPage * _rowsPerPage) + 1;
          final lastRow = (currentPage * _rowsPerPage) + visibleTrials.length;
          final canGoBack = currentPage > 0;
          final canGoForward = lastRow < sortedTrials.length;
          final rowHoverColor =
              Theme.of(context).colorScheme.primary.withValues(alpha: 0.06);
          return SingleChildScrollView(
            child: Card(
              elevation: 0,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 22, 24, 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Clinical Trial List',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                    const SizedBox(height: 18),
                    ResponsiveTable(
                      sortColumnIndex: _sortColumnIndex,
                      sortAscending: _sortAscending,
                      columns: [
                        DataColumn(
                          label: const Text('Name'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('ID'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Conditions'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Phase'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Status'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Type'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Location'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Investigator'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Sponsor'),
                          onSort: _sortBy,
                        ),
                        DataColumn(
                          label: const Text('Ethics'),
                          onSort: _sortBy,
                        ),
                      ],
                      rows: visibleTrials.map((trial) {
                        return DataRow(
                          onSelectChanged: (_) => _openTrial(trial),
                          mouseCursor: WidgetStateProperty.all(
                            SystemMouseCursors.click,
                          ),
                          color: WidgetStateProperty.resolveWith((states) {
                            if (states.contains(WidgetState.hovered)) {
                              return rowHoverColor;
                            }
                            return null;
                          }),
                          cells: [
                            DataCell(
                              _interactiveCell(
                                trial,
                                _fixedTextCell(
                                  trial.name,
                                  width: 220,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600),
                                ),
                              ),
                            ),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(trial.formattedTrialId, width: 72),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(
                                trial.text('related_conditions'),
                                width: 220,
                              ),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(
                                trial.text('trial_phase'),
                                width: 120,
                              ),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              SizedBox(
                                width: 152,
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: StatusChip(
                                    label: trial.status,
                                    fixedSize: StatusChip.trialListSize,
                                  ),
                                ),
                              ),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(
                                trial.text('study_type'),
                                width: 140,
                              ),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(
                                trial.text('locations'),
                                width: 180,
                              ),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(
                                trial.text('principal_investigator'),
                                width: 180,
                              ),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(trial.text('sponsor'), width: 180),
                            )),
                            DataCell(_interactiveCell(
                              trial,
                              _fixedTextCell(
                                trial.text('ethics_approval'),
                                width: 140,
                              ),
                            )),
                          ],
                        );
                      }).toList(),
                    ),
                    if (trials.isNotEmpty) ...[
                      const Divider(height: 1),
                      SizedBox(
                        height: 58,
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                const Text('Rows per page:'),
                                const SizedBox(width: 12),
                                DropdownButton<int>(
                                  value: _rowsPerPage,
                                  items: const [
                                    DropdownMenuItem(
                                        value: 10, child: Text('10')),
                                    DropdownMenuItem(
                                        value: 20, child: Text('20')),
                                    DropdownMenuItem(
                                        value: 50, child: Text('50')),
                                  ],
                                  onChanged: _changeRowsPerPage,
                                ),
                                const SizedBox(width: 28),
                                Text(
                                  '$firstRow-$lastRow of ${sortedTrials.length}',
                                ),
                                const SizedBox(width: 16),
                                IconButton(
                                  tooltip: 'Previous page',
                                  onPressed: canGoBack
                                      ? () => setState(
                                          () => _page = currentPage - 1)
                                      : null,
                                  icon: const Icon(Icons.chevron_left),
                                ),
                                IconButton(
                                  tooltip: 'Next page',
                                  onPressed: canGoForward
                                      ? () => setState(
                                          () => _page = currentPage + 1)
                                      : null,
                                  icon: const Icon(Icons.chevron_right),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _interactiveCell(ClinicalTrial trial, Widget child) {
    return Semantics(
      button: true,
      label: 'Open trial ${trial.formattedTrialId}',
      child: child,
    );
  }

  Widget _fixedTextCell(
    String value, {
    required double width,
    TextStyle? style,
    TextAlign textAlign = TextAlign.left,
  }) {
    final displayValue = value.trim().isEmpty ? '-' : value;
    return Tooltip(
      message: displayValue,
      waitDuration: const Duration(milliseconds: 500),
      child: SizedBox(
        width: width,
        child: Text(
          displayValue,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          softWrap: false,
          textAlign: textAlign,
          style: style,
        ),
      ),
    );
  }
}
