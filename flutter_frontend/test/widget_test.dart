import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:clinical_trial_flutter/main.dart';
import 'package:clinical_trial_flutter/screens/clinical_trial_detail_screen.dart';
import 'package:clinical_trial_flutter/screens/clinical_trial_form_screen.dart';
import 'package:clinical_trial_flutter/screens/clinical_trial_list_screen.dart';
import 'package:clinical_trial_flutter/services/api_service.dart';
import 'package:clinical_trial_flutter/services/auth_session.dart';
import 'package:clinical_trial_flutter/services/login_storage.dart';
import 'package:clinical_trial_flutter/utils/document_file_picker.dart';
import 'package:clinical_trial_flutter/widgets/status_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  group('Pharmaceutical Office auth session', () {
    test(
        'remember me writes local storage and one-session login writes session storage',
        () {
      final storage = createLoginStorage();
      final auth = AuthSessionController(storage: storage);
      const company = PharmaCompanySession(
        id: 1,
        name: 'Standalone Pharma',
        email: 'pharm1@test.com',
      );

      auth.saveLogin(company, rememberMe: true);

      expect(storage.readLocal(AuthSessionController.storageKey), isNotNull);
      expect(storage.readSession(AuthSessionController.storageKey), isNull);

      auth.saveLogin(company, rememberMe: false);

      expect(storage.readSession(AuthSessionController.storageKey), isNotNull);
      expect(storage.readLocal(AuthSessionController.storageKey), isNull);
    });

    test('stored session payloads are sanitized and never include password',
        () {
      final storage = createLoginStorage();
      final auth = AuthSessionController(storage: storage);
      final company = PharmaCompanySession.fromLoginResponse({
        'id': 1,
        'name': 'Standalone Pharma',
        'email': 'pharm1@test.com',
        'password': 'secret',
        'token': 'raw-token',
      });

      auth.saveLogin(company!, rememberMe: true);

      final decoded = jsonDecode(
        storage.readLocal(AuthSessionController.storageKey)!,
      ) as Map<String, dynamic>;
      expect(decoded, {
        'type': 'Pharma',
        'id': 1,
        'name': 'Standalone Pharma',
        'email': 'pharm1@test.com',
      });
      expect(decoded.containsKey('password'), isFalse);
      expect(decoded.containsKey('token'), isFalse);
      expect(storage.readSession(AuthSessionController.storageKey), isNull);
    });

    test('session storage is restored before local storage', () {
      final storage = createLoginStorage();
      storage.writeSession(
        AuthSessionController.storageKey,
        jsonEncode({
          'type': 'Pharma',
          'id': 1,
          'name': 'Session Pharma',
          'email': 'session@test.com',
        }),
      );
      storage.writeLocal(
        AuthSessionController.storageKey,
        jsonEncode({
          'type': 'Pharma',
          'id': 2,
          'name': 'Local Pharma',
          'email': 'local@test.com',
        }),
      );

      final auth = AuthSessionController(storage: storage);
      auth.restoreStoredLogin();

      expect(auth.company?.id, 1);
      expect(auth.company?.name, 'Session Pharma');
    });

    test('malformed and non-Pharma storage entries are rejected', () {
      final storage = createLoginStorage();
      storage.writeLocal(
        AuthSessionController.storageKey,
        jsonEncode({
          'type': 'Physician',
          'id': 1,
          'name': 'Wrong Portal',
          'email': 'doctor@test.com',
        }),
      );

      final auth = AuthSessionController(storage: storage);
      auth.restoreStoredLogin();

      expect(auth.isAuthenticated, isFalse);
      expect(storage.readLocal(AuthSessionController.storageKey), isNull);
    });

    test('logout clears all stored login state', () {
      final storage = createLoginStorage();
      final auth = AuthSessionController(storage: storage);
      auth.saveLogin(
        const PharmaCompanySession(
          id: 1,
          name: 'Standalone Pharma',
          email: 'pharm1@test.com',
        ),
        rememberMe: true,
      );

      auth.clearLogin();

      expect(auth.isAuthenticated, isFalse);
      expect(storage.readLocal(AuthSessionController.storageKey), isNull);
      expect(storage.readSession(AuthSessionController.storageKey), isNull);
    });
  });

  testWidgets('logged-out app shows Pharmaceutical Office login',
      (tester) async {
    await tester.pumpWidget(
      ClinicalTrialApp(
        api: _apiWithHandler((request) async {
          throw StateError('No HTTP calls expected before login.');
        }),
      ),
    );

    expect(find.text('Pharmaceutical Office Login'), findsOneWidget);
    expect(
      find.text(
        'This clinical trial module is available only to authorized pharmaceutical company users.',
      ),
      findsOneWidget,
    );
    expect(find.text('Log In'), findsOneWidget);
  });

  testWidgets(
      'successful login sends Pharma option and scopes trial list by company', (
    tester,
  ) async {
    final storage = createLoginStorage();
    Map<String, dynamic>? loginBody;
    Map<String, dynamic>? listBody;
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/login')) {
        loginBody = _requestJson(request);
        return http.Response(
          jsonEncode({
            'id': 77,
            'name': 'Standalone Pharma',
            'email': 'pharm1@test.com',
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        listBody = _requestJson(request);
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.enterText(find.byType(TextFormField).at(0), 'pharm1@test.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'pharm1');
    await tester.tap(find.widgetWithText(FilledButton, 'Log In'));
    await tester.pumpAndSettle();

    expect(loginBody?['email'], 'pharm1@test.com');
    expect(loginBody?['password'], 'pharm1');
    expect(loginBody?['selectedOption'], 'Pharma');
    expect(listBody?['companyId'], 77);
    expect(api.companyName, 'Standalone Pharma');
    expect(storage.readSession(AuthSessionController.storageKey), isNotNull);
    expect(find.text('Clinical Trial List'), findsWidgets);
  });

  testWidgets('authenticated sidebar shows email without company name',
      (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final storage = _storageWithCompany(id: 77);
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('pharm1@test.com'), findsOneWidget);
    expect(find.text('Standalone Pharma'), findsNothing);
    expect(find.text('Logout'), findsOneWidget);
  });

  testWidgets('invalid login stores nothing and reports incorrect credentials',
      (
    tester,
  ) async {
    final storage = createLoginStorage();
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/login')) {
        return http.Response(jsonEncode('wrong credentials'), 400);
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.enterText(find.byType(TextFormField).at(0), 'pharm1@test.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'bad-password');
    await tester.tap(find.widgetWithText(FilledButton, 'Log In'));
    await tester.pumpAndSettle();

    expect(find.text('Incorrect email or password.'), findsOneWidget);
    expect(storage.readLocal(AuthSessionController.storageKey), isNull);
    expect(storage.readSession(AuthSessionController.storageKey), isNull);
  });

  testWidgets(
      'authenticated create trial route still opens with editable Trial ID', (
    tester,
  ) async {
    final storage = _storageWithCompany(id: 77);
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      if (request.url.path.endsWith('/getNextClinicalTrialId')) {
        return _jsonResponse({'status': 'OK', 'result': 1201});
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Add'));
    await tester.pumpAndSettle();

    expect(find.text('Create Clinical Trial'), findsWidgets);
    expect(find.byTooltip('Create Trial'), findsOneWidget);
    expect(find.text('Fill Test Data'), findsNothing);
    expect(find.text('Cancel'), findsNothing);
    expect(find.text('1201'), findsOneWidget);
  });

  testWidgets(
      'trial list defaults to 10 rows, reorders columns, and opens from non-name cells',
      (tester) async {
    final storage = _storageWithCompany(id: 77);
    Map<String, dynamic>? detailBody;
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({
          'status': 'OK',
          'result': List.generate(
            12,
            (index) => _trialJson(
              index + 1,
              name: 'Trial ${(index + 1).toString().padLeft(3, '0')}',
              sponsor: 'Sponsor ${index + 1}',
              status: index.isEven ? 'Ongoing' : 'Under Review',
            ),
          ),
        });
      }
      if (request.url.path.endsWith('/getSpecificClinicalTrialsInfo')) {
        detailBody = _requestJson(request);
        return _jsonResponse({
          'status': 'OK',
          'result': [_trialJson(detailBody?['trial_id'] as int)],
        });
      }
      if (request.url.path.contains('/semantic-criteria/')) {
        return _jsonResponse({'status': 'OK', 'result': null});
      }
      if (request.url.path.contains('/ranked-patients/')) {
        return _jsonResponse({
          'status': 'OK',
          'result': {'patients': []},
        });
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();

    final table = tester.widget<DataTable>(find.byType(DataTable));
    expect(
      table.columns.map((column) => (column.label as Text).data).toList(),
      [
        'Name',
        'ID',
        'Conditions',
        'Phase',
        'Status',
        'Type',
        'Location',
        'Investigator',
        'Sponsor',
        'Ethics',
      ],
    );
    expect(table.columns[1].numeric, isFalse);
    expect(find.text('Trial 010'), findsOneWidget);
    expect(find.text('Trial 011'), findsNothing);
    expect(find.text('1-10 of 12'), findsOneWidget);

    await tester.ensureVisible(find.byType(DropdownButton<int>));
    await tester.tap(find.byType(DropdownButton<int>));
    await tester.pumpAndSettle();
    expect(find.text('10'), findsWidgets);
    expect(find.text('20'), findsOneWidget);
    expect(find.text('50'), findsOneWidget);
    expect(find.text('5'), findsNothing);
    await tester.tap(find.text('20').last);
    await tester.pumpAndSettle();
    expect(find.text('1-12 of 12'), findsOneWidget);

    await tester.ensureVisible(find.text('Sponsor 2'));
    await tester.tap(find.text('Sponsor 2'));
    await tester.pumpAndSettle();
    expect(detailBody?['trial_id'], 2);
  });

  testWidgets('trial list status chips align with header and show full labels',
      (tester) async {
    final statuses = [
      'Under Review',
      'Ongoing',
      'Completed',
      'Rejected',
    ];
    final storage = _storageWithCompany(id: 77);
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({
          'status': 'OK',
          'result': [
            for (var index = 0; index < statuses.length; index++)
              _trialJson(index + 1, status: statuses[index]),
          ],
        });
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();

    for (final status in statuses) {
      final chipFinder = find.ancestor(
        of: find.text(status),
        matching: find.byType(Chip),
      );
      expect(chipFinder, findsOneWidget);
      expect(tester.getSize(chipFinder), StatusChip.trialListSize);
      final textRect = tester.getRect(find.text(status));
      final chipRect = tester.getRect(chipFinder);
      expect(textRect.left, greaterThanOrEqualTo(chipRect.left));
      expect(textRect.right, lessThanOrEqualTo(chipRect.right));
      expect(
        (textRect.center.dy - chipRect.center.dy).abs(),
        lessThanOrEqualTo(1.5),
      );
    }

    final headerLeft = tester.getTopLeft(find.text('Status')).dx;
    final firstChipLeft = tester
        .getTopLeft(
          find.ancestor(
              of: find.text('Under Review'), matching: find.byType(Chip)),
        )
        .dx;
    expect((firstChipLeft - headerLeft).abs(), lessThanOrEqualTo(16));

    final ongoingChip = tester.widget<Chip>(
      find.ancestor(of: find.text('Ongoing'), matching: find.byType(Chip)),
    );
    final rejectedChip = tester.widget<Chip>(
      find.ancestor(of: find.text('Rejected'), matching: find.byType(Chip)),
    );
    expect(ongoingChip.backgroundColor, isNot(rejectedChip.backgroundColor));
  });

  testWidgets('authenticated edit route preserves edit arguments',
      (tester) async {
    final storage = _storageWithCompany(id: 77);
    Map<String, dynamic>? detailBody;
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      if (request.url.path.endsWith('/getSpecificClinicalTrialsInfo')) {
        detailBody = _requestJson(request);
        return _jsonResponse({
          'status': 'OK',
          'result': [_trialJson(1234)],
        });
      }
      if (request.url.path.endsWith('/semantic-criteria/1234')) {
        return _jsonResponse({'status': 'OK', 'result': null});
      }
      if (request.url.path.endsWith('/ranked-patients/1234')) {
        return _jsonResponse({
          'status': 'OK',
          'result': {'patients': []},
        });
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();

    final context = tester.element(find.byType(ClinicalTrialListScreen));
    Navigator.of(context).pushNamed(
      ClinicalTrialFormScreen.routeName,
      arguments: const ClinicalTrialFormArgs.edit(trialId: 1234),
    );
    await tester.pumpAndSettle();

    expect(detailBody?['trial_id'], 1234);
    expect(find.text('Edit Trial'), findsWidgets);
    expect(find.byTooltip('Save Changes'), findsOneWidget);
    expect(find.byTooltip('Cancel editing'), findsOneWidget);
    expect(find.text('Route Trial'), findsOneWidget);
  });

  testWidgets('edit cancel prompts only when dirty and preserves changes',
      (tester) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var updateCalls = 0;
    final storage = _storageWithCompany(id: 77);
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      if (request.url.path.endsWith('/getSpecificClinicalTrialsInfo')) {
        return _jsonResponse({
          'status': 'OK',
          'result': [_trialJson(1234)],
        });
      }
      if (request.url.path.endsWith('/semantic-criteria/1234')) {
        return _jsonResponse({'status': 'OK', 'result': null});
      }
      if (request.url.path.endsWith('/ranked-patients/1234')) {
        return _jsonResponse({
          'status': 'OK',
          'result': {'patients': []},
        });
      }
      if (request.url.path.endsWith('/update-trial')) {
        updateCalls += 1;
        return _jsonResponse({'status': 'OK', 'result': {}});
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();
    final context = tester.element(find.byType(ClinicalTrialListScreen));
    unawaited(Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ClinicalTrialFormScreen(
          api: api,
          args: const ClinicalTrialFormArgs.edit(trialId: 1234),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    await tester.enterText(
      _textFormFieldWithText('Route Trial'),
      'Changed Route Trial',
    );
    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Discard changes?'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Keep Editing'));
    await tester.pumpAndSettle();
    expect(find.text('Changed Route Trial'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Cancel'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Discard Changes'));
    await tester.pumpAndSettle();
    expect(updateCalls, 0);
    expect(find.text('Edit Trial'), findsNothing);
  });

  testWidgets(
      'supplemental criteria can be added and edited without replacing others',
      (tester) async {
    final storage = _storageWithCompany(id: 77);
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      if (request.url.path.endsWith('/getNextClinicalTrialId')) {
        return _jsonResponse({'status': 'OK', 'result': 1201});
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Add'));
    await tester.pumpAndSettle();

    Future<void> tapAddCriterion() async {
      final addCriterionButton =
          find.widgetWithText(OutlinedButton, 'Add criterion');
      await tester.scrollUntilVisible(
        addCriterionButton,
        350,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.ensureVisible(addCriterionButton);
      await tester.pumpAndSettle();
      await tester.tap(addCriterionButton);
      await tester.pumpAndSettle();
    }

    await tapAddCriterion();

    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.text('Criterion text is required.'), findsOneWidget);

    await tester.enterText(
      find.widgetWithText(TextField, 'Criterion').last,
      'eGFR must be at least 45',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Category').last,
      'Laboratory thresholds',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(find.textContaining('eGFR must be at least 45'), findsOneWidget);
    expect(find.text('User added'), findsOneWidget);

    await tapAddCriterion();
    await tester.enterText(
      find.widgetWithText(TextField, 'Criterion').last,
      ' eGFR   must be at least 45 ',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(
        find.text('This exact criterion is already listed.'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('Edit criterion'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Criterion').last,
      'eGFR must be at least 50',
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();

    expect(find.textContaining('eGFR must be at least 50'), findsOneWidget);
    expect(find.textContaining('eGFR must be at least 45'), findsNothing);

    await tapAddCriterion();
    await tester.enterText(
      find.widgetWithText(TextField, 'Criterion').last,
      'Cancelled criterion',
    );
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Cancelled criterion'), findsNothing);
  });

  testWidgets('supplemental criteria deletion requires confirmation',
      (tester) async {
    final storage = _storageWithCompany(id: 77);
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getDetailedClinicalTrialsList')) {
        return _jsonResponse({'status': 'OK', 'result': []});
      }
      if (request.url.path.endsWith('/getNextClinicalTrialId')) {
        return _jsonResponse({'status': 'OK', 'result': 1201});
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      ClinicalTrialApp(
        api: api,
        authController: AuthSessionController(storage: storage),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Add'));
    await tester.pumpAndSettle();

    Future<void> addCriterion(String criterion, String category) async {
      final addCriterionButton =
          find.widgetWithText(OutlinedButton, 'Add criterion');
      await tester.scrollUntilVisible(
        addCriterionButton,
        350,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(addCriterionButton);
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, 'Criterion').last,
        criterion,
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Category').last,
        category,
      );
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
    }

    await addCriterion('Keep beta blocker stable', 'Medication');
    await addCriterion('Delete temporary washout note', 'Washout');
    expect(find.textContaining('Keep beta blocker stable'), findsOneWidget);
    expect(
        find.textContaining('Delete temporary washout note'), findsOneWidget);

    await tester.tap(find.byTooltip('Edit criterion').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Delete'));
    await tester.pumpAndSettle();
    expect(find.text('Delete criterion?'), findsOneWidget);
    await tester.tap(find.widgetWithText(TextButton, 'Cancel').last);
    await tester.pumpAndSettle();
    expect(
        find.textContaining('Delete temporary washout note'), findsOneWidget);

    await tester.tap(find.byTooltip('Edit criterion').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Delete'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Delete temporary washout note'), findsNothing);
    expect(find.textContaining('Keep beta blocker stable'), findsOneWidget);
    expect(find.textContaining('Medication: Keep beta blocker stable'),
        findsOneWidget);

    await tester.tap(find.byTooltip('Edit criterion').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Delete'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();
    expect(
      find.text(
          'No supplemental criteria beyond the structured fields were found.'),
      findsOneWidget,
    );
  });

  group('Clinical trial document extraction lifecycle', () {
    testWidgets(
        'successful extraction closes progress, populates fields, and supports another upload',
        (tester) async {
      var extractionCalls = 0;
      var pickerCalls = 0;
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          extractionCalls += 1;
          return _jsonResponse({
            'status': 'OK',
            'result': _extractionResult(
              trialName: 'Extracted Trial $extractionCalls',
              criterion: 'Extracted criterion $extractionCalls',
            ),
          });
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async {
          pickerCalls += 1;
          return SelectedDocument(
            'trial-$pickerCalls.txt',
            Uint8List.fromList([1, 2, 3]),
          );
        },
      );

      await _tapUploadAndSettle(tester);

      expect(extractionCalls, 1);
      expect(find.text('Extracting Trial Fields'), findsNothing);
      expect(find.text('Document Extraction Complete'), findsNothing);
      expect(find.textContaining('Extracted fields from trial-1.txt'),
          findsOneWidget);
      expect(find.text('Extracted Trial 1'), findsOneWidget);
      await _scrollToSupplementalCriteria(tester);
      expect(find.textContaining('Extracted criterion 1'), findsOneWidget);

      await _tapUploadAndSettle(tester);

      expect(extractionCalls, 2);
      expect(find.text('Extracting Trial Fields'), findsNothing);
      await _scrollToTop(tester);
      expect(find.textContaining('Extracted fields from trial-2.txt'),
          findsOneWidget);
      expect(find.text('Extracted Trial 2'), findsOneWidget);
      await _scrollToSupplementalCriteria(tester);
      expect(find.textContaining('Extracted criterion 2'), findsOneWidget);
    });

    testWidgets('review labels and long source chips stay readable',
        (tester) async {
      const longCriterion =
          'Patients must have documented clinical stability on a multi-drug regimen for at least six months without recent dose escalation or therapy interruption';
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          return _jsonResponse({
            'status': 'OK',
            'result': {
              ..._extractionResult(criterion: longCriterion),
              'fieldsNeedingReview': ['bmiRange'],
            },
          });
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async => SelectedDocument(
          'long.txt',
          Uint8List.fromList([1, 2, 3]),
        ),
      );

      await _tapUploadAndSettle(tester);

      expect(find.textContaining('Needs review: BMI Range.'), findsOneWidget);
      await _scrollToSupplementalCriteria(tester);
      expect(find.textContaining(longCriterion), findsOneWidget);
      expect(find.text('Extracted'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('nested masking review key has readable label and local action',
        (tester) async {
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          return _jsonResponse({
            'status': 'OK',
            'result': {
              ..._extractionResult(),
              'fieldsNeedingReview': ['maskingDetails.investigator'],
            },
          });
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async => SelectedDocument(
          'masking.txt',
          Uint8List.fromList([1, 2, 3]),
        ),
      );

      await _tapUploadAndSettle(tester);

      expect(find.textContaining('Needs review: Mask Investigator.'),
          findsOneWidget);
      expect(find.textContaining('maskingDetails.investigator'), findsNothing);
      final formList = find.byType(ListView).last;
      for (var attempt = 0;
          attempt < 8 && find.text('Mask Investigator').evaluate().isEmpty;
          attempt++) {
        await tester.drag(formList, const Offset(0, -500));
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(find.text('Mask Investigator'), findsOneWidget);
      expect(find.widgetWithText(TextButton, 'Mark reviewed'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Mark reviewed'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Needs review: Mask Investigator.'),
          findsNothing);
    });

    testWidgets('failed extraction closes progress and shows failure state',
        (tester) async {
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          return http.Response(jsonEncode({'error': 'Extraction failed'}), 500);
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async => SelectedDocument(
          'bad.txt',
          Uint8List.fromList([1, 2, 3]),
        ),
      );

      await _tapUploadAndSettle(tester);

      expect(find.text('Extracting Trial Fields'), findsNothing);
      expect(find.text('Document Extraction Failed'), findsNothing);
      expect(find.text('Extraction failed'), findsOneWidget);
      expect(_uploadDocumentButtonFinder(), findsOneWidget);
      expect(_uploadDocumentButtonEnabled(tester), isTrue);
    });

    testWidgets('cancelled file selection leaves no dialog or loading state',
        (tester) async {
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async => null,
      );

      await tester.tap(_uploadDocumentButtonFinder());
      await tester.pumpAndSettle();

      expect(find.text('Extracting Trial Fields'), findsNothing);
      expect(find.textContaining('Extracted fields from'), findsNothing);
      expect(_uploadDocumentButtonEnabled(tester), isTrue);
    });

    testWidgets('cancel ignores delayed response and allows a second upload',
        (tester) async {
      final firstResponse = Completer<http.Response>();
      var extractionCalls = 0;
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          extractionCalls += 1;
          if (extractionCalls == 1) return firstResponse.future;
          return _jsonResponse({
            'status': 'OK',
            'result': _extractionResult(
              trialName: 'Second Extraction',
              criterion: 'Second criterion',
            ),
          });
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });
      var pickerCalls = 0;
      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async {
          pickerCalls += 1;
          return SelectedDocument(
            'trial-$pickerCalls.txt',
            Uint8List.fromList([1, 2, 3]),
          );
        },
      );
      expect(find.text('1201'), findsOneWidget);

      await tester.tap(_uploadDocumentButtonFinder());
      await tester.pump(const Duration(milliseconds: 2200));
      expect(find.text('Extracting Trial Fields'), findsOneWidget);
      expect(extractionCalls, 1);
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();
      expect(find.text('Extracting Trial Fields'), findsNothing);
      expect(find.text('1201'), findsOneWidget);

      firstResponse.complete(_jsonResponse({
        'status': 'OK',
        'result': _extractionResult(trialName: 'Cancelled Extraction'),
      }));
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Cancelled Extraction'), findsNothing);
      expect(find.textContaining('Extracted fields from trial-1.txt'),
          findsNothing);

      expect(extractionCalls, 1);
      expect(_uploadDocumentButtonEnabled(tester), isTrue);
    });

    testWidgets('cancel from create form closes only extraction dialog',
        (tester) async {
      final firstResponse = Completer<http.Response>();
      var extractionCalls = 0;
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          extractionCalls += 1;
          if (extractionCalls == 1) return firstResponse.future;
          return _jsonResponse({
            'status': 'OK',
            'result': _extractionResult(trialName: 'Second Create Extraction'),
          });
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });
      var pickerCalls = 0;

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Column(
                children: [
                  const Text('Trial List Sentinel'),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ClinicalTrialFormScreen(
                          api: api,
                          documentPicker: () async {
                            pickerCalls += 1;
                            return SelectedDocument(
                              'create-$pickerCalls.txt',
                              Uint8List.fromList([1, 2, 3]),
                            );
                          },
                        ),
                      ),
                    ),
                    child: const Text('Open Create'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.widgetWithText(FilledButton, 'Open Create'));
      await tester.pumpAndSettle();
      expect(find.text('Create Clinical Trial'), findsWidgets);
      expect(find.text('Trial List Sentinel'), findsNothing);
      expect(find.text('1201'), findsOneWidget);

      await tester.tap(_uploadDocumentButtonFinder());
      await tester.pump(const Duration(milliseconds: 2200));
      expect(extractionCalls, 1);
      expect(find.text('Extracting Trial Fields'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      expect(find.text('Create Clinical Trial'), findsWidgets);
      expect(find.text('Trial List Sentinel'), findsNothing);
      expect(find.text('1201'), findsOneWidget);
      expect(find.text('Extracting Trial Fields'), findsNothing);

      firstResponse.complete(_jsonResponse({
        'status': 'OK',
        'result': _extractionResult(trialName: 'Cancelled Create Extraction'),
      }));
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Cancelled Create Extraction'), findsNothing);
      expect(find.text('Trial List Sentinel'), findsNothing);

      await _tapUploadAndSettle(tester);
      expect(extractionCalls, 2);
      expect(find.textContaining('Extracted fields from create-2.txt'),
          findsOneWidget);
      expect(find.text('Create Clinical Trial'), findsWidgets);
      expect(find.text('Trial List Sentinel'), findsNothing);
    });

    testWidgets('cancel from edit form closes only extraction dialog',
        (tester) async {
      final extractionResponse = Completer<http.Response>();
      var updateCalls = 0;
      var extractionCalls = 0;
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getSpecificClinicalTrialsInfo')) {
          return _jsonResponse({
            'status': 'OK',
            'result': [_trialJson(1234)],
          });
        }
        if (request.url.path.endsWith('/semantic-criteria/1234')) {
          return _jsonResponse({'status': 'OK', 'result': null});
        }
        if (request.url.path.endsWith('/ranked-patients/1234')) {
          return _jsonResponse({
            'status': 'OK',
            'result': {'patients': []},
          });
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          extractionCalls += 1;
          return extractionResponse.future;
        }
        if (request.url.path.endsWith('/update-trial')) {
          updateCalls += 1;
          return _jsonResponse({'status': 'OK', 'result': {}});
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Column(
                children: [
                  const Text('Trial Detail Sentinel'),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ClinicalTrialFormScreen(
                          api: api,
                          args:
                              const ClinicalTrialFormArgs.edit(trialId: 1234),
                          documentPicker: () async => SelectedDocument(
                            'edit.txt',
                            Uint8List.fromList([1, 2, 3]),
                          ),
                        ),
                      ),
                    ),
                    child: const Text('Open Edit'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.widgetWithText(FilledButton, 'Open Edit'));
      await tester.pumpAndSettle();
      expect(find.text('Edit Trial'), findsWidgets);
      expect(find.text('Route Trial'), findsOneWidget);
      expect(find.text('Trial Detail Sentinel'), findsNothing);

      await tester.tap(_uploadDocumentButtonFinder());
      await tester.pump(const Duration(milliseconds: 2200));
      expect(extractionCalls, 1);
      expect(find.text('Extracting Trial Fields'), findsOneWidget);
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      expect(find.text('Edit Trial'), findsWidgets);
      expect(find.text('Route Trial'), findsOneWidget);
      expect(find.text('Trial Detail Sentinel'), findsNothing);
      expect(find.text('Discard changes?'), findsNothing);
      expect(updateCalls, 0);

      extractionResponse.complete(_jsonResponse({
        'status': 'OK',
        'result': _extractionResult(trialName: 'Cancelled Edit Extraction'),
      }));
      await tester.pump(const Duration(seconds: 3));
      expect(find.text('Cancelled Edit Extraction'), findsNothing);
      expect(find.text('Route Trial'), findsOneWidget);
      expect(find.text('Trial Detail Sentinel'), findsNothing);
      expect(updateCalls, 0);
    });

    testWidgets('disposal during extraction does not report widget errors',
        (tester) async {
      final previousOnError = FlutterError.onError;
      final flutterErrors = <FlutterErrorDetails>[];
      FlutterError.onError = flutterErrors.add;
      addTearDown(() => FlutterError.onError = previousOnError);

      final extractionCompleter = Completer<http.Response>();
      final api = _apiWithHandler((request) async {
        if (request.url.path.endsWith('/getNextClinicalTrialId')) {
          return _jsonResponse({'status': 'OK', 'result': 1201});
        }
        if (request.url.path.endsWith('/extract-trial-fields')) {
          return extractionCompleter.future;
        }
        throw StateError(
            'Unexpected request: ${request.method} ${request.url}');
      });

      await _pumpCreateTrialForm(
        tester,
        api: api,
        documentPicker: () async => SelectedDocument(
          'slow.txt',
          Uint8List.fromList([1, 2, 3]),
        ),
      );

      await tester.tap(_uploadDocumentButtonFinder());
      await tester.pump(const Duration(milliseconds: 1200));
      expect(find.text('Extracting Trial Fields'), findsOneWidget);

      await tester.pumpWidget(const MaterialApp(home: SizedBox.shrink()));
      extractionCompleter.complete(_jsonResponse({
        'status': 'OK',
        'result': _extractionResult(),
      }));
      await tester.pump(const Duration(seconds: 3));

      expect(
        flutterErrors.where(
          (details) =>
              details
                  .exceptionAsString()
                  .contains('setState() called after dispose') ||
              details
                  .exceptionAsString()
                  .contains('Looking up a deactivated widget'),
        ),
        isEmpty,
      );
    });
  });

  testWidgets('matching actions expose next/all modes and remove demo control',
      (tester) async {
    Map<String, dynamic>? rankedBody;
    final api = _apiWithHandler((request) async {
      if (request.url.path.endsWith('/getSpecificClinicalTrialsInfo')) {
        return _jsonResponse({
          'status': 'OK',
          'result': [_trialJson(1234)],
        });
      }
      if (request.url.path.endsWith('/ranked-patients/1234')) {
        return _jsonResponse({
          'status': 'OK',
          'result': {'patients': []},
        });
      }
      if (request.url.path.endsWith('/semantic-criteria/1234')) {
        return _jsonResponse({
          'status': 'OK',
          'result': {'criteria_json': {}, 'summary': 'Ready'},
        });
      }
      if (request.url.path.endsWith('/deterministic-match')) {
        return _jsonResponse({
          'status': 'OK',
          'result': {
            'patients': [
              for (var id = 1; id <= 12; id++) {'patientId': id}
            ],
          },
        });
      }
      if (request.url.path.endsWith('/ranked-patients') &&
          request.method == 'POST') {
        rankedBody = _requestJson(request);
        return _jsonResponse({
          'status': 'OK',
          'result': {
            'patientIds': [1, 2, 3],
            'patients': [
              {'patientId': 1, 'patientName': 'A', 'score': 90}
            ],
            'requestedCount': 12,
            'matchedCount': 1,
            'skippedCount': 0,
            'failedCount': 0,
          },
        });
      }
      throw StateError('Unexpected request: ${request.method} ${request.url}');
    });

    await tester.pumpWidget(
      MaterialApp(
        home: ClinicalTrialDetailScreen(
          api: api,
          args: ClinicalTrialDetailArgs(1234),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Rank 5 Patients (Demo)'), findsNothing);
    expect(find.text('Match Patients'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Match Patients'));
    await tester.pumpAndSettle();
    expect(find.text('Match Next 10 Patients'), findsOneWidget);
    expect(find.text('Match All Patients'), findsOneWidget);

    await tester.tap(find.text('Match All Patients'));
    await tester.pumpAndSettle();
    expect(find.text('Match all 12 remaining patients?'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Match All Patients'));
    await tester.pump(const Duration(seconds: 2));
    expect(rankedBody?['mode'], 'all');
    expect(rankedBody?.containsKey('limit'), isFalse);
    expect(rankedBody?.containsKey('excludePatientIds'), isFalse);
  });
}

ApiService _apiWithHandler(
  Future<http.Response> Function(http.Request request) handler,
) {
  return ApiService(client: MockClient(handler));
}

http.Response _jsonResponse(Map<String, dynamic> body) {
  return http.Response(jsonEncode(body), 200);
}

Map<String, dynamic> _requestJson(http.Request request) {
  return Map<String, dynamic>.from(jsonDecode(request.body) as Map);
}

LoginStorage _storageWithCompany({required int id}) {
  final storage = createLoginStorage();
  storage.writeSession(
    AuthSessionController.storageKey,
    jsonEncode({
      'type': 'Pharma',
      'id': id,
      'name': 'Standalone Pharma',
      'email': 'pharm1@test.com',
    }),
  );
  return storage;
}

Future<void> _pumpCreateTrialForm(
  WidgetTester tester, {
  required ApiService api,
  required DocumentPicker documentPicker,
}) async {
  tester.view.physicalSize = const Size(1200, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      home: ClinicalTrialFormScreen(
        api: api,
        documentPicker: documentPicker,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _tapUploadAndSettle(WidgetTester tester) async {
  await tester.tap(_uploadDocumentButtonFinder());
  await tester.pump();
  await tester.pump(const Duration(seconds: 5));
  await tester.pump(const Duration(milliseconds: 100));
}

Finder _uploadDocumentButtonFinder() {
  final compactButton = find.byTooltip('Upload Document');
  final wideButton = find.widgetWithText(FilledButton, 'Upload Document');
  return compactButton.evaluate().isNotEmpty ? compactButton : wideButton;
}

bool _uploadDocumentButtonEnabled(WidgetTester tester) {
  final finder = _uploadDocumentButtonFinder();
  final widget = tester.widget(finder);
  return switch (widget) {
    IconButton(:final onPressed) => onPressed != null,
    FilledButton(:final onPressed) => onPressed != null,
    _ => false,
  };
}

Future<void> _scrollToSupplementalCriteria(WidgetTester tester) async {
  final header = find.text(
    'Additional Trial / Criteria Information Not Captured by the Base Form',
  );
  final formList = find.byType(ListView).last;
  for (var attempt = 0; attempt < 8 && header.evaluate().isEmpty; attempt++) {
    await tester.drag(formList, const Offset(0, -500));
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(header, findsOneWidget);
  await tester.pump(const Duration(milliseconds: 100));
}

Future<void> _scrollToTop(WidgetTester tester) async {
  final formList = find.byType(ListView).last;
  for (var attempt = 0;
      attempt < 8 && find.text('Contact Information').evaluate().isEmpty;
      attempt++) {
    await tester.drag(formList, const Offset(0, 500));
    await tester.pump(const Duration(milliseconds: 100));
  }
}

Finder _textFormFieldWithText(String text) {
  return find.byWidgetPredicate(
    (widget) => widget is TextFormField && widget.controller?.text == text,
    description: 'TextFormField with text "$text"',
  );
}

Map<String, dynamic> _extractionResult({
  String trialName = 'Extracted Trial',
  String criterion = 'Must have documented measurable disease',
}) {
  return {
    'extractedFields': {
      'trialName': trialName,
      'officialTitle': '$trialName Official Title',
      'briefSummary': 'A trial summary from the document.',
      'detailedDescription': 'Detailed extracted trial description.',
      'startDate': '2026-01-01',
      'endDate': '2026-12-31',
      'sponsor': 'Standalone Pharma',
      'principalInvestigator': 'Dr. Extractor',
      'ethicsApproval': 'Approved',
      'relatedConditions': 'Asthma',
      'priorMedications': 'None',
      'pathology': 'Asthma',
      'diseases': 'None',
      'surgeries': 'None',
      'location': 'Ontario, Canada',
      'ageRange': '18-65',
      'bmiRange': '18-30',
      'primaryPurpose': 'Treatment',
      'trialPhase': 'Not Applicable',
      'studyType': 'Interventional',
      'allocation': 'N/A',
      'interventionModel': 'N/A',
      'masking': 'None (Open Label)',
      'maskingDetails': null,
      'gender': 'Both',
      'pregnancy': 'Unrestricted',
    },
    'missingRequiredFields': const <String>[],
    'fieldsNeedingReview': const <String>[],
    'supplementalCriteria': {
      'summary': 'Supplemental criteria summary.',
      'additionalTrialInformation': [
        {
          'category': 'Eligibility',
          'criterion': criterion,
          'sourceText': criterion,
          'relevance': 'High',
          'notes': 'Extracted note',
        },
      ],
      'missingOrAmbiguousCriteria': const <String>[],
    },
  };
}

Map<String, dynamic> _trialJson(
  int trialId, {
  String? name,
  String? sponsor,
  String? status,
}) {
  return {
    'trial_id': trialId,
    'trial_name': name ?? 'Route Trial',
    'trial_status': status ?? 'Under Review',
    'contact_first_name': 'Ada',
    'contact_middle_name': '',
    'contact_last_name': 'Lovelace',
    'contact_area_code': '416',
    'contact_phone_number': '5550100',
    'contact_email': 'ada@example.com',
    'official_title': 'Route Trial Official Title',
    'brief_summary': 'Brief summary',
    'detailed_description': 'Detailed description',
    'start_date': '2026-01-01',
    'end_date': '2026-02-01',
    'primary_purpose': 'Treatment',
    'trial_phase': 'Not Applicable',
    'study_type': 'Interventional',
    'allocation': 'N/A',
    'intervention_model': 'N/A',
    'masking': 'None (Open Label)',
    'gender': 'Both',
    'locations': 'Ontario, Canada',
    'sponsor': sponsor ?? 'Standalone Pharma',
    'principal_investigator': 'Dr. Ada Lovelace',
    'ethics_approval': 'Approved',
    'related_conditions': 'Asthma',
    'pathology': 'Asthma',
    'age_range': '18-65',
    'exclusion_criteria': jsonEncode({
      'BMI': '18-30',
      'Diseases': 'None',
      'Surgeries': 'None',
      'PriorMedications': 'None',
      'Pregnancy': 'Unrestricted',
    }),
  };
}
