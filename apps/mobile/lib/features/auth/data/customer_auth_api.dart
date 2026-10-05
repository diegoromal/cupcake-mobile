import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

enum AuthRequestStatus {
  success,
  invalidCredentials,
  invalidRequest,
  unavailable,
  notConfigured,
  invalidToken,
}

class CustomerTokens {
  const CustomerTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  static CustomerTokens? parseLogin(Object? body) {
    if (body is! Map<String, dynamic> ||
        body.length != 2 ||
        body.keys.toSet().difference({
          'accessToken',
          'refreshToken',
        }).isNotEmpty) {
      return null;
    }
    final access = _parseJwt(body['accessToken'], expectedType: 'access');
    final refresh = _parseJwt(body['refreshToken'], expectedType: 'refresh');
    if (access == null ||
        refresh == null ||
        access.subject != refresh.subject) {
      return null;
    }
    return CustomerTokens(
      accessToken: body['accessToken'] as String,
      refreshToken: body['refreshToken'] as String,
    );
  }

  CustomerTokens? withAccessToken(Object? value) {
    final access = _parseJwt(value, expectedType: 'access');
    final refresh = _parseJwt(refreshToken, expectedType: 'refresh');
    if (access == null ||
        refresh == null ||
        access.subject != refresh.subject) {
      return null;
    }
    return CustomerTokens(
      accessToken: value as String,
      refreshToken: refreshToken,
    );
  }

  bool get hasRecoverableRefresh =>
      _parseJwt(refreshToken, expectedType: 'refresh') != null;

  static bool isCustomerAccessToken(String token) =>
      _parseJwt(token, expectedType: 'access') != null;

  bool get accessNeedsRefresh => accessNeedsRefreshAt(DateTime.now());

  bool accessNeedsRefreshAt(DateTime now) {
    final claims = _parseJwt(accessToken, expectedType: 'access');
    return claims == null ||
        claims.expiresAt <= now.millisecondsSinceEpoch ~/ 1000 + 60;
  }

  Duration timeUntilAccessRefreshAt(DateTime now) {
    final claims = _parseJwt(
      accessToken,
      expectedType: 'access',
      allowExpired: true,
    );
    if (claims == null) return Duration.zero;
    final seconds = claims.expiresAt - now.millisecondsSinceEpoch ~/ 1000 - 60;
    return Duration(seconds: seconds > 0 ? seconds : 0);
  }

  Duration timeUntilAccessExpiryAt(DateTime now) {
    final claims = _parseJwt(
      accessToken,
      expectedType: 'access',
      allowExpired: true,
    );
    if (claims == null) return Duration.zero;
    final seconds = claims.expiresAt - now.millisecondsSinceEpoch ~/ 1000;
    return Duration(seconds: seconds > 0 ? seconds : 0);
  }

  Map<String, String> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
  };

  static CustomerTokens? fromJson(Object? value) {
    if (value is! Map<String, dynamic> || value.length != 2) return null;
    final accessToken = value['accessToken'];
    final refreshToken = value['refreshToken'];
    if (accessToken is! String || refreshToken is! String) return null;
    final access = _parseJwt(
      accessToken,
      expectedType: 'access',
      allowExpired: true,
    );
    final refresh = _parseJwt(refreshToken, expectedType: 'refresh');
    if (access == null ||
        refresh == null ||
        access.subject != refresh.subject) {
      return null;
    }
    return CustomerTokens(accessToken: accessToken, refreshToken: refreshToken);
  }
}

class AuthRequestResult {
  const AuthRequestResult(this.status, {this.tokens, this.accessToken});

  final AuthRequestStatus status;
  final CustomerTokens? tokens;
  final String? accessToken;
}

class CustomerAuthApi {
  CustomerAuthApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async {
    final uri = _config.customerLoginUri;
    if (uri == null) {
      return const AuthRequestResult(AuthRequestStatus.notConfigured);
    }
    return _post(uri, {
      'email': email.trim().toLowerCase(),
      'senha': password,
    }, login: true);
  }

