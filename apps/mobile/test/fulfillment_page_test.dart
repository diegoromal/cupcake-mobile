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

Widget app(
  CustomerSession session,
  FakeAddressApi api, {
  bool cart = false,
  CustomerCart? contents,
}) => MaterialApp(
  theme: AppTheme.light,
  home: cart
      ? CartPage(
          session: session,
          cartApi: FakeCartApi(contents!),
          catalogApi: FakeCatalogApi(),
          addressApi: api,
        )
      : FulfillmentPage(session: session, addressApi: api),
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
        isNull,
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

      await userSession.refreshAfterUnauthorized(token('old'));
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
}
