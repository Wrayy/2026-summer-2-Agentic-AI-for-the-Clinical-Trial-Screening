class LoginStorage {
  final Map<String, String> _session = {};
  final Map<String, String> _local = {};

  String? readSession(String key) => _session[key];

  String? readLocal(String key) => _local[key];

  void writeSession(String key, String value) {
    _session[key] = value;
  }

  void writeLocal(String key, String value) {
    _local[key] = value;
  }

  void clearSession(String key) {
    _session.remove(key);
  }

  void clearLocal(String key) {
    _local.remove(key);
  }
}

LoginStorage createLoginStorage() => LoginStorage();
