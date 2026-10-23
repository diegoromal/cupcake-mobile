import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/core/design/app_theme.dart';
import 'package:cupcake_mobile/features/address/data/customer_address_api.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/cart/data/customer_cart_api.dart';
import 'package:cupcake_mobile/features/cart/presentation/cart_page.dart';
import 'package:cupcake_mobile/features/catalog/data/customer_catalog_api.dart';
import 'package:cupcake_mobile/features/checkout/presentation/fulfillment_page.dart';
import 'package:cupcake_mobile/features/checkout/data/customer_order_api.dart';
import 'package:cupcake_mobile/features/checkout/presentation/order_review_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

String token(String jti) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': id, 'perfil': 'CLIENTE', 'type': jti == 'refresh' ? 'refresh' : 'access', 'jti': jti, 'iat': now, 'exp': now + 3600})}.signature';
}

class FakeAuth extends CustomerAuthApi {
  int refreshCalls = 0;
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
    refreshCalls++;
    return AuthRequestResult(
      AuthRequestStatus.success,
      accessToken: token('new'),
    );
  }
}

Future<CustomerSession> session(FakeAuth auth) async {
  final result = CustomerSession(
    authApi: auth,
    storage: MemorySessionStorage(),
  );
  await result.restore();
  await result.signIn(email: 'cliente@example.com', password: 'senha');
  result.setForeground(false);
  return result;
}

CustomerAddress address(String addressId, {String street = 'Rua das Flores'}) =>
    CustomerAddress(
      id: addressId,
      street: street,
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      cep: '01001000',
      complement: null,
      reference: null,
      located: true,
    );

class FakeAddressApi extends CustomerAddressApi {
  List<CustomerAddress> addresses = [
    address(id),
    address(id2, street: 'Rua Dois'),
  ];
  final calls = <String>[];
  final responses = <Future<AddressResult<CoverageFreight>>>[];
  int listCalls = 0;
  @override
  Future<AddressResult<List<CustomerAddress>>> list(String token) async {
    listCalls++;
    return AddressResult(AddressStatus.success, value: addresses);
  }

  @override
  Future<AddressResult<CoverageFreight>> coverageFreight(
    String token,
    String addressId,
  ) {
    calls.add(addressId);
    return responses.isEmpty
        ? Future.value(
            const AddressResult(
              AddressStatus.success,
              value: CoverageFreight(CoverageSituation.attended, '12.34'),
            ),
          )
        : responses.removeAt(0);
  }
}

class FakeCartApi extends CustomerCartApi {
  FakeCartApi(this.cart);
  final CustomerCart cart;
  @override
  Future<CartResult> fetchCart({required String accessToken}) async =>
      CartResult(CartRequestStatus.success, cart: cart);
}

class FakeCatalogApi extends CustomerCatalogApi {}

class FakeOrderApi extends CustomerOrderApi {
  int reviews = 0, confirmations = 0;
  bool timeoutFirst = false;
  final attemptIds = <String>[];
  String? selectedMode, selectedAddress;
  @override
  Future<OrderResult> review(
    String token,
    String mode,
    String? addressId,
  ) async {
    reviews++;
    selectedMode = mode;
    selectedAddress = addressId;
    return OrderResult(
      OrderStatus.success,
      value: {
        'revisaoId': 'a' * 64,
        'modalidade': mode,
        'enderecoId': addressId,
        'enderecoEntregaSnapshot': mode == 'ENTREGA'
            ? {
                'rua': 'Rua das Flores',
                'numero': '123',
                'bairro': 'Centro',
                'cidade': 'São Paulo',
                'cep': '01001000',
              }
            : null,
        'itens': [
          {
            'produtoId': id2,
            'nome': 'Cupcake',
            'quantidade': 1,
            'precoAplicado': '10.00',
            'subtotalAplicado': '10.00',
            'personalizacoes': [],
          },
        ],
        'valorItens': '10.00',
        'freteAplicado': mode == 'ENTREGA' ? '12.34' : '0.00',
        'total': mode == 'ENTREGA' ? '22.34' : '10.00',
      },
    );
  }

