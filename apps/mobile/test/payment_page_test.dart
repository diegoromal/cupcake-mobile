import 'dart:convert';

import 'package:cupcake_mobile/core/design/app_tokens.dart';
import 'package:cupcake_mobile/core/design/app_theme.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/checkout/data/customer_payment_api.dart';
import 'package:cupcake_mobile/features/checkout/presentation/payment_page.dart';
import 'package:cupcake_mobile/features/checkout/presentation/payment_result_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

String _token(String type) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String part(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${part({'alg': 'HS256'})}.${part({'sub': orderId, 'perfil': 'CLIENTE', 'type': type, 'jti': type, 'iat': now, 'exp': now + 3600})}.signature';
}

class _AuthApi extends CustomerAuthApi {
  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async => AuthRequestResult(
    AuthRequestStatus.success,
    tokens: CustomerTokens(
      accessToken: _token('access'),
      refreshToken: _token('refresh'),
    ),
  );
}

class _PaymentApi extends CustomerPaymentApi {
  final startResults = <PaymentResult>[];
  final verifyResults = <PaymentResult>[];
  final startAttempts = <String>[];
  final verifyAttempts = <String>[];
  final startOrderIds = <String>[];
  final startMethods = <String>[];

  @override
  Future<PaymentResult> start(
    String token,
    String orderId,
    String method,
    String attemptId,
  ) async {
    startAttempts.add(attemptId);
    startOrderIds.add(orderId);
    startMethods.add(method);
    return startResults.removeAt(0);
  }

  @override
  Future<PaymentResult> verify(
    String token,
    String orderId,
    String method,
    String attemptId,
  ) async {
    verifyAttempts.add(attemptId);
    return verifyResults.removeAt(0);
  }
}

Future<CustomerSession> _session() async {
  final session = createCustomerSession(authApi: _AuthApi());
  await session.restore();
  await session.signIn(email: 'cliente@example.com', password: 'password');
  return session;
}

Map<String, dynamic> _payment(String result, {String method = 'PIX'}) => {
  'tentativaId': 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'pedidoId': orderId,
  'forma': method,
  'resultado': result,
  'valorAplicavel': '20.00',
  'dataTransacao': '2026-10-23T12:00:00.000Z',
};

