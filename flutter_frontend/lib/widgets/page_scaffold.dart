import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../services/auth_session.dart';

const _logoAsset = 'assets/branding/ehospital_logo.svg';

class ClinicalTrialScaffold extends StatelessWidget {
  const ClinicalTrialScaffold({
    super.key,
    required this.title,
    required this.child,
    this.actions,
    this.toolbarHeight,
    this.selectedSection = WorkspaceSection.trialList,
  });

  final String title;
  final Widget child;
  final List<Widget>? actions;
  final double? toolbarHeight;
  final WorkspaceSection selectedSection;

  @override
  Widget build(BuildContext context) {
    final isWide = MediaQuery.sizeOf(context).width >= 920;
    return Scaffold(
      appBar: AppBar(
        leading: isWide
            ? null
            : Builder(
                builder: (context) => IconButton(
                  tooltip: 'Open navigation',
                  onPressed: () => Scaffold.of(context).openDrawer(),
                  icon: const Icon(Icons.menu),
                ),
              ),
        title: _HeaderTitle(title: title),
        centerTitle: false,
        toolbarHeight: toolbarHeight,
        actions: actions,
      ),
      drawer: isWide
          ? null
          : Drawer(
              child: _WorkspaceNavigation(
                selectedSection: selectedSection,
                closeAfterNavigation: true,
              ),
            ),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          color: Color(0xffeef4fb),
        ),
        child: SafeArea(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isWide)
                SizedBox(
                  width: 280,
                  child: _WorkspaceNavigation(
                    selectedSection: selectedSection,
                  ),
                ),
              if (isWide)
                VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: Theme.of(context).colorScheme.outlineVariant,
                ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: child,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum WorkspaceSection {
  trialList,
  createTrial,
}

class _HeaderTitle extends StatelessWidget {
  const _HeaderTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
          ),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: SvgPicture.asset(_logoAsset),
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'eHospital',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _WorkspaceNavigation extends StatelessWidget {
  const _WorkspaceNavigation({
    required this.selectedSection,
    this.closeAfterNavigation = false,
  });

  final WorkspaceSection selectedSection;
  final bool closeAfterNavigation;

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.maybeOf(context);
    final company = auth?.company;
    return ColoredBox(
      color: const Color(0xfffbfcfd),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
        children: [
          _NavGroup(
            label: 'Clinical Trials',
            children: [
              _NavItem(
                icon: Icons.format_list_bulleted,
                label: 'Trial List',
                selected: selectedSection == WorkspaceSection.trialList,
                onTap: () => _goHome(context),
              ),
              _NavItem(
                icon: Icons.add_circle_outline,
                label: 'Create Trial',
                selected: selectedSection == WorkspaceSection.createTrial,
                onTap: () => _openCreateTrial(context),
              ),
            ],
          ),
          if (company != null) ...[
            const Divider(height: 30),
            _AccountIdentity(email: company.email),
            const SizedBox(height: 8),
            _NavItem(
              icon: Icons.logout,
              label: 'Logout',
              onTap: () => _logout(context),
            ),
          ],
        ],
      ),
    );
  }

  void _goHome(BuildContext context) {
    if (closeAfterNavigation) Navigator.pop(context);
    Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
  }

  void _openCreateTrial(BuildContext context) {
    if (closeAfterNavigation) Navigator.pop(context);
    Navigator.pushNamed(context, '/clinical-trials/new');
  }

  void _logout(BuildContext context) {
    final auth = AuthScope.maybeOf(context);
    if (closeAfterNavigation) Navigator.pop(context);
    auth?.onLogout();
    Navigator.of(context, rootNavigator: true).pushNamedAndRemoveUntil(
      '/',
      (route) => false,
    );
  }
}

class _AccountIdentity extends StatelessWidget {
  const _AccountIdentity({required this.email});

  final String email;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final trimmedEmail = email.trim();
    if (trimmedEmail.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Tooltip(
        message: trimmedEmail,
        child: Text(
          trimmedEmail,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w700,
              ),
        ),
      ),
    );
  }
}

class _NavGroup extends StatelessWidget {
  const _NavGroup({required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
          child: Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0,
                ),
          ),
        ),
        ...children,
      ],
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    this.selected = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final enabled = onTap != null;
    final foreground = selected
        ? colorScheme.onPrimary
        : enabled
            ? colorScheme.onSurface
            : colorScheme.onSurfaceVariant.withValues(alpha: 0.62);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: selected ? colorScheme.primary : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            height: 44,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Icon(icon, size: 20, color: foreground),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      label,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: foreground,
                            fontWeight:
                                selected ? FontWeight.w800 : FontWeight.w600,
                          ),
                    ),
                  ),
                  if (!enabled)
                    Text(
                      'Soon',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: foreground,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
