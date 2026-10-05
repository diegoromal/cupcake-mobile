import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _subject = '9b72c770-bc74-4c77-82c7-205c2d91628a';

String _token(String type, DateTime expiry) {
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _subject, 'perfil': 'CLIENTE', 'type': type, 'iat': now, 'exp': expiry.millisecondsSinceEpoch ~/ 1000})}.${encode('signature')}';
}

CustomerTokens _tokens(DateTime accessExpiry) => CustomerTokens(
  accessToken: _token('access', accessExpiry),
  refreshToken: _token('refresh', DateTime.now().add(const Duration(days: 7))),
);

class _AuthApi extends CustomerAuthApi {
  _AuthApi(this.onRefresh)
    : super(config: ApiConfig(baseUrl: 'https://example.invalid'));

  Future<AuthRequestResult> Function(String) onRefresh;
  int refreshCalls = 0;

  @override
  Future<AuthRequestResult> refresh(String token) {
    refreshCalls++;
    return onRefresh(token);
  }
}

CustomerSession _session(
  WidgetTester tester,
  _AuthApi api,
  MemorySessionStorage storage,
) {
  final fakeStart = tester.binding.clock.now();
  final realStart = DateTime.now();
  return CustomerSession(
    authApi: api,
    storage: storage,
    clock: () =>
        realStart.add(tester.binding.clock.now().difference(fakeStart)),
  );
}

