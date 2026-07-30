import 'dart:convert';

import 'package:flutter/widgets.dart';

import 'login_storage.dart';

class PharmaCompanySession {
  const PharmaCompanySession({
    required this.id,
    required this.name,
    required this.email,
  });

  final int id;
  final String name;
  final String email;

  static const type = 'Pharma';

  Map<String, dynamic> toJson() => {
        'type': type,
        'id': id,
        'name': name,
        'email': email,
      };

  static PharmaCompanySession? fromLoginResponse(Map<dynamic, dynamic> json) {
    final id = _parsePositiveId(json['id']);
    final name = json['name']?.toString().trim() ?? '';
    final email = json['email']?.toString().trim() ?? '';
    if (id == null || name.isEmpty || email.isEmpty) return null;
    return PharmaCompanySession(id: id, name: name, email: email);
  }

  static PharmaCompanySession? fromStoredJson(Map<dynamic, dynamic> json) {
    if (json['type'] != type) return null;
    final id = _parsePositiveId(json['id']);
    final name = json['name']?.toString().trim() ?? '';
    final email = json['email']?.toString().trim() ?? '';
    if (id == null || name.isEmpty || email.isEmpty) return null;
    return PharmaCompanySession(id: id, name: name, email: email);
  }

  static int? _parsePositiveId(dynamic value) {
    final id = value is num ? value.toInt() : int.tryParse('$value');
    return id != null && id > 0 ? id : null;
  }
}

class AuthSessionController extends ChangeNotifier {
  AuthSessionController({required LoginStorage storage}) : _storage = storage;

  static const storageKey = 'loginData';

  final LoginStorage _storage;
  PharmaCompanySession? _company;
  bool _initialized = false;

  PharmaCompanySession? get company => _company;
  bool get initialized => _initialized;
  bool get isAuthenticated => _company != null;

  void restoreStoredLogin() {
    final sessionCompany = _readStoredCompany(
      read: _storage.readSession,
      clear: _storage.clearSession,
    );
    final localCompany = sessionCompany ??
        _readStoredCompany(
          read: _storage.readLocal,
          clear: _storage.clearLocal,
        );
    _company = localCompany;
    _initialized = true;
    notifyListeners();
  }

  void saveLogin(
    PharmaCompanySession company, {
    required bool rememberMe,
  }) {
    _storage.clearSession(storageKey);
    _storage.clearLocal(storageKey);
    final encoded = jsonEncode(company.toJson());
    if (rememberMe) {
      _storage.writeLocal(storageKey, encoded);
    } else {
      _storage.writeSession(storageKey, encoded);
    }
    _company = company;
    _initialized = true;
    notifyListeners();
  }

  void clearLogin() {
    _storage.clearSession(storageKey);
    _storage.clearLocal(storageKey);
    _company = null;
    _initialized = true;
    notifyListeners();
  }

  PharmaCompanySession? _readStoredCompany({
    required String? Function(String key) read,
    required void Function(String key) clear,
  }) {
    final raw = read(storageKey);
    if (raw == null || raw.trim().isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        final company = PharmaCompanySession.fromStoredJson(decoded);
        if (company != null) return company;
      }
    } catch (_) {
      // Cleared below.
    }
    clear(storageKey);
    return null;
  }
}

class AuthScope extends InheritedWidget {
  const AuthScope({
    super.key,
    required this.company,
    required this.onLogout,
    required super.child,
  });

  final PharmaCompanySession? company;
  final VoidCallback onLogout;

  static AuthScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<AuthScope>();
  }

  @override
  bool updateShouldNotify(AuthScope oldWidget) {
    return company != oldWidget.company || onLogout != oldWidget.onLogout;
  }
}
