import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../models/clinical_trial.dart';
import '../models/matching_criteria.dart';
import '../models/patient.dart';
import 'auth_session.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ApiService {
  ApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  PharmaCompanySession? _company;

  Uri _url(String path) => Uri.parse('${ApiConfig.baseUrl}/api/users/$path');
  Uri _pocUrl(String path) =>
      Uri.parse('${ApiConfig.baseUrl}/api/clinical-trial-poc/$path');

  PharmaCompanySession? get activeCompany => _company;
  String get companyName => _company?.name ?? 'Pharmaceutical Office';

  void setCompanyContext(PharmaCompanySession? company) {
    _company = company;
  }

  void clearCompanyContext() {
    _company = null;
  }

  PharmaCompanySession _requireCompany() {
    final company = _company;
    if (company == null) {
      throw ApiException('Sign in with a Pharmaceutical Office account.');
    }
    return company;
  }

  Future<dynamic> _post(
    String path,
    Map<String, dynamic> body, {
    bool emptyOn404 = false,
  }) async {
    final response = await _client.post(
      _url(path),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (response.statusCode == 404 && emptyOn404) return <dynamic>[];
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    if (decoded is Map && decoded.containsKey('result')) {
      return decoded['result'];
    }
    return decoded;
  }

  Future<PharmaCompanySession> loginPharmaceuticalOffice({
    required String email,
    required String password,
  }) async {
    final response = await _client.post(
      _url('login'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
        'selectedOption': 'Pharma',
      }),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException('Incorrect email or password.');
    }
    if (decoded is! Map) {
      throw ApiException('Login returned an invalid response.');
    }
    final company = PharmaCompanySession.fromLoginResponse(decoded);
    if (company == null) {
      throw ApiException('Login returned an incomplete company profile.');
    }
    return company;
  }

  Future<List<ClinicalTrial>> getDetailedClinicalTrials() async {
    final company = _requireCompany();
    final result = await _post(
      'getDetailedClinicalTrialsList',
      {'companyId': company.id},
    );
    return _listOfMaps(result).map(ClinicalTrial.fromJson).toList();
  }

  Future<List<ClinicalTrial>> getClinicalTrials() async {
    final company = _requireCompany();
    final result = await _post(
      'getClinicalTrialsList',
      {'companyId': company.id},
    );
    return _listOfMaps(result).map(ClinicalTrial.fromJson).toList();
  }

  Future<bool> checkTrialIdExists(String trialId) async {
    final result = await _post('checkExistingClinicalTrialsId', {
      'trialId': trialId,
    });
    return result == true;
  }

  Future<int> getNextClinicalTrialId() async {
    final result = await _post('getNextClinicalTrialId', {});
    if (result is num) return result.toInt();
    return int.parse(result.toString());
  }

  Future<void> createClinicalTrial(Map<String, dynamic> formData) async {
    final company = _requireCompany();
    await _post('createNewClinicalTrials', {
      'formDataToSubmit': formData,
      'companyInfo': company.toJson(),
    });
  }

  Future<Map<String, dynamic>> updateClinicalTrial(
    Map<String, dynamic> formData, {
    Map<String, dynamic>? semanticCriteria,
  }) async {
    final company = _requireCompany();
    final response = await _client.post(
      _pocUrl('update-trial'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'formDataToSubmit': formData,
        'companyInfo': company.toJson(),
        if (semanticCriteria != null) 'semanticCriteria': semanticCriteria,
      }),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    if (result is! Map) {
      throw ApiException('Clinical trial update returned an invalid response.');
    }
    return Map<String, dynamic>.from(result);
  }

  Future<void> updateClinicalTrialStatus({
    required int trialId,
    required int status,
  }) async {
    await _post('updateClinicalTrialStatus', {
      'trialId': trialId,
      'status': status,
    });
  }

  Future<Map<String, dynamic>> extractTrialFields({
    required String filename,
    required Uint8List bytes,
  }) async {
    final request = http.MultipartRequest(
      'POST',
      _pocUrl('extract-trial-fields'),
    );
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: filename,
      ),
    );

    final streamedResponse = await _client.send(request);
    final response = await http.Response.fromStream(streamedResponse);
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    if (result is! Map) {
      throw ApiException('Document extraction returned an invalid response.');
    }
    return Map<String, dynamic>.from(result);
  }

  Future<Map<String, dynamic>> extractManualSupplementalCriteria(
    Map<String, dynamic> formData,
  ) async {
    final response = await _client.post(
      _pocUrl('extract-manual-supplemental-criteria'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'formData': formData}),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    if (result is! Map) {
      throw ApiException(
        'Manual supplemental criteria extraction returned an invalid response.',
      );
    }
    return Map<String, dynamic>.from(result);
  }

  Future<void> saveSemanticCriteria({
    required String trialId,
    required List<Map<String, dynamic>> additionalTrialInformation,
    required String summary,
    required List<String> missingOrAmbiguousCriteria,
    String? sourceType,
  }) async {
    final response = await _client.post(
      _pocUrl('save-semantic-criteria'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'trialId': trialId,
        'additionalTrialInformation': additionalTrialInformation,
        'summary': summary,
        'missingOrAmbiguousCriteria': missingOrAmbiguousCriteria,
        if (sourceType != null) 'sourceType': sourceType,
      }),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
  }

  Future<Map<String, dynamic>> getDeterministicMatch(int trialId) async {
    final response = await _client.post(
      _pocUrl('deterministic-match'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'trialId': trialId}),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    if (result is! Map) {
      throw ApiException('Deterministic match returned an invalid response.');
    }
    return Map<String, dynamic>.from(result);
  }

  Future<Map<String, dynamic>?> getSemanticCriteria(int trialId) async {
    final response = await _client.get(
      _pocUrl('semantic-criteria/$trialId'),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    return result is Map ? Map<String, dynamic>.from(result) : null;
  }

  Future<Map<String, dynamic>> getRankedPatients(
    int trialId, {
    List<int> patientIds = const [],
    String? mode,
  }) async {
    final response = await _client.post(
      _pocUrl('ranked-patients'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({
        'trialId': trialId,
        if (patientIds.isNotEmpty) 'patientIds': patientIds,
        if (mode != null) 'mode': mode,
      }),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    if (result is! Map) {
      throw ApiException('Ranked patients returned an invalid response.');
    }
    return Map<String, dynamic>.from(result);
  }

  Future<Map<String, dynamic>> getStoredRankedPatients(int trialId) async {
    final response = await _client.get(_pocUrl('ranked-patients/$trialId'));
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
    final result = decoded is Map ? decoded['result'] : null;
    if (result is! Map) {
      throw ApiException(
          'Stored ranked patients returned an invalid response.');
    }
    return Map<String, dynamic>.from(result);
  }

  Future<void> deleteClinicalTrial(int trialId) async {
    final response = await _client.post(
      _pocUrl('delete-trial'),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'trialId': trialId}),
    );
    final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded is Map
          ? decoded['error'] ?? decoded['message'] ?? response.body
          : response.body;
      throw ApiException(message.toString());
    }
  }

  Future<ClinicalTrial> getSpecificClinicalTrial(int trialId) async {
    final result = await _post('getSpecificClinicalTrialsInfo', {
      'trial_id': trialId,
    });
    final trials = _listOfMaps(result);
    if (trials.isEmpty) throw ApiException('Clinical trial was not found.');
    return ClinicalTrial.fromJson(trials.first);
  }

  Future<List<MatchedPatient>> getMatchedPatients(
    MatchingCriteria criteria,
  ) async {
    final result = await _post('getSpecificClinicalTrialsMatchedPatients', {
      'criteria': criteria.enabled,
      'criteriaValues': criteria.requestValues,
    });
    return _listOfMaps(result).map(MatchedPatient.fromJson).toList();
  }

  Future<PatientProfile> getPatientProfile(int patientId) async {
    final result = await _post('PharmaceuticalsViewPatientProfile', {
      'patientId': patientId,
      'viewMode': 0,
    });
    return PatientProfile.fromJson(Map<String, dynamic>.from(result as Map));
  }

  Future<bool> checkExistingInvite(int trialId, int patientId) async {
    final result = await _post('checkExistingActions', {
      'trialId': trialId,
      'receivedUserId': patientId,
      'actionType': 1,
      'isCompleted': false,
    });
    return result is Map ? result['exists'] == true : result == true;
  }

  Future<int> createInviteAction(int trialId) async {
    final company = _requireCompany();
    final result = await _post('PharmaceuticalsActionCreate', {
      'trialId': trialId,
      'initiatorType': 0,
      'initiatorId': company.id,
    });
    if (result is int) return result;
    return int.tryParse(result.toString()) ?? 0;
  }

  Future<void> createInviteRequest({
    required int actionId,
    required int receivedUserType,
    required int receivedUserId,
    required String inviteMessage,
    required bool isPrimaryRequest,
  }) async {
    await _post('PharmaceuticalsRequestCreate', {
      'actionId': actionId,
      'receivedUserType': receivedUserType,
      'receivedUserId': receivedUserId,
      'inviteMessage': inviteMessage,
      'isPrimaryRequest': isPrimaryRequest,
    });
  }
}

List<Map<String, dynamic>> _listOfMaps(dynamic result) {
  if (result is! List) return const [];
  return result.whereType<Map>().map(Map<String, dynamic>.from).toList();
}
