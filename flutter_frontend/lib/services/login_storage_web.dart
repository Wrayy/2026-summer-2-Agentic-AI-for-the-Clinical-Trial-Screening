import 'package:web/web.dart' as web;

class LoginStorage {
  String? readSession(String key) => web.window.sessionStorage.getItem(key);

  String? readLocal(String key) => web.window.localStorage.getItem(key);

  void writeSession(String key, String value) {
    web.window.sessionStorage.setItem(key, value);
  }

  void writeLocal(String key, String value) {
    web.window.localStorage.setItem(key, value);
  }

  void clearSession(String key) {
    web.window.sessionStorage.removeItem(key);
  }

  void clearLocal(String key) {
    web.window.localStorage.removeItem(key);
  }
}

LoginStorage createLoginStorage() => LoginStorage();
