import 'dart:convert';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/presentation/customer_session_page.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

String _token(String type) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _id, 'perfil': 'ENTREGADOR', 'type': type, 'iat': now, 'exp': now + 3600})}.signature';
}

class _CourierAuthApi extends CustomerAuthApi {
  _CourierAuthApi()
    : super(
        profile: SessionProfile.courier,
        config: ApiConfig(baseUrl: ''),
      );

  int loginRequests = 0;
  int refreshRequests = 0;

  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async {
    loginRequests++;
    return AuthRequestResult(
      AuthRequestStatus.success,
      tokens: CustomerTokens(
        accessToken: _token('access'),
        refreshToken: _token('refresh'),
      ),
    );
  }

  @override
  Future<AuthRequestResult> refresh(String refreshToken) async {
    refreshRequests++;
    return const AuthRequestResult(AuthRequestStatus.unavailable);
  }
}

void main() {
  test(
    'falha transitória no refresh preserva sessão courier até expiração',
    () async {
      var clock = DateTime.now();
      final authApi = _CourierAuthApi();
      final session = CustomerSession(
        authApi: authApi,
        storage: MemorySessionStorage(),
        clock: () => clock,
      );
      addTearDown(session.dispose);
      await session.restore();
      expect(
        await session.signIn(email: 'courier@test.dev', password: 'senha'),
        SignInOutcome.authenticated,
      );

      final expiry = DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600;
      clock = DateTime.fromMillisecondsSinceEpoch((expiry - 30) * 1000);
      await session.refreshIfNeeded();

      expect(authApi.refreshRequests, 1);
      expect(session.state, CustomerSessionState.authenticated);
      expect(session.refreshUnavailable, isTrue);
    },
  );

  testWidgets('login ENTREGADOR abre a interface própria e encerra a sessão', (
    tester,
  ) async {
    final storage = MemorySessionStorage();
    final authApi = _CourierAuthApi();
    final session = CustomerSession(authApi: authApi, storage: storage);
    addTearDown(session.dispose);

    await tester.pumpWidget(
      MaterialApp(home: CustomerSessionPage(session: session)),
    );
    await pumpUntilSessionReady(tester);

    expect(find.text('Entre para acessar suas entregas.'), findsOneWidget);
    expect(find.text('Criar conta'), findsNothing);

    await tester.enterText(
      find.byType(TextFormField).at(0),
      'courier@test.dev',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'senha');
    await tester.pump();
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Entrar'));
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Entrar'))
          .onPressed,
      isNotNull,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pumpAndSettle();

    expect(authApi.loginRequests, 1);
    expect(session.state, CustomerSessionState.authenticated);
    expect(find.text('Área do entregador'), findsOneWidget);
    expect(
      find.text('Suas entregas atribuídas aparecerão aqui.'),
      findsOneWidget,
    );
    expect(find.text('Vitrine'), findsNothing);
    expect(session.accessToken, _token('access'));

    await tester.tap(find.text('Sair'));
    await tester.pumpAndSettle();
    expect(find.text('Entre para acessar suas entregas.'), findsOneWidget);
    expect(storage.value, isNull);
  });
}
