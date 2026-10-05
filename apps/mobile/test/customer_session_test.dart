import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

String _token(String type, {int? expiry}) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  final issuedAt = expiry != null && expiry < now ? expiry - 3600 : now;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _id, 'perfil': 'CLIENTE', 'type': type, 'iat': issuedAt, 'exp': expiry ?? now + 3600})}.signature';
}

CustomerTokens _tokens({int? accessExpiry, int? refreshExpiry}) =>
    CustomerTokens(
      accessToken: _token('access', expiry: accessExpiry),
      refreshToken: _token('refresh', expiry: refreshExpiry),
    );

Future<HttpServer> _server(Future<void> Function(HttpRequest) handler) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen(handler);
  return server;
}

CustomerSession _session(HttpServer server, MemorySessionStorage storage) =>
    CustomerSession(
      authApi: CustomerAuthApi(
        config: ApiConfig(
          baseUrl: 'http://${server.address.address}:${server.port}',
        ),
        timeout: const Duration(seconds: 2),
      ),
      storage: storage,
    );

void main() {
  test('sem credenciais inicia o fluxo público sem chamar refresh', () async {
    var requests = 0;
    final server = await _server((request) async {
      requests++;
      await request.response.close();
    });
    addTearDown(server.close);
    final session = _session(server, MemorySessionStorage());
    addTearDown(session.dispose);

    await session.restore();
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isFalse);
    expect(requests, 0);
  });

  test('restaura por refresh mesmo com access local ainda válido', () async {
    final original = _tokens();
    final newAccess = _token('access');
    String? sentRefresh;
    final server = await _server((request) async {
      expect(request.uri.path, '/auth/refresh');
      sentRefresh =
          (jsonDecode(await utf8.decoder.bind(request).join())
                  as Map<String, dynamic>)['refreshToken']
              as String;
      request.response
        ..statusCode = 200
        ..write(jsonEncode({'accessToken': newAccess}));
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage()..value = original;
    final session = _session(server, storage);
    addTearDown(session.dispose);

    await session.restore();
    expect(sentRefresh, original.refreshToken);
    expect(session.state, CustomerSessionState.authenticated);
    expect(storage.value?.accessToken, newAccess);
    expect(storage.value?.refreshToken, original.refreshToken);
  });

  test(
    'refresh inválido limpa credenciais e termina no estado público',
    () async {
      final server = await _server((request) async {
        request.response.statusCode = 401;
        await request.response.close();
      });
      addTearDown(server.close);
      final storage = MemorySessionStorage()..value = _tokens();
      final session = _session(server, storage);
      addTearDown(session.dispose);

      await session.restore();
      expect(session.state, CustomerSessionState.public);
      expect(session.sessionExpired, isTrue);
      expect(storage.value, isNull);
      expect(storage.clears, 1);
    },
  );

  test('refresh 400 também encerra a sessão', () async {
    final server = await _server((request) async {
      request.response.statusCode = 400;
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage()..value = _tokens();
    final session = _session(server, storage);
    addTearDown(session.dispose);

    await session.restore();
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isTrue);
    expect(storage.value, isNull);
  });

  test(
    'refresh rejeitado durante sessão autenticada limpa credenciais',
    () async {
      final tokens = _tokens(
        accessExpiry: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 10,
      );
      final server = await _server((request) async {
        if (request.uri.path == '/auth/login') {
          request.response
            ..statusCode = 200
            ..write(jsonEncode(tokens.toJson()));
        } else {
          request.response.statusCode = 401;
        }
        await request.response.close();
      });
      addTearDown(server.close);
      final storage = MemorySessionStorage();
      final session = _session(server, storage);
      addTearDown(session.dispose);
      await session.restore();
      expect(
        await session.signIn(email: 'ana@example.com', password: 'senha'),
        SignInOutcome.authenticated,
      );

      await session.refreshIfNeeded();
      expect(session.state, CustomerSessionState.public);
      expect(session.sessionExpired, isTrue);
      expect(session.accessToken, isNull);
      expect(storage.value, isNull);
    },
  );

  test('expiração preserva a causa após falha e retry da limpeza', () async {
    final server = await _server((request) async {
      request.response.statusCode = 401;
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage()
      ..value = _tokens()
      ..clearFailure = StateError('storage');
    final session = _session(server, storage);
    addTearDown(session.dispose);

    await session.restore();
    expect(session.state, CustomerSessionState.signedOutStorageError);
    expect(session.sessionExpired, isTrue);
    expect(session.isAuthenticated, isFalse);

    storage.clearFailure = null;
    await session.retrySignOut();
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isTrue);
    expect(storage.value, isNull);
  });

  test('logout voluntário mantém causa neutra durante recuperação', () async {
    final server = await _server((request) async {
      request.response
        ..statusCode = 200
        ..write(jsonEncode(_tokens().toJson()));
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage()
      ..clearFailure = StateError('storage');
    final session = _session(server, storage);
    addTearDown(session.dispose);
    await session.restore();
    await session.signIn(email: 'ana@example.com', password: 'senha');

    expect(await session.signOut(), isFalse);
    expect(session.state, CustomerSessionState.signedOutStorageError);
    expect(session.sessionExpired, isFalse);
    storage.clearFailure = null;
    await session.retrySignOut();
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isFalse);
    expect(storage.value, isNull);
  });

  test(
    'falha de transporte durante restauração mantém credenciais e oferece retry',
    () async {
      final storage = MemorySessionStorage()..value = _tokens();
      final session = CustomerSession(
        authApi: CustomerAuthApi(
          config: ApiConfig(baseUrl: 'https://127.0.0.1:1'),
        ),
        storage: storage,
      );
      addTearDown(session.dispose);

      await session.restore();
      expect(session.state, CustomerSessionState.restorationUnavailable);
      expect(session.sessionExpired, isFalse);
      expect(storage.value, isNotNull);
    },
  );

  test('login persiste tokens e logout limpa sessão e armazenamento', () async {
    final tokens = _tokens();
    final server = await _server((request) async {
      expect(request.uri.path, '/auth/login');
      request.response
        ..statusCode = 200
        ..write(jsonEncode(tokens.toJson()));
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage();
    final session = _session(server, storage);
    addTearDown(session.dispose);
    await session.restore();

    expect(
      await session.signIn(email: 'ana@example.com', password: ' senha '),
      SignInOutcome.authenticated,
    );
    expect(session.isAuthenticated, isTrue);
    expect(storage.value?.refreshToken, tokens.refreshToken);
    expect(await session.signOut(), isTrue);
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isFalse);
    expect(storage.value, isNull);
  });

  test('refresh simultâneo compartilha uma única chamada', () async {
    final nearExpiry = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 10;
    final tokens = _tokens(accessExpiry: nearExpiry);
    var refreshes = 0;
    final gate = Completer<void>();
    final server = await _server((request) async {
      if (request.uri.path == '/auth/login') {
        request.response
          ..statusCode = 200
          ..write(jsonEncode(tokens.toJson()));
        await request.response.close();
        return;
      }
      refreshes++;
      await gate.future;
      request.response
        ..statusCode = 200
        ..write(jsonEncode({'accessToken': _token('access')}));
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage();
    final session = _session(server, storage);
    addTearDown(session.dispose);
    await session.restore();
    await session.signIn(email: 'ana@example.com', password: 'senha');

    final first = session.refreshIfNeeded();
    final second = session.refreshIfNeeded();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(refreshes, 1);
    gate.complete();
    await Future.wait([first, second]);
    expect(refreshes, 1);
  });

  test('resposta tardia de login não recria sessão após logout', () async {
    final gate = Completer<void>();
    final server = await _server((request) async {
      await gate.future;
      request.response
        ..statusCode = 200
        ..write(jsonEncode(_tokens().toJson()));
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage();
    final session = _session(server, storage);
    addTearDown(session.dispose);
    await session.restore();

    final pendingLogin = session.signIn(
      email: 'ana@example.com',
      password: 'senha',
    );
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await session.signOut();
    gate.complete();
    expect(await pendingLogin, SignInOutcome.stale);
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isFalse);
    expect(storage.value, isNull);
  });

  test('resposta tardia de refresh não recria sessão após logout', () async {
    final gate = Completer<void>();
    final refreshStarted = Completer<void>();
    final tokens = _tokens(
      accessExpiry: DateTime.now().millisecondsSinceEpoch ~/ 1000 + 10,
    );
    final server = await _server((request) async {
      if (request.uri.path == '/auth/login') {
        request.response
          ..statusCode = 200
          ..write(jsonEncode(tokens.toJson()));
      } else {
        refreshStarted.complete();
        await gate.future;
        request.response.statusCode = 401;
      }
      await request.response.close();
    });
    addTearDown(server.close);
    final storage = MemorySessionStorage();
    final session = _session(server, storage);
    addTearDown(session.dispose);
    await session.restore();
    await session.signIn(email: 'ana@example.com', password: 'senha');

    final pendingRefresh = session.refreshIfNeeded();
    await refreshStarted.future;
    expect(await session.signOut(), isTrue);
    gate.complete();
    await pendingRefresh;

    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isFalse);
    expect(storage.value, isNull);
  });

  test(
    'logout serializa a limpeza depois de uma gravação de login em andamento',
    () async {
      final server = await _server((request) async {
        request.response
          ..statusCode = 200
          ..write(jsonEncode(_tokens().toJson()));
        await request.response.close();
      });
      addTearDown(server.close);
      final storage = MemorySessionStorage()..writeGate = Completer<void>();
      final session = _session(server, storage);
      addTearDown(session.dispose);
      await session.restore();

      final pendingLogin = session.signIn(
        email: 'ana@example.com',
        password: 'senha',
      );
      while (storage.writes == 0) {
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
      final pendingLogout = session.signOut();
      storage.writeGate!.complete();

      expect(await pendingLogin, SignInOutcome.stale);
      expect(await pendingLogout, isTrue);
      expect(session.state, CustomerSessionState.public);
      expect(storage.value, isNull);
    },
  );

  test(
    'falha ao limpar logout remove estado autenticado e exige nova limpeza',
    () async {
      final server = await _server((request) async {
        request.response
          ..statusCode = 200
          ..write(jsonEncode(_tokens().toJson()));
        await request.response.close();
      });
      addTearDown(server.close);
      final storage = MemorySessionStorage()
        ..clearFailure = StateError('storage');
      final session = _session(server, storage);
      addTearDown(session.dispose);
      await session.restore();
      await session.signIn(email: 'ana@example.com', password: 'senha');

      expect(await session.signOut(), isFalse);
      expect(session.isAuthenticated, isFalse);
      expect(session.state, CustomerSessionState.signedOutStorageError);
      storage.clearFailure = null;
      await session.retrySignOut();
      expect(session.state, CustomerSessionState.public);
    },
  );
}