  Future<AuthRequestResult> refresh(String refreshToken) async {
    final uri = _config.refreshUri;
    if (uri == null) {
      return const AuthRequestResult(AuthRequestStatus.notConfigured);
    }
    return _post(uri, {'refreshToken': refreshToken}, login: false);
  }

  Future<AuthRequestResult> _post(
    Uri uri,
    Map<String, String> body, {
    required bool login,
  }) async {
    final client = _clientFactory();
    try {
      return await _send(client, uri, body, login: login).timeout(timeout);
    } on Object {
      return const AuthRequestResult(AuthRequestStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }

  Future<AuthRequestResult> _send(
    HttpClient client,
    Uri uri,
    Map<String, String> body, {
    required bool login,
  }) async {
    final request = await client.postUrl(uri);
    request.followRedirects = false;
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(body));
    final response = await request.close();
    if (response.statusCode == HttpStatus.unauthorized) {
      return AuthRequestResult(
        login
            ? AuthRequestStatus.invalidCredentials
            : AuthRequestStatus.invalidToken,
      );
    }
    if (response.statusCode == HttpStatus.badRequest) {
      return const AuthRequestResult(AuthRequestStatus.invalidRequest);
    }
    if (response.statusCode != HttpStatus.ok) {
      return const AuthRequestResult(AuthRequestStatus.unavailable);
    }

    String responseBody;
    try {
      responseBody = await response.transform(utf8.decoder).join();
    } on Object {
      return const AuthRequestResult(AuthRequestStatus.unavailable);
    }

    Object? decoded;
    try {
      decoded = jsonDecode(responseBody);
    } on FormatException {
      return const AuthRequestResult(AuthRequestStatus.unavailable);
    }
    if (login) {
      final tokens = CustomerTokens.parseLogin(decoded);
      return tokens == null
          ? const AuthRequestResult(AuthRequestStatus.invalidToken)
          : AuthRequestResult(AuthRequestStatus.success, tokens: tokens);
    }
    if (decoded is! Map<String, dynamic> || decoded.length != 1) {
      return const AuthRequestResult(AuthRequestStatus.invalidToken);
    }
    final access = decoded['accessToken'];
    return access is String && CustomerTokens.isCustomerAccessToken(access)
        ? AuthRequestResult(AuthRequestStatus.success, accessToken: access)
        : const AuthRequestResult(AuthRequestStatus.invalidToken);
  }
}

class _JwtClaims {
  const _JwtClaims(this.subject, this.expiresAt);

  final String subject;
  final int expiresAt;
}

_JwtClaims? _parseJwt(
  Object? token, {
  required String expectedType,
  bool allowExpired = false,
}) {
  if (token is! String) return null;
  final parts = token.split('.');
  if (parts.length != 3 || parts.any((part) => part.isEmpty)) return null;
  try {
    final decoded = jsonDecode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    );
    if (decoded is! Map<String, dynamic> ||
        decoded['type'] != expectedType ||
        decoded['perfil'] != 'CLIENTE' ||
        decoded['sub'] is! String ||
        !_isUuid(decoded['sub'] as String) ||
        decoded['iat'] is! int ||
        decoded['exp'] is! int ||
        (decoded['iat'] as int) >
            DateTime.now().millisecondsSinceEpoch ~/ 1000 + 60 ||
        (decoded['exp'] as int) <= (decoded['iat'] as int) ||
        (!allowExpired &&
            (decoded['exp'] as int) <=
                DateTime.now().millisecondsSinceEpoch ~/ 1000)) {
      return null;
    }
    return _JwtClaims(decoded['sub'] as String, decoded['exp'] as int);
  } on Object {
    return null;
  }
}

bool _isUuid(String value) => RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
).hasMatch(value);
