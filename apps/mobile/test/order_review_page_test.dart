import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/core/design/app_tokens.dart';
import 'package:cupcake_mobile/core/design/app_theme.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/checkout/data/customer_order_api.dart';
import 'package:cupcake_mobile/features/checkout/presentation/order_review_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

String token(String name) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String part(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${part({'alg': 'HS256'})}.${part({'sub': userId, 'perfil': 'CLIENTE', 'type': name == 'refresh' ? 'refresh' : 'access', 'jti': name, 'iat': now, 'exp': now + 3600})}.signature';
}

class FakeAuth extends CustomerAuthApi {
  int refreshes = 0;
  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async => AuthRequestResult(
    AuthRequestStatus.success,
    tokens: CustomerTokens(
      accessToken: token('old'),
      refreshToken: token('refresh'),
    ),
  );
  @override
  Future<AuthRequestResult> refresh(String refreshToken) async {
    refreshes++;
    return AuthRequestResult(
      AuthRequestStatus.success,
      accessToken: token('new'),
    );
  }
}

class FakeOrderApi extends CustomerOrderApi {
  final reviewResults = <OrderResult>[];
  final confirmResults = <OrderResult>[];
  Completer<OrderResult>? reviewPending;
  Completer<OrderResult>? confirmPending;
  final reviewTokens = <String>[];
  final confirmTokens = <String>[];
  final attemptIds = <String>[];
  final reviewIds = <String>[];
  final reviewModes = <String>[];
  final confirmModes = <String>[];
  final confirmAddresses = <String?>[];
  bool timeoutAfterCreation = false;
  bool timeoutBeforeCreation = false;
  final createdAttempts = <String>{};
  int reservations = 0;
  @override
  Future<OrderResult> review(String token, String mode, String? addressId) {
    reviewTokens.add(token);
    reviewModes.add(mode);
    if (reviewPending != null) return reviewPending!.future;
    return Future.value(reviewResults.removeAt(0));
  }

  @override
  Future<OrderResult> confirm(
    String token,
    String mode,
    String? addressId,
    String attemptId,
    String reviewId,
  ) {
    confirmTokens.add(token);
    confirmModes.add(mode);
    confirmAddresses.add(addressId);
    attemptIds.add(attemptId);
    reviewIds.add(reviewId);
    if (timeoutAfterCreation || timeoutBeforeCreation) {
      if (timeoutAfterCreation || attemptIds.length > 1) {
        if (createdAttempts.add(attemptId)) reservations++;
      }
      if (attemptIds.length == 1) {
        return Future.value(const OrderResult(OrderStatus.timeout));
      }
      return Future.value(
        OrderResult(
          OrderStatus.success,
          value: {
            'id': userId,
            'identificadorNegocio': 'PED-$attemptId',
            'total': '20.00',
          },
        ),
      );
    }
    if (confirmPending != null) return confirmPending!.future;
    return Future.value(confirmResults.removeAt(0));
  }
}

Map<String, dynamic> preview({String mode = 'RETIRADA'}) => {
  'revisaoId': 'a' * 64,
  'modalidade': mode,
  'enderecoId': mode == 'ENTREGA' ? userId : null,
  'enderecoEntregaSnapshot': mode == 'ENTREGA'
      ? {
          'rua': 'Rua A',
          'numero': '1',
          'bairro': 'Centro',
          'cidade': 'São Paulo',
          'cep': '01001000',
        }
      : null,
  'itens': [
    {
      'produtoId': userId,
      'nome': 'Cupcake',
      'quantidade': 2,
      'precoAplicado': '10.00',
      'subtotalAplicado': '20.00',
      'personalizacoes': [
        {'nomeAplicado': 'Cobertura'},
      ],
    },
  ],
  'valorItens': '20.00',
  'freteAplicado': mode == 'ENTREGA' ? '3.00' : '0.00',
  'total': mode == 'ENTREGA' ? '23.00' : '20.00',
};

Future<CustomerSession> session(FakeAuth auth) async {
  final result = CustomerSession(
    authApi: auth,
    storage: MemorySessionStorage(),
  );
  await result.restore();
  await result.signIn(email: 'cliente@example.test', password: 'senha');
  result.setForeground(false);
  return result;
}