Future<void> _flush(WidgetTester tester) async {
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets(
    'foreground agenda refresh antes do exp e reagenda com novo exp',
    (tester) async {
      final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
      final renewed = _token(
        'access',
        DateTime.now().add(const Duration(seconds: 124)),
      );
      final api = _AuthApi(
        (_) async => AuthRequestResult(
          AuthRequestStatus.success,
          accessToken: original.accessToken,
        ),
      );
      final storage = MemorySessionStorage()..value = original;
      final session = _session(tester, api, storage);
      addTearDown(session.dispose);

      await session.restore();
      expect(session.isAuthenticated, isTrue);
      expect(api.refreshCalls, 1);
      api.onRefresh = (_) async =>
          AuthRequestResult(AuthRequestStatus.success, accessToken: renewed);

      await tester.pump(const Duration(seconds: 3));
      await _flush(tester);
      expect(api.refreshCalls, 2);
      expect(session.isAuthenticated, isTrue);
      expect(storage.value?.accessToken, renewed);
      expect(storage.value?.refreshToken, original.refreshToken);

      await tester.pump(const Duration(seconds: 30));
      expect(api.refreshCalls, 2);
      await tester.pump(const Duration(seconds: 32));
      await _flush(tester);
      expect(api.refreshCalls, 3);
      session.setForeground(false);
    },
  );

  testWidgets('expiração em foreground dispara refresh sem resume', (
    tester,
  ) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final api = _AuthApi(
      (_) async => const AuthRequestResult(AuthRequestStatus.invalidToken),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);

    // A primeira chamada valida a restauração; a seguinte vem do timer.
    api.onRefresh = (_) async => AuthRequestResult(
      AuthRequestStatus.success,
      accessToken: original.accessToken,
    );
    await session.restore();
    api.onRefresh = (_) async =>
        const AuthRequestResult(AuthRequestStatus.invalidToken);

    await tester.pump(const Duration(seconds: 3));
    await _flush(tester);
    expect(api.refreshCalls, 2);
    expect(session.state, CustomerSessionState.public);
    expect(storage.value, isNull);
  });

  testWidgets('token renovado de vida curta não cria loop imediato', (
    tester,
  ) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final api = _AuthApi(
      (_) async => AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: original.accessToken,
      ),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);
    await session.restore();
    api.onRefresh = (_) async => AuthRequestResult(
      AuthRequestStatus.success,
      accessToken: _token(
        'access',
        DateTime.now().add(const Duration(seconds: 30)),
      ),
    );

    await tester.pump(const Duration(seconds: 3));
    await _flush(tester);
    expect(api.refreshCalls, 2);
    await tester.pump(const Duration(seconds: 10));
    expect(api.refreshCalls, 2);
    session.setForeground(false);
  });

  testWidgets('pausa cancela timer e retomada verifica sessão', (tester) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final api = _AuthApi(
      (_) async => AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: original.accessToken,
      ),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);
    await session.restore();
    session.setForeground(false);
    await tester.pump(const Duration(seconds: 3));
    expect(api.refreshCalls, 1);

    session.setForeground(true);
    await session.refreshIfNeeded();
    expect(api.refreshCalls, 2);
    session.setForeground(false);
  });

  testWidgets('401 agendado remove área D28 e mostra aviso no Login', (
    tester,
  ) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final api = _AuthApi(
      (_) async => AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: original.accessToken,
      ),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);
    await tester.pumpWidget(CupcakeApp(session: session));
    await _flush(tester);
    expect(find.text('Sessão do cliente'), findsOneWidget);
    expect(find.text('Você entrou na sua conta.'), findsOneWidget);

    api.onRefresh = (_) async =>
        const AuthRequestResult(AuthRequestStatus.invalidToken);
    await tester.pump(const Duration(seconds: 3));
    await _flush(tester);
    expect(find.text('Sessão do cliente'), findsNothing);
    expect(find.text('Entrar'), findsWidgets);
    expect(
      find.text('Sua sessão foi encerrada. Entre novamente para continuar.'),
      findsOneWidget,
    );
    expect(storage.value, isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('400 agendado preserva causa após falha e retry de limpeza', (
    tester,
  ) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final api = _AuthApi(
      (_) async => AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: original.accessToken,
      ),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);
    await tester.pumpWidget(CupcakeApp(session: session));
    await _flush(tester);

    storage.clearFailure = StateError('storage');
    api.onRefresh = (_) async =>
        const AuthRequestResult(AuthRequestStatus.invalidRequest);
    await tester.pump(const Duration(seconds: 3));
    await _flush(tester);
    expect(session.state, CustomerSessionState.signedOutStorageError);
    expect(session.sessionExpired, isTrue);
    expect(find.text('Sessão do cliente'), findsNothing);

    storage.clearFailure = null;
    await tester.tap(find.text('Tentar sair novamente'));
    await _flush(tester);
    expect(session.sessionExpired, isTrue);
    expect(
      find.text('Sua sessão foi encerrada. Entre novamente para continuar.'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'falha temporária antes do exp mantém área e permite retry explícito',
    (tester) async {
      final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
      final api = _AuthApi(
        (_) async => AuthRequestResult(
          AuthRequestStatus.success,
          accessToken: original.accessToken,
        ),
      );
      final storage = MemorySessionStorage()..value = original;
      final session = _session(tester, api, storage);
      addTearDown(session.dispose);
      await tester.pumpWidget(CupcakeApp(session: session));
      await _flush(tester);
      api.onRefresh = (_) async =>
          const AuthRequestResult(AuthRequestStatus.unavailable);

      await tester.pump(const Duration(seconds: 3));
      await _flush(tester);
      expect(session.state, CustomerSessionState.authenticated);
      expect(session.accessToken, original.accessToken);
      expect(find.text('Sessão do cliente'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);
      expect(
        find.text('Sua sessão foi encerrada. Entre novamente para continuar.'),
        findsNothing,
      );
      expect(session.sessionExpired, isFalse);
      expect(storage.value?.accessToken, original.accessToken);
      expect(storage.value?.refreshToken, original.refreshToken);
      expect(storage.clears, 0);
      await tester.pump(const Duration(seconds: 10));
      expect(api.refreshCalls, 2);

      final renewed = _token(
        'access',
        DateTime.now().add(const Duration(seconds: 124)),
      );
      api.onRefresh = (_) async =>
          AuthRequestResult(AuthRequestStatus.success, accessToken: renewed);
      await tester.tap(find.text('Tentar novamente'));
      await _flush(tester);
      expect(api.refreshCalls, 3);
      expect(session.isAuthenticated, isTrue);
      expect(storage.value?.accessToken, renewed);
      expect(storage.value?.refreshToken, original.refreshToken);
      expect(find.text('Tentar novamente'), findsNothing);
      await tester.pump(const Duration(seconds: 53));
      await _flush(tester);
      expect(api.refreshCalls, 4);
      session.setForeground(false);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'falha temporária antes do exp deixa área ao exp sem retry automático',
    (tester) async {
      final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
      final api = _AuthApi(
        (_) async => AuthRequestResult(
          AuthRequestStatus.success,
          accessToken: original.accessToken,
        ),
      );
      final storage = MemorySessionStorage()..value = original;
      final session = _session(tester, api, storage);
      addTearDown(session.dispose);
      await tester.pumpWidget(CupcakeApp(session: session));
      await _flush(tester);
      api.onRefresh = (_) async =>
          const AuthRequestResult(AuthRequestStatus.unavailable);

      await tester.pump(const Duration(seconds: 3));
      await _flush(tester);
      expect(session.state, CustomerSessionState.authenticated);
      await tester.pump(const Duration(seconds: 60));
      await _flush(tester);
      expect(api.refreshCalls, 2);
      expect(session.state, CustomerSessionState.restorationUnavailable);
      expect(session.sessionExpired, isFalse);
      expect(session.accessToken, isNull);
      expect(find.text('Sessão do cliente'), findsNothing);
      expect(find.text('Tentar novamente'), findsOneWidget);
      expect(storage.value?.accessToken, original.accessToken);
      expect(storage.value?.refreshToken, original.refreshToken);
      expect(storage.clears, 0);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('timer e resume compartilham um refresh', (tester) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 59)));
    final gate = Completer<AuthRequestResult>();
    final api = _AuthApi((_) => gate.future);
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);
    api.onRefresh = (_) async => AuthRequestResult(
      AuthRequestStatus.success,
      accessToken: original.accessToken,
    );
    await session.restore();
    api.onRefresh = (_) => gate.future;

    session.setForeground(false);
    session.setForeground(true);
    final resumed = session.refreshIfNeeded();
    await tester.pump();
    expect(api.refreshCalls, 2);
    gate.complete(
      AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: _token(
          'access',
          DateTime.now().add(const Duration(minutes: 10)),
        ),
      ),
    );
    await resumed;
    expect(api.refreshCalls, 2);
    expect(session.isAuthenticated, isTrue);
    session.setForeground(false);
  });

  testWidgets('logout cancela timer e descarta refresh tardio', (tester) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final gate = Completer<AuthRequestResult>();
    final api = _AuthApi(
      (_) async => AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: original.accessToken,
      ),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    addTearDown(session.dispose);
    await session.restore();
    api.onRefresh = (_) => gate.future;

    await tester.pump(const Duration(seconds: 3));
    expect(api.refreshCalls, 2);
    expect(await session.signOut(), isTrue);
    gate.complete(
      AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: _token(
          'access',
          DateTime.now().add(const Duration(minutes: 10)),
        ),
      ),
    );
    await _flush(tester);
    await tester.pump(const Duration(minutes: 10));
    expect(api.refreshCalls, 2);
    expect(session.state, CustomerSessionState.public);
    expect(storage.value, isNull);
    expect(session.sessionExpired, isFalse);
  });

  testWidgets('dispose cancela timer e ignora callback tardio', (tester) async {
    final original = _tokens(DateTime.now().add(const Duration(seconds: 62)));
    final api = _AuthApi(
      (_) async => AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: original.accessToken,
      ),
    );
    final storage = MemorySessionStorage()..value = original;
    final session = _session(tester, api, storage);
    await session.restore();
    session.dispose();
    await tester.pump(const Duration(seconds: 3));
    expect(api.refreshCalls, 1);
    expect(tester.takeException(), isNull);
  });
}