void main() {
  testWidgets('resultado aprovado usa superfície branca e preserva o estado', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const PaymentResultPage(
          outcome: PaymentOutcome.approved,
          orderNumber: 'PED-123',
          orderId: orderId,
          total: '29.50',
          method: 'Pix',
        ),
      ),
    );

    final card = tester.widget<Card>(find.byType(Card));
    expect(card.color, AppTokens.surface);
    expect(find.text('Pagamento aprovado'), findsNWidgets(2));
    expect(find.text('Total: R\$ 29,50'), findsOneWidget);
    expect(find.text('Forma de pagamento: Pix'), findsOneWidget);
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Ver meu pedido'),
          )
          .onPressed,
      isNotNull,
    );
    expect(find.text('Voltar ao cardápio'), findsOneWidget);
    expect(tester.widget<AppBar>(find.byType(AppBar)).leading, isNull);
    await tester.tap(find.text('Ver meu pedido'));
    await tester.pumpAndSettle();
    expect(find.text('Detalhe do pedido'), findsOneWidget);
    expect(find.text(orderId), findsOneWidget);
  });

  testWidgets('resumo e opções usam a superfície branca do Design System', (
    tester,
  ) async {
    final session = await _session();
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: PaymentPage(
          session: session,
          orderId: orderId,
          orderNumber: 'PED-123',
          total: '20.00',
          paymentApi: _PaymentApi(),
        ),
      ),
    );

    final cards = tester.widgetList<Card>(find.byType(Card)).toList();
    expect(cards, hasLength(2));
    expect(cards.every((card) => card.color == AppTokens.surface), isTrue);
    expect(find.text('Pix'), findsOneWidget);
    expect(find.text('Cartão'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    session.dispose();
  });

  testWidgets('exige método e mostra aprovação confirmada', (tester) async {
    final session = await _session();
    final api = _PaymentApi()
      ..startResults.add(
        PaymentResult(PaymentStatus.success, value: _payment('APROVADO')),
      );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: PaymentPage(
          session: session,
          orderId: orderId,
          orderNumber: 'PED-123',
          total: '20.00',
          paymentApi: api,
        ),
      ),
    );
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
    await tester.tap(find.text('Pix'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNotNull,
    );
    await tester.tap(find.text('Pagar agora'));
    await tester.pumpAndSettle();
    expect(find.byType(PaymentResultPage), findsOneWidget);
    expect(find.text('Pagamento aprovado'), findsNWidgets(2));
    expect(find.text('Forma de pagamento: Pix'), findsOneWidget);
    expect(find.text('Voltar ao cardápio'), findsOneWidget);
    expect(
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(OutlinedButton, 'Ver meu pedido'),
          )
          .onPressed,
      isNotNull,
    );
    expect(api.startAttempts, hasLength(1));
    session.dispose();
  });

  testWidgets('cardápio remove checkout e permite iniciar nova compra', (
    tester,
  ) async {
    var newPurchases = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Column(
            children: [
              const Text('Vitrine principal'),
              const Text('A vitrine continua disponível'),
              ElevatedButton(
                onPressed: () => newPurchases++,
                child: const Text('Iniciar nova compra'),
              ),
              ElevatedButton(
                onPressed: () =>
                    Navigator.of(
                      tester.element(find.text('Vitrine principal')),
                    ).push<void>(
                      MaterialPageRoute<void>(
                        builder: (_) => const PaymentResultPage(
                          outcome: PaymentOutcome.approved,
                          orderNumber: 'PED-123',
                          orderId: orderId,
                          total: '20.00',
                        ),
                      ),
                    ),
                child: const Text('Abrir checkout'),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.tap(find.text('Abrir checkout'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Voltar ao cardápio'));
    await tester.pumpAndSettle();
    expect(find.text('Vitrine principal'), findsOneWidget);
    expect(find.byType(PaymentResultPage), findsNothing);
    await tester.tap(find.text('Iniciar nova compra'));
    await tester.pump();
    expect(newPurchases, 1);
  });

  testWidgets('back não reabre checkout depois de pagamento aprovado', (
    tester,
  ) async {
    final session = await _session();
    final api = _PaymentApi()
      ..startResults.add(
        PaymentResult(PaymentStatus.success, value: _payment('APROVADO')),
      );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => Column(
              children: [
                const Text('Vitrine principal'),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).push<void>(
                    MaterialPageRoute<void>(
                      builder: (_) => PaymentPage(
                        session: session,
                        orderId: orderId,
                        orderNumber: 'PED-123',
                        total: '20.00',
                        paymentApi: api,
                      ),
                    ),
                  ),
                  child: const Text('Iniciar checkout'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Iniciar checkout'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pix'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pagar agora'));
    await tester.pumpAndSettle();
    expect(find.byType(PaymentPage), findsNothing);
    expect(find.byType(PaymentResultPage), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Vitrine principal'), findsNothing);
    expect(find.byType(PaymentResultPage), findsOneWidget);
    expect(find.byType(PaymentPage), findsNothing);
    await tester.tap(find.text('Voltar ao cardápio'));
    await tester.pumpAndSettle();
    expect(find.text('Vitrine principal'), findsOneWidget);
    expect(find.byType(PaymentResultPage), findsNothing);
    session.dispose();
  });

  testWidgets(
    'resultado incerto consulta a mesma tentativa antes de nova tentativa',
    (tester) async {
      final session = await _session();
      final api = _PaymentApi()
        ..startResults.add(const PaymentResult(PaymentStatus.timeout))
        ..verifyResults.add(
          PaymentResult(
            PaymentStatus.success,
            value: _payment('RECUSADO', method: 'CARTAO'),
          ),
        );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: PaymentPage(
            session: session,
            orderId: orderId,
            orderNumber: 'PED-123',
            total: '20.00',
            paymentApi: api,
          ),
        ),
      );
      await tester.tap(find.text('Cartão'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pagar agora'));
      await tester.pumpAndSettle();
      expect(find.byType(PaymentResultPage), findsOneWidget);
      expect(find.text('Resultado não confirmado'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsNothing);
      await tester.tap(find.text('Verificar tentativa'));
      await tester.pumpAndSettle();
      expect(api.verifyAttempts, [api.startAttempts.single]);
      expect(
        find.text(
          'Pagamento não aprovado. Você pode tentar novamente com este pedido.',
        ),
        findsOneWidget,
      );
      expect(find.byType(PaymentResultPage), findsOneWidget);
      expect(find.text('Forma de pagamento: Cartão'), findsOneWidget);
      session.dispose();
    },
  );

  testWidgets('recusa permite retry com mesmo pedido e nova tentativa', (
    tester,
  ) async {
    final session = await _session();
    final api = _PaymentApi()
      ..startResults.addAll([
        PaymentResult(PaymentStatus.success, value: _payment('RECUSADO')),
        PaymentResult(
          PaymentStatus.success,
          value: _payment('RECUSADO', method: 'CARTAO'),
        ),
      ]);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: PaymentPage(
          session: session,
          orderId: orderId,
          orderNumber: 'PED-123',
          total: '20.00',
          paymentApi: api,
        ),
      ),
    );
    await tester.tap(find.text('Pix'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pagar agora'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cartão'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pagar agora'));
    await tester.pumpAndSettle();
    expect(api.startOrderIds, [orderId, orderId]);
    expect(api.startMethods, ['pix', 'cartao']);
    expect(api.startAttempts, hasLength(2));
    expect(api.startAttempts[0], isNot(api.startAttempts[1]));
    session.dispose();
  });

  testWidgets('mantém os dados acessíveis em larguras e escalas previstas', (
    tester,
  ) async {
    for (final width in [320.0, 390.0, 430.0]) {
      for (final scale in [1.0, 2.0]) {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1;
        final session = await _session();
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: PaymentPage(
              session: session,
              orderId: orderId,
              orderNumber: 'PED-123',
              total: '1200.00',
              paymentApi: _PaymentApi(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Pagar agora'));
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: const PaymentResultPage(
              outcome: PaymentOutcome.approved,
              orderNumber: 'PED-123456789',
              orderId: orderId,
              total: '1234.56',
              method: 'Cartão',
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Voltar ao cardápio'));
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        session.dispose();
      }
    }
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
