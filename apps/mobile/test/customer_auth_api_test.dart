import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:flutter_test/flutter_test.dart';

const _id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

String _token(String type, {String profile = 'CLIENTE', int? expiry}) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  final issuedAt = expiry != null && expiry < now ? expiry - 3600 : now;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _id, 'perfil': profile, 'type': type, 'iat': issuedAt, 'exp': expiry ?? now + 3600})}.signature';
}

Future<HttpServer> _server(Future<void> Function(HttpRequest) handler) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen(handler);
  return server;
}

CustomerAuthApi _api(HttpServer server) => CustomerAuthApi(
  config: ApiConfig(baseUrl: 'http://${server.address.address}:${server.port}'),
  timeout: const Duration(seconds: 2),
);

void main() {
  test(
    'login envia contrato exato, normaliza email e preserva senha',
    () async {
      Map<String, dynamic>? payload;
      final server = await _server((request) async {
        expect(request.method, 'POST');
        expect(request.uri.path, '/auth/login');
        expect(request.headers.contentType?.mimeType, 'application/json');
        expect(request.headers.value(HttpHeaders.authorizationHeader), isNull);
        payload =
            jsonDecode(await utf8.decoder.bind(request).join())
                as Map<String, dynamic>;
        request.response
          ..statusCode = 200
          ..write(
            jsonEncode({
              'accessToken': _token('access'),
              'refreshToken': _token('refresh'),
            }),
          );
        await request.response.close();
      });
      addTearDown(server.close);

      final result = await _api(
        server,
      ).login(email: ' ANA@EXAMPLE.COM ', password: ' senha literal ');
      expect(result.status, AuthRequestStatus.success);
      expect(result.tokens, isNotNull);
      expect(payload, {'email': 'ana@example.com', 'senha': ' senha literal '});
    },
  );

  test('refresh envia refreshToken e aceita somente o access novo', () async {
    final previousRefresh = _token('refresh');
    Map<String, dynamic>? payload;
    final server = await _server((request) async {
      expect(request.uri.path, '/auth/refresh');
      payload =
          jsonDecode(await utf8.decoder.bind(request).join())
              as Map<String, dynamic>;
      request.response
        ..statusCode = 200
        ..write(jsonEncode({'accessToken': _token('access')}));
      await request.response.close();
    });
    addTearDown(server.close);

    final result = await _api(server).refresh(previousRefresh);
    expect(result.status, AuthRequestStatus.success);
    expect(result.accessToken, isNotNull);
    expect(payload, {'refreshToken': previousRefresh});
  });

  test('mapeia 400, 401 e erro de servidor sem expor body', () async {
    var status = 401;
    final server = await _server((request) async {
      request.response
        ..statusCode = status
        ..write('{"message":"detalhe interno"}');
      await request.response.close();
    });
    addTearDown(server.close);
    final api = _api(server);

    expect(
      (await api.login(email: 'a@b.com', password: 'x')).status,
      AuthRequestStatus.invalidCredentials,
    );
    status = 400;
    expect(
      (await api.login(email: 'a@b.com', password: 'x')).status,
      AuthRequestStatus.invalidRequest,
    );
    status = 500;
    expect(
      (await api.login(email: 'a@b.com', password: 'x')).status,
      AuthRequestStatus.unavailable,
    );
  });

  test('rejeita token com perfil diferente e resposta malformada', () async {
    var response = {
      'accessToken': _token('access', profile: 'ADMIN'),
      'refreshToken': _token('refresh', profile: 'ADMIN'),
    };
    final server = await _server((request) async {
      request.response
        ..statusCode = 200
        ..write(jsonEncode(response));
      await request.response.close();
    });
    addTearDown(server.close);
    final api = _api(server);

    expect(
      (await api.login(email: 'a@b.com', password: 'x')).status,
      AuthRequestStatus.invalidToken,
    );
    response = {
      'accessToken': _token('access'),
      'refreshToken': _token('refresh'),
      'user': 'unexpected',
    };
    expect(
      (await api.login(email: 'a@b.com', password: 'x')).status,
      AuthRequestStatus.invalidToken,
    );
  });

  test('URL não configurada não inicia request', () async {
    final result = await CustomerAuthApi(
      config: ApiConfig(baseUrl: ''),
    ).login(email: 'a@b.com', password: 'x');
    expect(result.status, AuthRequestStatus.notConfigured);
  });

  test('tokens persistidos aceitam access expirado somente para refresh', () {
    final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final expiredAccess = _token('access', expiry: now - 1);
    final validRefresh = _token('refresh', expiry: now + 3600);
    final stored = CustomerTokens.fromJson({
      'accessToken': expiredAccess,
      'refreshToken': validRefresh,
    });
    expect(stored, isNotNull);
    expect(stored!.accessNeedsRefresh, isTrue);
    expect(stored.withAccessToken(_token('access')), isNotNull);
    expect(
      CustomerTokens.fromJson({
        'accessToken': expiredAccess,
        'refreshToken': _token('refresh', expiry: now - 1),
      }),
      isNull,
    );
  });
}
