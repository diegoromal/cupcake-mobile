import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/core/design/app_tokens.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/orders/data/customer_orders_api.dart';
import 'package:cupcake_mobile/features/orders/presentation/customer_orders_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

Map<String, dynamic> _order({String status = 'PAGO'}) => {
  'id': _id,
  'identificadorNegocio': 'PED-42',
  'data': '2026-10-26T12:30:00.000Z',
  'modalidade': 'ENTREGA',
  'total': '42.50',
  'statusAtual': status,
};

void main() {
  test(
    'modelo valida os campos do resumo retornado pelo endpoint existente',
    () {
      final order = CustomerOrder.parse(_order());
      expect(order?.businessNumber, 'PED-42');
      expect(order?.total, '42.50');
      expect(order?.status, 'PAGO');
      expect(
        CustomerOrder.parse({..._order(), 'campoInterno': 'não expor'}),
        isNull,
      );
      expect(
        CustomerOrder.parse({..._order(), 'statusAtual': 'DESCONHECIDO'}),
        isNull,
      );
    },
  );

  testWidgets(
    'abre carregando, atualiza a cada 30 s e pausa polling em background',
    (tester) async {
      final session = await _signedInSession();
      final api = _FakeOrdersApi();
      await tester.pumpWidget(
        MaterialApp(
          home: CustomerOrdersPage(session: session, api: api),
        ),
      );
      await tester.pump();
      expect(api.calls, 1);
      final card = tester.widget<Card>(find.byType(Card));
      expect(card.color, AppTokens.surface);
      expect(find.text('Pedido PED-42'), findsOneWidget);
      expect(find.text('R\$ 42,50'), findsOneWidget);
      expect(find.textContaining('Status: Pago'), findsOneWidget);

      await tester.pump(const Duration(seconds: 29));
      expect(api.calls, 1);
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(api.calls, 2);

      await tester.drag(find.byType(ListView), const Offset(0, 400));
      await tester.pumpAndSettle();
      expect(api.calls, 3);

      await tester.tap(find.byTooltip('Atualizar pedidos'));
      await tester.pump();
      expect(api.calls, 4);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      await tester.pump(const Duration(seconds: 60));
      expect(api.calls, 4);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(api.calls, 5);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 60));
      expect(api.calls, 5);
      session.dispose();
    },
  );

  testWidgets(
    'retorno ao foreground agenda refresh após a consulta em andamento',
    (tester) async {
      final session = await _signedInSession();
      final gate = Completer<void>();
      final api = _FakeOrdersApi(firstRequestGate: gate);
      await tester.pumpWidget(
        MaterialApp(
          home: CustomerOrdersPage(session: session, api: api),
        ),
      );
      await tester.pump();
      expect(api.calls, 1);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(api.calls, 1);

      gate.complete();
      await tester.pump();
      await tester.pump();
      expect(api.calls, 2);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
      session.dispose();
    },
  );

  testWidgets('preserva estado vazio da lista', (tester) async {
    final session = await _signedInSession();
    final api = _FakeOrdersApi(orders: const []);
    await tester.pumpWidget(
      MaterialApp(
        home: CustomerOrdersPage(session: session, api: api),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Você ainda não tem pedidos.'), findsOneWidget);
    expect(find.byType(Card), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    session.dispose();
  });
}

Future<CustomerSession> _signedInSession() async {
  final session = CustomerSession(
    authApi: _AuthApi(),
    storage: MemorySessionStorage(),
  );
  await session.restore();
  await session.signIn(email: 'cliente@example.test', password: 'senha');
  return session;
}

class _AuthApi extends CustomerAuthApi {
  _AuthApi() : super(config: ApiConfig(baseUrl: ''));

  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async => AuthRequestResult(AuthRequestStatus.success, tokens: _tokens());
}

class _FakeOrdersApi extends CustomerOrdersApi {
  _FakeOrdersApi({this.firstRequestGate, this.orders});

  final Completer<void>? firstRequestGate;
  final List<CustomerOrder>? orders;
  int calls = 0;

  @override
  Future<CustomerOrdersResult> fetchOrders({
    required String accessToken,
  }) async {
    calls++;
    if (calls == 1) await firstRequestGate?.future;
    return CustomerOrdersResult(
      CustomerOrdersStatus.success,
      orders: orders ?? [CustomerOrder.parse(_order())!],
    );
  }
}

CustomerTokens _tokens() {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  String token(String type) =>
      '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _id, 'perfil': 'CLIENTE', 'type': type, 'iat': now, 'exp': now + 3600})}.signature';
  return CustomerTokens(
    accessToken: token('access'),
    refreshToken: token('refresh'),
  );
}