  @override
  Future<OrderResult> confirm(
    String token,
    String mode,
    String? addressId,
    String attemptId,
    String reviewId,
  ) async {
    confirmations++;
    attemptIds.add(attemptId);
    if (timeoutFirst && confirmations == 1) {
      return const OrderResult(OrderStatus.timeout);
    }
    return const OrderResult(
      OrderStatus.success,
      value: {'id': id, 'identificadorNegocio': 'PED-1', 'total': '10.00'},
    );
  }
}

Widget app(
  CustomerSession session,
  FakeAddressApi api, {
  bool cart = false,
  CustomerCart? contents,
  CustomerOrderApi? orderApi,
}) => MaterialApp(
  theme: AppTheme.light,
  home: cart
      ? CartPage(
          session: session,
          cartApi: FakeCartApi(contents!),
          catalogApi: FakeCatalogApi(),
          addressApi: api,
          orderApi: orderApi,
        )
      : FulfillmentPage(session: session, addressApi: api, orderApi: orderApi),
);

Future<void> choose(WidgetTester tester, String label) async {
  await tester.ensureVisible(find.text(label).first);
  await tester.tap(find.text(label).first);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('carrinho elegível abre Fulfillment e volta à mesma instância', (
    tester,
  ) async {
    final auth = FakeAuth();
    final userSession = await session(auth);
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    final cart = CustomerCart(
      id: id,
      items: [
        CartItem(
          id: id,
          productId: id2,
          name: 'Cupcake',
          imageAvailable: false,
          quantity: 1,
          personalizations: const [],
          unitPrice: '10.00',
          subtotal: '10.00',
          available: true,
          reason: null,
        ),
      ],
      subtotal: '10.00',
      total: '10.00',
    );
    await tester.pumpWidget(app(userSession, api, cart: true, contents: cart));
    await tester.pumpAndSettle();
    final oldState = tester.state(find.byType(CartPage));
    await tester.ensureVisible(find.widgetWithText(FilledButton, 'Continuar'));
    await tester.tap(find.widgetWithText(FilledButton, 'Continuar'));
    await tester.pumpAndSettle();
    expect(find.byType(FulfillmentPage), findsOneWidget);
    expect(find.byType(CartPage, skipOffstage: false), findsOneWidget);
    expect(api.calls, isEmpty);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(tester.state(find.byType(CartPage)), same(oldState));
  });

  testWidgets('carrinho vazio bloqueia Continuar', (tester) async {
    final userSession = await session(FakeAuth());
    addTearDown(userSession.dispose);
    await tester.pumpWidget(
      app(
        userSession,
        FakeAddressApi(),
        cart: true,
        contents: const CustomerCart(id: null, items: []),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Continuar'))
          .onPressed,
      isNull,
    );
  });

  testWidgets(
    'retirada não consulta cobertura e entrega exige seleção explícita',
    (tester) async {
      final userSession = await session(FakeAuth());
      addTearDown(userSession.dispose);
      final api = FakeAddressApi();
      await tester.pumpWidget(app(userSession, api));
      expect(
        tester
            .getSize(find.byType(RadioListTile<FulfillmentMode>).first)
            .height,
        greaterThanOrEqualTo(48),
      );
      await choose(tester, 'Retirada');
      expect(
        find.text('Retirada selecionada. Frete: R\$ 0,00'),
        findsOneWidget,
      );
      expect(api.listCalls, 0);
      expect(api.calls, isEmpty);
      await choose(tester, 'Delivery');
      expect(api.listCalls, 1);
      expect(api.calls, isEmpty);
      expect(find.text('Rua das Flores, 123'), findsOneWidget);
      expect(
        tester.getSize(find.byType(RadioListTile<String>).first).height,
        greaterThanOrEqualTo(48),
      );
      expect(
        tester
            .getSize(find.widgetWithText(OutlinedButton, 'Meus endereços'))
            .height,
        greaterThanOrEqualTo(48),
      );
      await choose(tester, 'Rua das Flores, 123');
      expect(api.calls, [id]);
      expect(find.text('Entrega disponível. Frete: R\$ 12,34'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Continuar'),
            )
            .onPressed,
        isNotNull,
      );
      expect(
        tester.getSize(find.widgetWithText(FilledButton, 'Continuar')).height,
        greaterThanOrEqualTo(48),
      );
      await choose(tester, 'Retirada');
      expect(find.textContaining('Entrega disponível'), findsNothing);
    },
  );

  testWidgets('troca de endereço e modalidade descarta respostas antigas', (
    tester,
  ) async {
    final userSession = await session(FakeAuth());
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    final old = Completer<AddressResult<CoverageFreight>>();
    api.responses.add(old.future);
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    await choose(tester, 'Rua Dois, 123');
    expect(find.text('Entrega disponível. Frete: R\$ 12,34'), findsOneWidget);
    old.complete(
      const AddressResult(
        AddressStatus.success,
        value: CoverageFreight(CoverageSituation.outsideCoverage, null),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Entrega disponível. Frete: R\$ 12,34'), findsOneWidget);
    final stale = Completer<AddressResult<CoverageFreight>>();
    api.responses.add(stale.future);
    await choose(tester, 'Rua das Flores, 123');
    await choose(tester, 'Retirada');
    stale.complete(
      const AddressResult(
        AddressStatus.success,
        value: CoverageFreight(CoverageSituation.attended, '99.99'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('99,99'), findsNothing);
  });

  testWidgets('estados de cobertura, erro e retry manual', (tester) async {
    final userSession = await session(FakeAuth());
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    api.responses.addAll([
      Future.value(
        const AddressResult(
          AddressStatus.success,
          value: CoverageFreight(CoverageSituation.outsideCoverage, null),
        ),
      ),
      Future.value(
        const AddressResult(
          AddressStatus.success,
          value: CoverageFreight(CoverageSituation.locationUnavailable, null),
        ),
      ),
      Future.value(const AddressResult(AddressStatus.configurationUnavailable)),
      Future.value(const AddressResult(AddressStatus.networkError)),
      Future.value(
        const AddressResult(
          AddressStatus.success,
          value: CoverageFreight(CoverageSituation.attended, '123456789.01'),
        ),
      ),
    ]);
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    expect(find.text('Endereço fora da área de entrega.'), findsOneWidget);
    await choose(tester, 'Rua Dois, 123');
    expect(find.textContaining('Localização indisponível'), findsOneWidget);
    await choose(tester, 'Rua das Flores, 123');
    expect(find.textContaining('Entrega indisponível'), findsOneWidget);
    await choose(tester, 'Tentar novamente');
    expect(find.textContaining('Sem conexão'), findsOneWidget);
    await choose(tester, 'Tentar novamente');
    expect(
      find.text('Entrega disponível. Frete: R\$ 123.456.789,01'),
      findsOneWidget,
    );
  });

  testWidgets('403 não repete; 404 limpa seleção e recarrega', (tester) async {
    final userSession = await session(FakeAuth());
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    api.responses.addAll([
      Future.value(const AddressResult(AddressStatus.forbidden)),
      Future.value(const AddressResult(AddressStatus.notFound)),
    ]);
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    expect(find.textContaining('não tem acesso'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
    await choose(tester, 'Rua Dois, 123');
    expect(api.listCalls, 2);
    expect(api.calls, [id, id2]);
  });

  testWidgets('401 renova uma vez e tenta novamente', (tester) async {
    final auth = FakeAuth();
    final userSession = await session(auth);
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    api.responses.addAll([
      Future.value(const AddressResult(AddressStatus.unauthorized)),
      Future.value(
        const AddressResult(
          AddressStatus.success,
          value: CoverageFreight(CoverageSituation.attended, '8.90'),
        ),
      ),
    ]);
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    expect(auth.refreshCalls, 1);
    expect(api.calls, [id, id]);
    expect(find.text('Entrega disponível. Frete: R\$ 8,90'), findsOneWidget);
  });

  testWidgets('segundo 401 encerra após uma renovação e duas consultas', (
    tester,
  ) async {
    final auth = FakeAuth();
    final userSession = await session(auth);
    addTearDown(userSession.dispose);
    final api = FakeAddressApi()
      ..responses.addAll([
        Future.value(const AddressResult(AddressStatus.unauthorized)),
        Future.value(const AddressResult(AddressStatus.unauthorized)),
      ]);
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    expect(auth.refreshCalls, 1);
    expect(api.calls, [id, id]);
    expect(find.textContaining('Sessão expirada'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
  });

  testWidgets(
    'renovação externa descarta cobertura iniciada com token antigo',
    (tester) async {
      final auth = FakeAuth();
      final userSession = await session(auth);
      addTearDown(userSession.dispose);
      final api = FakeAddressApi();
      final pending = Completer<AddressResult<CoverageFreight>>();
      api.responses.add(pending.future);
      await tester.pumpWidget(app(userSession, api));
      await choose(tester, 'Delivery');
      await choose(tester, 'Rua das Flores, 123');

      await userSession.refreshAfterUnauthorized(userSession.accessToken!);
      await tester.pumpAndSettle();
      expect(auth.refreshCalls, 1);
      expect(api.listCalls, 2);
      expect(find.text('Entrega disponível. Frete: R\$ 12,34'), findsOneWidget);

      pending.complete(
        const AddressResult(
          AddressStatus.success,
          value: CoverageFreight(CoverageSituation.attended, '99.99'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Entrega disponível. Frete: R\$ 12,34'), findsOneWidget);
      expect(find.textContaining('99,99'), findsNothing);
    },
  );

  testWidgets('retorno de Meus endereços recarrega a lista', (tester) async {
    final userSession = await session(FakeAuth());
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    await choose(tester, 'Meus endereços');
    api.addresses = [address(id, street: 'Rua Atualizada')];
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(api.listCalls, 3);
    expect(find.text('Rua Atualizada, 123'), findsOneWidget);
    expect(api.calls, [id, id]);
  });

  testWidgets('perda de sessão descarta endereço e resposta pendente', (
    tester,
  ) async {
    final userSession = await session(FakeAuth());
    addTearDown(userSession.dispose);
    final api = FakeAddressApi();
    final pending = Completer<AddressResult<CoverageFreight>>();
    api.responses.add(pending.future);
    await tester.pumpWidget(app(userSession, api));
    await choose(tester, 'Delivery');
    await choose(tester, 'Rua das Flores, 123');
    await userSession.signOut();
    pending.complete(
      const AddressResult(
        AddressStatus.success,
        value: CoverageFreight(CoverageSituation.attended, '12.34'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Rua das Flores, 123'), findsNothing);
    expect(find.textContaining('12,34'), findsNothing);
    expect(find.textContaining('Sessão expirada'), findsOneWidget);
  });

  testWidgets('responsividade 320, 390, 430 e escala 1/2 sem overflow', (
    tester,
  ) async {
    for (final width in [320.0, 390.0, 430.0]) {
      for (final scale in [1.0, 2.0]) {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1;
        final userSession = await session(FakeAuth());
        final api = FakeAddressApi()
          ..addresses = [
            address(
              id,
              street:
                  'Rua com nome bastante longo e detalhado para testar a leitura completa',
            ),
            address(id2, street: 'Outro endereço com nome extenso'),
          ]
          ..responses.addAll([
            Future.value(
              const AddressResult(
                AddressStatus.success,
                value: CoverageFreight(
                  CoverageSituation.attended,
                  '999999999999.99',
                ),
              ),
            ),
            Future.value(
              const AddressResult(
                AddressStatus.success,
                value: CoverageFreight(
                  CoverageSituation.locationUnavailable,
                  null,
                ),
              ),
            ),
          ]);
        await tester.pumpWidget(
          MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(scale)),
            child: app(userSession, api),
          ),
        );
        expect(
          MediaQuery.textScalerOf(
            tester.element(find.byType(FulfillmentPage)),
          ).scale(10),
          10 * scale,
        );
        await choose(tester, 'Delivery');
        await choose(
          tester,
          'Rua com nome bastante longo e detalhado para testar a leitura completa, 123',
        );
        expect(find.textContaining('999.999.999.999,99'), findsOneWidget);
        await choose(tester, 'Outro endereço com nome extenso, 123');
        expect(find.textContaining('Localização indisponível'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        userSession.dispose();
      }
    }
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  for (final previousMode in ['Delivery', 'Retirada']) {
    testWidgets(
      'Fulfillment preserva nova escolha após timeout em $previousMode',
      (tester) async {
        final userSession = await session(FakeAuth());
        addTearDown(userSession.dispose);
        final orderApi = FakeOrderApi()..timeoutFirst = true;
        await tester.pumpWidget(
          app(userSession, FakeAddressApi(), orderApi: orderApi),
        );
        await choose(tester, previousMode);
        if (previousMode == 'Delivery') {
          await choose(tester, 'Rua das Flores, 123');
        }
        await choose(tester, 'Continuar');
        await choose(tester, 'Confirmar pedido');
        final oldAttempt = userSession.pendingOrderConfirmation!.attemptId;
        await tester.pageBack();
        await tester.pumpAndSettle();
        final nextMode = previousMode == 'Delivery' ? 'Retirada' : 'Delivery';
        await choose(tester, nextMode);
        if (nextMode == 'Delivery') {
          await choose(tester, 'Rua das Flores, 123');
        }
        await choose(tester, 'Continuar');
        expect(find.text('Confirmação anterior pendente'), findsOneWidget);
        expect(userSession.pendingOrderConfirmation!.attemptId, oldAttempt);
        expect(orderApi.reviews, 1);
        expect(orderApi.confirmations, 1);
        await choose(tester, 'Resolver confirmação anterior');
        expect(orderApi.attemptIds, [oldAttempt, oldAttempt]);
        await choose(tester, 'Voltar à forma de recebimento');
        expect(find.byType(FulfillmentPage), findsOneWidget);
        expect(
          find.text('Retirada selecionada. Frete: R\$ 0,00'),
          nextMode == 'Retirada' ? findsOneWidget : findsNothing,
        );
        await choose(tester, 'Continuar');
        expect(orderApi.reviews, 2);
        expect(
          orderApi.selectedMode,
          nextMode == 'Delivery' ? 'ENTREGA' : 'RETIRADA',
        );
        await choose(tester, 'Confirmar pedido');
        expect(orderApi.attemptIds.last, isNot(oldAttempt));
      },
    );
  }

  for (final mode in ['Retirada', 'Delivery']) {
    testWidgets(
      'Carrinho → Fulfillment → Revisão → Confirmar: $mode',
      (tester) async {
        final userSession = await session(FakeAuth());
        addTearDown(userSession.dispose);
        final orderApi = FakeOrderApi();
        final cart = CustomerCart(
          id: id,
          items: [
            CartItem(
              id: id,
              productId: id2,
              name: 'Cupcake',
              imageAvailable: false,
              quantity: 1,
              personalizations: const [],
              unitPrice: '10.00',
              subtotal: '10.00',
              available: true,
              reason: null,
            ),
          ],
          subtotal: '10.00',
          total: '10.00',
        );
        await tester.pumpWidget(
          app(
            userSession,
            FakeAddressApi(),
            cart: true,
            contents: cart,
            orderApi: orderApi,
          ),
        );
        await tester.pumpAndSettle();
        await choose(tester, 'Continuar');
        expect(find.byType(FulfillmentPage), findsOneWidget);
        await choose(tester, mode);
        if (mode == 'Delivery') await choose(tester, 'Rua das Flores, 123');
        await choose(tester, 'Continuar');
        expect(find.byType(OrderReviewPage), findsOneWidget);
        expect(orderApi.confirmations, 0);
        expect(
          orderApi.selectedMode,
          mode == 'Delivery' ? 'ENTREGA' : 'RETIRADA',
        );
        expect(orderApi.selectedAddress, mode == 'Delivery' ? id : null);
        await choose(tester, 'Confirmar pedido');
        expect(orderApi.reviews, 1);
        expect(orderApi.confirmations, 1);
        expect(find.textContaining(id), findsOneWidget);
        await tester.pageBack();
        await tester.pumpAndSettle();
        expect(find.byType(FulfillmentPage), findsOneWidget);
        await tester.pageBack();
        await tester.pumpAndSettle();
        expect(find.byType(CartPage), findsOneWidget);
      },
    );
  }
}