Future<void> open(
  WidgetTester tester,
  CustomerSession session,
  FakeOrderApi api, {
  String mode = 'RETIRADA',
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: OrderReviewPage(
        session: session,
        mode: mode,
        addressId: mode == 'ENTREGA' ? userId : null,
        orderApi: api,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'CTA mostra o total calculado pela revisão em formato monetário',
    (tester) async {
      final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
      api.reviewResults.add(
        OrderResult(OrderStatus.success, value: preview(mode: 'ENTREGA')),
      );

      await open(tester, sessionValue, api, mode: 'ENTREGA');

      final button = find.byType(FilledButton).last;
      expect(
        find.descendant(of: button, matching: find.text('R\$ 23,00')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: button, matching: find.text('Confirmar pedido')),
        findsOneWidget,
      );
    },
  );

  for (final previousMode in ['ENTREGA', 'RETIRADA']) {
    for (final createdBeforeTimeout in [true, false]) {
      testWidgets(
        '$previousMode com timeout e nova intenção ${previousMode == 'ENTREGA' ? 'RETIRADA' : 'ENTREGA'}; servidor ${createdBeforeTimeout ? 'já criou' : 'ainda não criou'}',
        (tester) async {
          final currentMode = previousMode == 'ENTREGA'
              ? 'RETIRADA'
              : 'ENTREGA';
          final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
          api.timeoutAfterCreation = createdBeforeTimeout;
          api.timeoutBeforeCreation = !createdBeforeTimeout;
          final nextReview = preview(mode: currentMode)
            ..['revisaoId'] = 'b' * 64;
          api.reviewResults.addAll([
            OrderResult(
              OrderStatus.success,
              value: preview(mode: previousMode),
            ),
            OrderResult(OrderStatus.success, value: nextReview),
          ]);
          await open(tester, sessionValue, api, mode: previousMode);
          await tester.tap(find.text('Confirmar pedido'));
          await tester.pumpAndSettle();
          final previousAttempt = api.attemptIds.single;
          expect(
            sessionValue.pendingOrderConfirmation?.attemptId,
            previousAttempt,
          );
          await tester.pumpWidget(const SizedBox());
          await open(tester, sessionValue, api, mode: currentMode);
          expect(find.text('Confirmação anterior pendente'), findsOneWidget);
          expect(find.text('Confirmar pedido'), findsNothing);
          expect(api.reviewModes, [previousMode]);
          expect(api.attemptIds, [previousAttempt]);
          expect(
            sessionValue.pendingOrderConfirmation?.attemptId,
            previousAttempt,
          );
          expect(api.reservations, createdBeforeTimeout ? 1 : 0);
          await tester.tap(find.text('Resolver confirmação anterior'));
          await tester.pumpAndSettle();
          expect(api.attemptIds, [previousAttempt, previousAttempt]);
          expect(api.confirmModes, [previousMode, previousMode]);
          expect(api.reservations, 1);
          expect(sessionValue.pendingOrderConfirmation, isNull);
          expect(
            find.textContaining('Pedido anterior confirmado'),
            findsOneWidget,
          );
          await tester.pumpWidget(const SizedBox());
          await open(tester, sessionValue, api, mode: currentMode);
          expect(api.reviewModes, [previousMode, currentMode]);
          expect(
            find.text(currentMode == 'ENTREGA' ? 'Delivery' : 'Retirada'),
            findsOneWidget,
          );
          expect(
            find.text(
              'Frete: R\$ ${currentMode == 'ENTREGA' ? '3.00' : '0.00'}',
            ),
            findsOneWidget,
          );
          await tester.tap(find.text('Confirmar pedido'));
          await tester.pumpAndSettle();
          expect(api.attemptIds.last, isNot(previousAttempt));
          expect(api.reviewIds, ['a' * 64, 'a' * 64, 'b' * 64]);
          expect(api.confirmModes.last, currentMode);
          expect(
            api.confirmAddresses.last,
            currentMode == 'ENTREGA' ? userId : null,
          );
          expect(api.reservations, 2);
        },
      );
    }
  }
  for (final createdBeforeTimeout in [true, false]) {
    testWidgets(
      'timeout e retorno reutilizam tentativa; pedido ${createdBeforeTimeout ? 'já criado' : 'ainda não criado'}',
      (tester) async {
        final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
        api.timeoutAfterCreation = createdBeforeTimeout;
        api.timeoutBeforeCreation = !createdBeforeTimeout;
        api.reviewResults.add(
          OrderResult(OrderStatus.success, value: preview()),
        );
        await open(tester, sessionValue, api);
        await tester.tap(find.text('Confirmar pedido'));
        await tester.pumpAndSettle();
        expect(find.textContaining('A resposta demorou'), findsOneWidget);
        expect(
          sessionValue.pendingOrderConfirmation?.attemptId,
          api.attemptIds.single,
        );
        await tester.pumpWidget(const SizedBox());
        await open(tester, sessionValue, api);
        expect(api.reviewTokens, hasLength(1));
        await tester.tap(find.text('Confirmar pedido'));
        await tester.pumpAndSettle();
        expect(api.attemptIds, [api.attemptIds.first, api.attemptIds.first]);
        expect(api.reservations, 1);
        expect(
          find.text('Pedido PED-${api.attemptIds.first}'),
          findsNWidgets(2),
        );
        expect(sessionValue.pendingOrderConfirmation, isNull);
      },
    );
  }
  testWidgets('Retirada carrega prévia e segue ao pagamento do pedido criado', (
    tester,
  ) async {
    final auth = FakeAuth(), api = FakeOrderApi();
    final sessionValue = await session(auth);
    api.reviewResults.add(OrderResult(OrderStatus.success, value: preview()));
    api.confirmResults.add(
      const OrderResult(
        OrderStatus.success,
        value: {
          'id': userId,
          'identificadorNegocio': 'PED-1',
          'total': '20.00',
        },
      ),
    );
    await open(tester, sessionValue, api);
    expect(find.text('Frete: R\$ 0.00'), findsOneWidget);
    expect(api.confirmTokens, isEmpty);
    await tester.tap(find.text('Confirmar pedido'));
    await tester.pumpAndSettle();
    expect(find.text('Pedido PED-1'), findsNWidgets(2));
    expect(api.confirmTokens, hasLength(1));
    expect(api.attemptIds.single, matches(RegExp(r'^[a-f0-9-]{36}$')));
  });

  testWidgets(
    'Delivery mostra endereço, frete e loading; bloqueia duplo toque',
    (tester) async {
      final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
      api.reviewPending = Completer<OrderResult>();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: OrderReviewPage(
            session: sessionValue,
            mode: 'ENTREGA',
            addressId: userId,
            orderApi: api,
          ),
        ),
      );
      await tester.pump();
      expect(find.text('Carregando revisão…'), findsOneWidget);
      api.reviewPending!.complete(
        OrderResult(OrderStatus.success, value: preview(mode: 'ENTREGA')),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('Rua A'), findsOneWidget);
      expect(find.text('Frete: R\$ 3.00'), findsOneWidget);
      api.confirmPending = Completer<OrderResult>();
      await tester.tap(find.text('Confirmar pedido'));
      await tester.pump();
      expect(find.text('Processando pedido…'), findsOneWidget);
      expect(
        tester
            .widget<TextButton>(find.widgetWithText(TextButton, 'Alterar'))
            .onPressed,
        isNull,
      );
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      api.confirmPending!.complete(
        const OrderResult(
          OrderStatus.success,
          value: {
            'id': userId,
            'identificadorNegocio': 'PED-1',
            'total': '23.00',
          },
        ),
      );
      await tester.pumpAndSettle();
      expect(api.confirmTokens, hasLength(1));
      expect(find.text('Pedido PED-1'), findsNWidgets(2));
    },
  );

  testWidgets('409 preserva contexto e atualiza revisão', (tester) async {
    final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
    final updated = preview()..['revisaoId'] = 'b' * 64;
    api.reviewResults.addAll([
      OrderResult(OrderStatus.success, value: preview()),
      OrderResult(OrderStatus.success, value: updated),
    ]);
    api.confirmResults.addAll([
      const OrderResult(OrderStatus.conflict),
      const OrderResult(OrderStatus.success, value: {'id': userId}),
    ]);
    await open(tester, sessionValue, api);
    await tester.tap(find.text('Confirmar pedido'));
    await tester.pumpAndSettle();
    final rejectedAttempt = api.attemptIds.single;
    expect(sessionValue.pendingOrderConfirmation, isNull);
    expect(find.text('Cupcake'), findsOneWidget);
    expect(find.text('Atualizar revisão'), findsOneWidget);
    await tester.tap(find.text('Atualizar revisão'));
    await tester.pumpAndSettle();
    expect(api.reviewTokens, hasLength(2));
    expect(find.text('Confirmar pedido'), findsOneWidget);
    await tester.tap(find.text('Confirmar pedido'));
    await tester.pumpAndSettle();
    expect(api.attemptIds, hasLength(2));
    expect(api.attemptIds.last, isNot(rejectedAttempt));
    expect(api.reviewIds, ['a' * 64, 'b' * 64]);
    expect(sessionValue.pendingOrderConfirmation, isNull);
  });

  testWidgets(
    '401 renova uma vez; 403, 404, 503, timeout, JSON inválido e conexão mostram erro',
    (tester) async {
      for (final status in [
        OrderStatus.forbidden,
        OrderStatus.notFound,
        OrderStatus.unavailable,
        OrderStatus.timeout,
        OrderStatus.invalidResponse,
        OrderStatus.networkError,
      ]) {
        final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
        api.reviewResults.add(OrderResult(status));
        await open(tester, sessionValue, api);
        expect(
          find.text('Tentar novamente'),
          status == OrderStatus.forbidden ? findsNothing : findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox());
      }
      final auth = FakeAuth(), api = FakeOrderApi();
      final sessionValue = await session(auth);
      api.reviewResults.addAll([
        const OrderResult(OrderStatus.unauthorized),
        OrderResult(OrderStatus.success, value: preview()),
      ]);
      await open(tester, sessionValue, api);
      expect(auth.refreshes, 1);
      expect(api.reviewTokens, hasLength(2));
      expect(find.text('Cupcake'), findsOneWidget);
    },
  );

  testWidgets('resposta antiga não substitui revisão após renovação externa', (
    tester,
  ) async {
    final auth = FakeAuth(), api = FakeOrderApi();
    final sessionValue = await session(auth);
    final pending = Completer<OrderResult>();
    api.reviewPending = pending;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: OrderReviewPage(
          session: sessionValue,
          mode: 'RETIRADA',
          orderApi: api,
        ),
      ),
    );
    await tester.pump();
    api.reviewPending = null;
    api.reviewResults.add(OrderResult(OrderStatus.success, value: preview()));
    await sessionValue.refreshAfterUnauthorized(sessionValue.accessToken!);
    await tester.pumpAndSettle();
    expect(find.text('Cupcake'), findsOneWidget);
    pending.complete(const OrderResult(OrderStatus.conflict));
    await tester.pumpAndSettle();
    expect(find.text('Cupcake'), findsOneWidget);
    expect(find.text('Atualizar revisão'), findsNothing);
    expect(api.reviewTokens, hasLength(2));
  });

  testWidgets('revisão cabe em 320, 390, 430 dp com escala de texto 1 e 2', (
    tester,
  ) async {
    for (final width in [320.0, 390.0, 430.0]) {
      for (final scale in [1.0, 2.0]) {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1;
        final api = FakeOrderApi(), sessionValue = await session(FakeAuth());
        final review = preview(mode: 'ENTREGA');
        if (width == 320 && scale == 2) review['total'] = '1234567.89';
        api.reviewResults.add(OrderResult(OrderStatus.success, value: review));
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(scale)),
              child: child!,
            ),
            home: OrderReviewPage(
              session: sessionValue,
              mode: 'ENTREGA',
              addressId: userId,
              orderApi: api,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.ensureVisible(find.text('Confirmar pedido'));
        expect(tester.takeException(), isNull);
        final cta = find.byType(FilledButton).last;
        expect(
          find.descendant(of: cta, matching: find.text('Confirmar pedido')),
          findsOneWidget,
        );
        expect(
          find.descendant(
            of: cta,
            matching: find.text(
              width == 320 && scale == 2 ? 'R\$ 1234567,89' : 'R\$ 23,00',
            ),
          ),
          findsOneWidget,
        );
        final totalFinder = find.descendant(
          of: cta,
          matching: find.text(
            width == 320 && scale == 2 ? 'R\$ 1234567,89' : 'R\$ 23,00',
          ),
        );
        final actionFinder = find.descendant(
          of: cta,
          matching: find.text('Confirmar pedido'),
        );
        final totalRect = tester.getRect(totalFinder);
        final actionRect = tester.getRect(actionFinder);
        final separated =
            totalRect.right <= actionRect.left ||
            actionRect.right <= totalRect.left ||
            totalRect.bottom <= actionRect.top ||
            actionRect.bottom <= totalRect.top;
        expect(separated, isTrue);
        if (width == 430 && scale == 1) {
          expect(totalRect.left, lessThan(actionRect.left));
          expect(totalRect.right, lessThan(actionRect.left));
        }
        if (width == 320 && scale == 2) {
          expect(totalRect.bottom, lessThanOrEqualTo(actionRect.top));
          expect(tester.widget<Text>(actionFinder).textAlign, TextAlign.end);
        }
        expect(tester.getSize(cta).height, greaterThanOrEqualTo(48));
        expect(tester.widget<FilledButton>(cta).onPressed, isNotNull);
        expect(
          tester.widget<Card>(find.byType(Card).first).color,
          AppTokens.surface,
        );
        await tester.pumpWidget(const SizedBox());
      }
    }
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}
