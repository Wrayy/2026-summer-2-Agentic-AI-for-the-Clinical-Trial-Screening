import 'package:flutter/material.dart';

class ResponsiveTable extends StatefulWidget {
  const ResponsiveTable({
    super.key,
    required this.columns,
    required this.rows,
    this.emptyMessage = 'No records found.',
    this.dataRowMinHeight,
    this.dataRowMaxHeight,
    this.sortColumnIndex,
    this.sortAscending = true,
  });

  final List<DataColumn> columns;
  final List<DataRow> rows;
  final String emptyMessage;
  final double? dataRowMinHeight;
  final double? dataRowMaxHeight;
  final int? sortColumnIndex;
  final bool sortAscending;

  @override
  State<ResponsiveTable> createState() => _ResponsiveTableState();
}

class _ResponsiveTableState extends State<ResponsiveTable> {
  late final ScrollController _horizontalController;

  @override
  void initState() {
    super.initState();
    _horizontalController = ScrollController();
  }

  @override
  void dispose() {
    _horizontalController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rows.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(child: Text(widget.emptyMessage)),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        return Scrollbar(
          controller: _horizontalController,
          thumbVisibility: true,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: SingleChildScrollView(
              controller: _horizontalController,
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: constraints.maxWidth),
                child: DataTable(
                  headingRowColor:
                      WidgetStateProperty.all(Colors.grey.shade100),
                  sortColumnIndex: widget.sortColumnIndex,
                  sortAscending: widget.sortAscending,
                  showCheckboxColumn: false,
                  dataRowMinHeight: widget.dataRowMinHeight,
                  dataRowMaxHeight: widget.dataRowMaxHeight,
                  columns: widget.columns,
                  rows: widget.rows,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
