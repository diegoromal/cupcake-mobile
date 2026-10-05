import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig({String? baseUrl}) : _baseUrl = baseUrl ?? _configuredBaseUrl;

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  final String _baseUrl;

  Uri? get usersUri {
    final baseUri = _validBaseUri;
    return baseUri?.resolve('/users');
  }

  Uri? get customerLoginUri => _validBaseUri?.resolve('/auth/login');

  Uri? get refreshUri => _validBaseUri?.resolve('/auth/refresh');

  Uri? get _validBaseUri {
    final value = _baseUrl.trim();
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        (uri.scheme != 'https' && uri.scheme != 'http') ||
        (uri.scheme == 'http' &&
            (!kDebugMode ||
                !const {'localhost', '127.0.0.1', '::1'}.contains(uri.host))) ||
        uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      return null;
    }
    return uri;
  }
}
