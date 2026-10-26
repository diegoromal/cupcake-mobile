import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/presentation/customer_session_page.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/courier/data/courier_orders_api.dart';
import 'package:cupcake_mobile/features/courier/presentation/courier_home_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

String _token(String type, {String? jti}) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _id, 'perfil': 'ENTREGADOR', 'type': type, 'iat': now, 'exp': now + 3600, 'jti': ?jti})}.signature';
}

class _CourierAuthApi extends CustomerAuthApi {
  _CourierAuthApi()
    : super(
        profile: SessionProfile.courier,
        config: ApiConfig(baseUrl: ''),
      );

  int loginRequests = 0;
  int refreshRequests = 0;
  AuthRequestResult? refreshOutcome;

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
    return refreshOutcome ??
        const AuthRequestResult(AuthRequestStatus.unavailable);
  }
}

Future<void> _loginFromPage(WidgetTester tester) async {
  await pumpUntilSessionReady(tester);
  await tester.enterText(find.byType(TextFormField).at(0), 'courier@test.dev');
  await tester.enterText(find.byType(TextFormField).at(1), 'senha');
  await tester.pump();
  await tester.ensureVisible(find.widgetWithText(FilledButton, 'Entrar'));
  await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
  await tester.pumpAndSettle();
}

class _CourierOrdersApi extends CourierOrdersApi {
  final responses = <Future<CourierOrdersResult>>[];
  final tokens = <String>[];
  final detailResponses = <Future<CourierOrderDetailResult>>[];
  final detailTokens = <String>[];
  final detailIds = <String>[];

  @override
  Future<CourierOrdersResult> fetchOrders({required String accessToken}) {
    tokens.add(accessToken);
    return responses.removeAt(0);
  }

  @override
  Future<CourierOrderDetailResult> fetchDetail({
    required String orderId,
    required String accessToken,
  }) {
    detailIds.add(orderId);
    detailTokens.add(accessToken);
    return detailResponses.removeAt(0);
  }
}

const _assignedOrder = CourierOrder(
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  businessNumber: 'PED-42',
  status: 'SAIU_PARA_ENTREGA',
);

const _deliveryDetail = CourierOrderDetail(
  businessNumber: 'PED-42',
  customerName: 'Cliente Exemplo',
  customerPhone: '11999999999',
  address: CourierDeliveryAddress(
    street: 'Rua A',
    number: '10',
    neighborhood: 'Centro',
    city: 'São Paulo',
    postalCode: '01001000',
    complement: null,
    reference: 'Portaria',
  ),
  departureAt: null,
);

