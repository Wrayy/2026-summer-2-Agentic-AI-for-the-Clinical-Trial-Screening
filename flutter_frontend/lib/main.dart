import 'package:flutter/material.dart';

import 'screens/clinical_trial_form_screen.dart';
import 'screens/clinical_trial_list_screen.dart';
import 'screens/clinical_trial_detail_screen.dart';
import 'screens/pharma_login_screen.dart';
import 'screens/patient_detail_screen.dart';
import 'services/api_service.dart';
import 'services/auth_session.dart';
import 'services/login_storage.dart';

void main() {
  runApp(const ClinicalTrialApp());
}

class ClinicalTrialApp extends StatefulWidget {
  const ClinicalTrialApp({
    super.key,
    this.api,
    this.authController,
  });

  final ApiService? api;
  final AuthSessionController? authController;

  @override
  State<ClinicalTrialApp> createState() => _ClinicalTrialAppState();
}

class _ClinicalTrialAppState extends State<ClinicalTrialApp> {
  late final ApiService _api = widget.api ?? ApiService();
  late final AuthSessionController _auth = widget.authController ??
      AuthSessionController(storage: createLoginStorage());
  late final bool _ownsAuthController = widget.authController == null;

  @override
  void initState() {
    super.initState();
    _auth.addListener(_syncApiCompany);
    _auth.restoreStoredLogin();
    _syncApiCompany();
  }

  @override
  void dispose() {
    _auth.removeListener(_syncApiCompany);
    if (_ownsAuthController) _auth.dispose();
    super.dispose();
  }

  void _syncApiCompany() {
    final company = _auth.company;
    if (company == null) {
      _api.clearCompanyContext();
    } else {
      _api.setCompanyContext(company);
    }
  }

  Future<void> _login({
    required String email,
    required String password,
    required bool rememberMe,
  }) async {
    final company = await _api.loginPharmaceuticalOffice(
      email: email,
      password: password,
    );
    _api.setCompanyContext(company);
    _auth.saveLogin(company, rememberMe: rememberMe);
  }

  void _logout() {
    _auth.clearLogin();
    _api.clearCompanyContext();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _auth,
      builder: (context, _) {
        return MaterialApp(
          title: 'Clinical Trials',
          debugShowCheckedModeBanner: false,
          theme: _theme(),
          builder: (context, child) {
            return AuthScope(
              company: _auth.company,
              onLogout: _logout,
              child: child ?? const SizedBox.shrink(),
            );
          },
          home: _home(),
          onGenerateRoute: _onGenerateRoute,
        );
      },
    );
  }

  Widget _home() {
    if (!_auth.initialized) return const _AuthLoadingScreen();
    if (!_auth.isAuthenticated) {
      return PharmaLoginScreen(onLogin: _login);
    }
    return ClinicalTrialListScreen(api: _api);
  }

  Route<dynamic>? _onGenerateRoute(RouteSettings settings) {
    if (!_auth.isAuthenticated) {
      return MaterialPageRoute(builder: (_) => _home(), settings: settings);
    }

    final args = settings.arguments;
    if (settings.name == ClinicalTrialFormScreen.routeName) {
      return MaterialPageRoute(
        builder: (_) => ClinicalTrialFormScreen(
          api: _api,
          args: args is ClinicalTrialFormArgs ? args : null,
        ),
      );
    }
    if (settings.name == ClinicalTrialDetailScreen.routeName &&
        args is ClinicalTrialDetailArgs) {
      return MaterialPageRoute(
        builder: (_) => ClinicalTrialDetailScreen(api: _api, args: args),
      );
    }
    if (settings.name == PatientDetailScreen.routeName &&
        args is PatientDetailArgs) {
      return MaterialPageRoute(
        builder: (_) => PatientDetailScreen(api: _api, args: args),
      );
    }
    return null;
  }

  ThemeData _theme() {
    return ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xff174ac9),
        primary: const Color(0xff174ac9),
        secondary: const Color(0xff5d6b9a),
      ),
      scaffoldBackgroundColor: const Color(0xffeef4fb),
      fontFamily: 'Segoe UI',
      useMaterial3: true,
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xfffbfcfd),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: Color(0xffdbe3ea)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        isDense: true,
      ),
    );
  }
}

class _AuthLoadingScreen extends StatelessWidget {
  const _AuthLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
