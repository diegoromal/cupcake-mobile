import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/app/cupcake_app.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

class _FakeAuthApi extends CustomerAuthApi {
  _FakeAuthApi(this.respond, {this.refreshResponse});

  final Future<AuthRequestResult> Function() respond;
  final AuthRequestResult? refreshResponse;
  int loginRequests = 0;

  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async {
    loginRequests++;
    return respond();
  }

  @override
  Future<AuthRequestResult> refresh(String refreshToken) async =>
      refreshResponse ?? const AuthRequestResult(AuthRequestStatus.unavailable);
}

String _token(String type) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _id, 'perfil': 'CLIENTE', 'type': type, 'iat': now, 'exp': now + 3600})}.signature';
}

void main() {
  testWidgets('login autenticado abre destino mínimo e sair retorna ao login', (
    tester,
  ) async {
    final storage = MemorySessionStorage();
    final authApi = _FakeAuthApi(
      () async => AuthRequestResult(
        AuthRequestStatus.success,
        tokens: CustomerTokens(
          accessToken: _token('access'),
          refreshToken: _token('refresh'),
        ),
      ),
    );
    final session = CustomerSession(authApi: authApi, storage: storage);
    await tester.pumpWidget(CupcakeApp(session: session));
    await pumpUntilSessionReady(tester);

    await tester.enterText(
      find.byType(TextFormField).at(0),
      ' ANA@EXAMPLE.COM ',
    );
    await tester.enterText(find.byType(TextFormField).at(1), ' senha ');
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Entrar'))
          .onPressed,
      isNotNull,
    );
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pumpAndSettle();

    expect(authApi.loginRequests, 1);
    expect(find.text('Sessão do cliente'), findsOneWidget);
    expect(find.text('Você entrou na sua conta.'), findsOneWidget);
    expect(find.textContaining('signature'), findsNothing);

    await tester.tap(find.text('Sair'));
    await tester.pumpAndSettle();
    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
    expect(find.textContaining('Sua sessão foi encerrada.'), findsNothing);
    expect(session.sessionExpired, isFalse);
    expect(storage.value, isNull);
    expect(
      tester.state<NavigatorState>(find.byType(Navigator)).canPop(),
      isFalse,
    );
    await tester.pumpWidget(const SizedBox());
    session.dispose();
  });

  testWidgets('refresh rejeitado volta ao Login com aviso acessível', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final storage = MemorySessionStorage()
      ..value = CustomerTokens(
        accessToken: _token('access'),
        refreshToken: _token('refresh'),
      );
    final session = CustomerSession(
      authApi: _FakeAuthApi(
        () async => const AuthRequestResult(AuthRequestStatus.unavailable),
        refreshResponse: const AuthRequestResult(
          AuthRequestStatus.invalidToken,
        ),
      ),
      storage: storage,
    );
    addTearDown(session.dispose);
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(CupcakeApp(session: session));
    await tester.pumpAndSettle();

    const message = 'Sua sessão foi encerrada. Entre novamente para continuar.';
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isTrue);
    expect(storage.value, isNull);
    expect(find.text('Acesse sua conta para continuar.'), findsOneWidget);
    expect(find.text(message), findsOneWidget);
    expect(
      tester.getSemantics(find.text(message)).flagsCollection.isLiveRegion,
      isTrue,
    );
    expect(find.byType(TextFormField), findsNWidgets(2));
    expect(
      tester.state<NavigatorState>(find.byType(Navigator)).canPop(),
      isFalse,
    );
    for (final width in [320.0, 390.0, 430.0]) {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      await tester.pump();
      expect(tester.takeException(), isNull, reason: 'largura $width dp');
    }
    tester.view.platformDispatcher.textScaleFactorTestValue = 2;
    await tester.pump();
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });

  testWidgets('aviso de expiração permanece após retry de limpeza', (
    tester,
  ) async {
    final storage = MemorySessionStorage()
      ..value = CustomerTokens(
        accessToken: _token('access'),
        refreshToken: _token('refresh'),
      )
      ..clearFailure = StateError('storage');
    final session = CustomerSession(
      authApi: _FakeAuthApi(
        () async => const AuthRequestResult(AuthRequestStatus.unavailable),
        refreshResponse: const AuthRequestResult(
          AuthRequestStatus.invalidToken,
        ),
      ),
      storage: storage,
    );
    addTearDown(session.dispose);

    await tester.pumpWidget(CupcakeApp(session: session));
    await tester.pumpAndSettle();
    expect(session.state, CustomerSessionState.signedOutStorageError);
    expect(session.sessionExpired, isTrue);
    expect(find.text('Sua sessão foi encerrada.'), findsNothing);

    storage.clearFailure = null;
    await tester.tap(find.text('Tentar sair novamente'));
    await tester.pumpAndSettle();
    expect(session.state, CustomerSessionState.public);
    expect(session.sessionExpired, isTrue);
    expect(
      find.text('Sua sessão foi encerrada. Entre novamente para continuar.'),
      findsOneWidget,
    );
  });

  testWidgets('falha temporária mantém credenciais sem aviso de expiração', (
    tester,
  ) async {
    final storage = MemorySessionStorage()
      ..value = CustomerTokens(
        accessToken: _token('access'),
        refreshToken: _token('refresh'),
      );
    final session = CustomerSession(
      authApi: _FakeAuthApi(
        () async => const AuthRequestResult(AuthRequestStatus.unavailable),
        refreshResponse: const AuthRequestResult(AuthRequestStatus.unavailable),
      ),
      storage: storage,
    );
    addTearDown(session.dispose);

    await tester.pumpWidget(CupcakeApp(session: session));
    await tester.pumpAndSettle();

    expect(session.state, CustomerSessionState.restorationUnavailable);
    expect(session.sessionExpired, isFalse);
    expect(storage.value, isNotNull);
    expect(find.text('Tentar novamente'), findsOneWidget);
    expect(find.text('Sair'), findsOneWidget);
    expect(find.textContaining('Sua sessão foi encerrada.'), findsNothing);
  });

  testWidgets(
    '401 mostra mensagem neutra e mantém credenciais apenas em campos',
    (tester) async {
      final storage = MemorySessionStorage();
      final authApi = _FakeAuthApi(
        () async =>
            const AuthRequestResult(AuthRequestStatus.invalidCredentials),
      );
      final session = CustomerSession(authApi: authApi, storage: storage);
      await tester.pumpWidget(CupcakeApp(session: session));
      await pumpUntilSessionReady(tester);
      await tester.enterText(
        find.byType(TextFormField).at(0),
        'ana@example.com',
      );
      await tester.enterText(
        find.byType(TextFormField).at(1),
        'wrong-password',
      );
      await tester.pump();
      await tester.ensureVisible(find.widgetWithText(FilledButton, 'Entrar'));
      await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
      await tester.pumpAndSettle();

      expect(
        find.text('As credenciais informadas não foram aceitas.'),
        findsOneWidget,
      );
      expect(authApi.loginRequests, 1);
      expect(session.state, CustomerSessionState.public);
      expect(session.accessToken, isNull);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(0))
            .controller
            ?.text,
        'ana@example.com',
      );
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).at(1))
            .controller
            ?.text,
        'wrong-password',
      );
      expect(
        tester
            .widgetList<Text>(find.byType(Text))
            .map((widget) => widget.data)
            .whereType<String>(),
        isNot(contains('wrong-password')),
      );
      expect(storage.value, isNull);
      await tester.pumpWidget(const SizedBox());
      session.dispose();
    },
  );

  testWidgets('login se adapta às larguras, teclado e texto ampliado', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);
    final session = createCustomerSession();
    addTearDown(session.dispose);
    await tester.pumpWidget(CupcakeApp(session: session));
    await pumpUntilSessionReady(tester);

    for (final width in [320.0, 390.0, 430.0]) {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await tester.pump();
      expect(tester.takeException(), isNull, reason: 'largura $width dp');
    }
    tester.view.platformDispatcher.textScaleFactorTestValue = 2;
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('loading de login impede submissão concorrente', (tester) async {
    final requestReceived = Completer<void>();
    final responseGate = Completer<void>();
    final authApi = _FakeAuthApi(() async {
      if (!requestReceived.isCompleted) requestReceived.complete();
      await responseGate.future;
      return const AuthRequestResult(AuthRequestStatus.invalidCredentials);
    });
    final session = CustomerSession(
      authApi: authApi,
      storage: MemorySessionStorage(),
    );
    await tester.pumpWidget(CupcakeApp(session: session));
    await pumpUntilSessionReady(tester);
    await tester.enterText(find.byType(TextFormField).at(0), 'ana@example.com');
    await tester.enterText(find.byType(TextFormField).at(1), 'senha');
    await tester.pump();
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pump();
    await requestReceived.future;
    await tester.pump();

    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Entrar'))
          .onPressed,
      isNull,
    );
    await tester.pump();
    expect(authApi.loginRequests, 1);

    responseGate.complete();
    await tester.pumpAndSettle();
    await tester.pumpWidget(const SizedBox());
    session.dispose();
  });
}