Future<CustomerSession> _signedInSession() async {
  final session = CustomerSession(
    authApi: _CourierAuthApi(),
    storage: MemorySessionStorage(),
  );
  await session.restore();
  await session.signIn(email: 'courier@test.dev', password: 'senha');
  session.setForeground(false);
  return session;
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
    final ordersApi = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(CourierOrdersStatus.success, orders: []),
        ),
      );
    addTearDown(session.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: CustomerSessionPage(
          session: session,
          courierOrdersApi: ordersApi,
        ),
      ),
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
    expect(find.text('Nenhuma entrega atribuída no momento.'), findsOneWidget);
    expect(find.text('Vitrine'), findsNothing);
    expect(session.accessToken, isNotNull);
    expect(ordersApi.tokens, [session.accessToken]);

    await tester.tap(find.text('Sair'));
    await tester.pumpAndSettle();
    expect(find.text('Entre para acessar suas entregas.'), findsOneWidget);
    expect(storage.value, isNull);
  });

  testWidgets(
    'lista atribuída carrega só resumo e atualiza por ação explícita',
    (tester) async {
      final session = await _signedInSession();
      addTearDown(session.dispose);
      final pending = Completer<CourierOrdersResult>();
      const order = CourierOrder(
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        businessNumber: 'PED-42',
        status: 'SAIU_PARA_ENTREGA',
      );
      final api = _CourierOrdersApi()
        ..responses.add(pending.future)
        ..responses.add(
          Future.value(
            const CourierOrdersResult(CourierOrdersStatus.success, orders: []),
          ),
        );
      await tester.pumpWidget(
        MaterialApp(
          home: CourierHomePage(session: session, api: api),
        ),
      );
      await tester.pump();
      expect(find.bySemanticsLabel('Carregando entregas…'), findsOneWidget);
      expect(find.text('Nenhuma entrega atribuída no momento.'), findsNothing);
      pending.complete(
        const CourierOrdersResult(CourierOrdersStatus.success, orders: [order]),
      );
      await tester.pumpAndSettle();
      expect(find.text('Pedido PED-42'), findsOneWidget);
      expect(find.text('Status: Saiu para entrega'), findsOneWidget);
      expect(find.textContaining('telefone'), findsNothing);
      expect(api.tokens, [_token('access')]);
      await tester.tap(find.byTooltip('Atualizar entregas'));
      await tester.pumpAndSettle();
      expect(
        find.text('Nenhuma entrega atribuída no momento.'),
        findsOneWidget,
      );
      expect(api.tokens, hasLength(2));
    },
  );

  testWidgets('erro permite retry e 403 mostra acesso negado', (tester) async {
    final session = await _signedInSession();
    addTearDown(session.dispose);
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(CourierOrdersStatus.unavailable),
        ),
      )
      ..responses.add(
        Future.value(const CourierOrdersResult(CourierOrdersStatus.forbidden)),
      );
    await tester.pumpWidget(
      MaterialApp(
        home: CourierHomePage(session: session, api: api),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Não foi possível carregar'), findsOneWidget);
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Sua conta não tem acesso às entregas.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
    expect(api.tokens, hasLength(2));
  });

  testWidgets('resposta tardia não expõe entregas após sair', (tester) async {
    final session = await _signedInSession();
    addTearDown(session.dispose);
    final pending = Completer<CourierOrdersResult>();
    final api = _CourierOrdersApi()..responses.add(pending.future);
    await tester.pumpWidget(
      MaterialApp(
        home: CourierHomePage(session: session, api: api),
      ),
    );
    await tester.pump();
    await session.signOut();
    pending.complete(
      const CourierOrdersResult(
        CourierOrdersStatus.success,
        orders: [
          CourierOrder(
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            businessNumber: 'PED-42',
            status: 'SAIU_PARA_ENTREGA',
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Pedido PED-42'), findsNothing);
    expect(find.text('Sessão expirada. Entre novamente.'), findsOneWidget);
  });

  testWidgets('401 após refresh bem-sucedido volta ao login', (tester) async {
    final storage = MemorySessionStorage();
    final refreshedAccess = _token('access', jti: 'refreshed');
    final authApi = _CourierAuthApi()
      ..refreshOutcome = AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: refreshedAccess,
      );
    final session = CustomerSession(authApi: authApi, storage: storage);
    addTearDown(session.dispose);
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(CourierOrdersStatus.unauthorized),
        ),
      )
      ..responses.add(
        Future.value(
          const CourierOrdersResult(CourierOrdersStatus.unauthorized),
        ),
      );
    await tester.pumpWidget(
      MaterialApp(
        home: CustomerSessionPage(session: session, courierOrdersApi: api),
      ),
    );
    await _loginFromPage(tester);

    expect(authApi.refreshRequests, 1);
    expect(api.tokens, hasLength(2));
    expect(api.tokens.last, refreshedAccess);
    expect(api.tokens.first, isNot(refreshedAccess));
    expect(session.state, CustomerSessionState.public);
    expect(storage.value, isNull);
    expect(find.text('Entre para acessar suas entregas.'), findsOneWidget);
    expect(find.text('Área do entregador'), findsNothing);
  });

  testWidgets('refresh transitório após 401 mantém sessão e permite retry', (
    tester,
  ) async {
    final authApi = _CourierAuthApi();
    final session = CustomerSession(
      authApi: authApi,
      storage: MemorySessionStorage(),
    );
    addTearDown(session.dispose);
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(CourierOrdersStatus.unauthorized),
        ),
      )
      ..responses.add(
        Future.value(
          const CourierOrdersResult(CourierOrdersStatus.success, orders: []),
        ),
      );
    await tester.pumpWidget(
      MaterialApp(
        home: CustomerSessionPage(session: session, courierOrdersApi: api),
      ),
    );
    await _loginFromPage(tester);

    expect(authApi.refreshRequests, 1);
    expect(session.state, CustomerSessionState.authenticated);
    expect(session.refreshUnavailable, isTrue);
    expect(find.textContaining('Não foi possível carregar'), findsOneWidget);
    expect(find.text('Sessão expirada. Entre novamente.'), findsNothing);
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Nenhuma entrega atribuída no momento.'), findsOneWidget);
    expect(session.state, CustomerSessionState.authenticated);
    expect(api.tokens, hasLength(2));
    expect(api.tokens.last, api.tokens.first);
  });

  testWidgets('lista abre detalhe, mostra loading, campos e volta', (
    tester,
  ) async {
    final session = await _signedInSession();
    addTearDown(session.dispose);
    final pending = Completer<CourierOrderDetailResult>();
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(
            CourierOrdersStatus.success,
            orders: [_assignedOrder],
          ),
        ),
      )
      ..detailResponses.add(pending.future);
    await tester.pumpWidget(
      MaterialApp(
        home: CourierHomePage(session: session, api: api),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pedido PED-42'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.text('Detalhe da entrega'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Carregando detalhe da entrega…'),
      findsOneWidget,
    );
    pending.complete(
      CourierOrderDetailResult(
        CourierOrdersStatus.success,
        detail: CourierOrderDetail(
          businessNumber: _deliveryDetail.businessNumber,
          customerName: _deliveryDetail.customerName,
          customerPhone: _deliveryDetail.customerPhone,
          address: _deliveryDetail.address,
          departureAt: DateTime.utc(2026, 10, 25, 12, 34),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cliente Exemplo'), findsOneWidget);
    expect(find.text('Telefone: 11999999999'), findsOneWidget);
    expect(find.text('Rua A, 10'), findsOneWidget);
    expect(find.text('Centro — São Paulo'), findsOneWidget);
    expect(find.text('CEP: 01001000'), findsOneWidget);
    expect(find.text('Referência: Portaria'), findsOneWidget);
    expect(find.textContaining('Complemento:'), findsNothing);
    expect(find.textContaining('às'), findsOneWidget);
    expect(find.text('Horário de saída indisponível'), findsNothing);
    expect(api.detailIds, [_assignedOrder.id]);
    expect(api.detailTokens, [session.accessToken]);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Área do entregador'), findsOneWidget);
    expect(find.text('Pedido PED-42'), findsOneWidget);
  });

  testWidgets('detalhe permite retry e distingue 403 e 404', (tester) async {
    final session = await _signedInSession();
    addTearDown(session.dispose);
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(
            CourierOrdersStatus.success,
            orders: [_assignedOrder],
          ),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(CourierOrdersStatus.unavailable),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(
            CourierOrdersStatus.success,
            detail: _deliveryDetail,
          ),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(CourierOrdersStatus.forbidden),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(CourierOrdersStatus.notFound),
        ),
      );
    await tester.pumpWidget(
      MaterialApp(
        home: CourierHomePage(session: session, api: api),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pedido PED-42'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Não foi possível carregar'), findsOneWidget);
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Cliente Exemplo'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pedido PED-42'));
    await tester.pumpAndSettle();
    expect(find.text('Acesso negado a esta entrega.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pedido PED-42'));
    await tester.pumpAndSettle();
    expect(find.text('Entrega não encontrada.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
    expect(api.detailIds, List.filled(4, _assignedOrder.id));
  });

  testWidgets('401 final no detalhe encerra sessão e retorna ao login', (
    tester,
  ) async {
    final storage = MemorySessionStorage();
    final refreshedAccess = _token('access', jti: 'detail-refreshed');
    final authApi = _CourierAuthApi()
      ..refreshOutcome = AuthRequestResult(
        AuthRequestStatus.success,
        accessToken: refreshedAccess,
      );
    final session = CustomerSession(authApi: authApi, storage: storage);
    addTearDown(session.dispose);
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(
            CourierOrdersStatus.success,
            orders: [_assignedOrder],
          ),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(CourierOrdersStatus.unauthorized),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(CourierOrdersStatus.unauthorized),
        ),
      );
    await tester.pumpWidget(
      MaterialApp(
        home: CustomerSessionPage(session: session, courierOrdersApi: api),
      ),
    );
    await _loginFromPage(tester);
    await tester.tap(find.text('Pedido PED-42'));
    await tester.pumpAndSettle();
    expect(authApi.refreshRequests, 1);
    expect(api.detailTokens, hasLength(2));
    expect(api.detailTokens.last, refreshedAccess);
    expect(session.state, CustomerSessionState.public);
    expect(storage.value, isNull);
    expect(find.text('Entre para acessar suas entregas.'), findsOneWidget);
    expect(find.text('Detalhe da entrega'), findsNothing);
  });

  testWidgets('refresh transitório no detalhe mantém sessão e oferece retry', (
    tester,
  ) async {
    final authApi = _CourierAuthApi();
    final session = CustomerSession(
      authApi: authApi,
      storage: MemorySessionStorage(),
    );
    addTearDown(session.dispose);
    final api = _CourierOrdersApi()
      ..responses.add(
        Future.value(
          const CourierOrdersResult(
            CourierOrdersStatus.success,
            orders: [_assignedOrder],
          ),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(CourierOrdersStatus.unauthorized),
        ),
      )
      ..detailResponses.add(
        Future.value(
          const CourierOrderDetailResult(
            CourierOrdersStatus.success,
            detail: _deliveryDetail,
          ),
        ),
      );
    await tester.pumpWidget(
      MaterialApp(
        home: CustomerSessionPage(session: session, courierOrdersApi: api),
      ),
    );
    await _loginFromPage(tester);
    await tester.tap(find.text('Pedido PED-42'));
    await tester.pumpAndSettle();
    expect(authApi.refreshRequests, 1);
    expect(session.state, CustomerSessionState.authenticated);
    expect(find.textContaining('Não foi possível carregar'), findsOneWidget);
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Cliente Exemplo'), findsOneWidget);
    expect(api.detailTokens, hasLength(2));
    expect(api.detailTokens.last, api.detailTokens.first);
  });
}
