import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:cupcake_mobile/core/design/app_theme.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/cart/data/customer_cart_api.dart';
import 'package:cupcake_mobile/features/cart/presentation/cart_page.dart';
import 'package:cupcake_mobile/features/catalog/data/customer_catalog_api.dart';
import 'package:cupcake_mobile/features/catalog/presentation/storefront_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _productId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const _itemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const _secondItemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const _optionId = '11111111-1111-4111-8111-111111111111';
const _longName =
    'Cupcake artesanal de chocolate belga com cobertura de frutas vermelhas e nome funcional extenso';
const _longOption =
    'Personalização com descrição visível por completo sem reticências no rótulo';
const _longReason =
    'Quantidade superior à disponibilidade para esta linha isolada, sem remover o item e sem depender apenas da cor do aviso';

String _token(String jti) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': _productId, 'perfil': 'CLIENTE', 'type': jti == 'refresh' ? 'refresh' : 'access', 'jti': jti, 'iat': now, 'exp': now + 3600})}.signature';
}

class _AuthApi extends CustomerAuthApi {
  _AuthApi({this.refreshStatus = AuthRequestStatus.success});
  final AuthRequestStatus refreshStatus;
  int refreshCalls = 0;

  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async => AuthRequestResult(
    AuthRequestStatus.success,
    tokens: CustomerTokens(
      accessToken: _token('old'),
      refreshToken: _token('refresh'),
    ),
  );

  @override
  Future<AuthRequestResult> refresh(String refreshToken) async {
    refreshCalls++;
    return AuthRequestResult(
      refreshStatus,
      accessToken: refreshStatus == AuthRequestStatus.success
          ? _token('new')
          : null,
    );
  }
}

class _Mutation {
  const _Mutation(this.method, this.itemId, this.quantity, this.token);
  final String method;
  final String itemId;
  final int? quantity;
  final String token;
}

class _CartApi extends CustomerCartApi {
  _CartApi(this.responses);
  final List<Future<CartResult>> responses;
  int calls = 0;
  final mutations = <_Mutation>[];
  Future<CartResult> Function(_Mutation mutation)? onMutation;

  @override
  Future<CartResult> fetchCart({required String accessToken}) {
    calls++;
    return responses.removeAt(0);
  }

  @override
  Future<CartResult> updateQuantity({
    required String accessToken,
    required String itemId,
    required int quantity,
  }) {
    final mutation = _Mutation('PATCH', itemId, quantity, accessToken);
    mutations.add(mutation);
    return onMutation?.call(mutation) ??
        Future.value(const CartResult(CartRequestStatus.unavailable));
  }

  @override
  Future<CartResult> removeItem({
    required String accessToken,
    required String itemId,
  }) {
    final mutation = _Mutation('DELETE', itemId, null, accessToken);
    mutations.add(mutation);
    return onMutation?.call(mutation) ??
        Future.value(const CartResult(CartRequestStatus.unavailable));
  }
}

class _CatalogApi extends CustomerCatalogApi {
  _CatalogApi({this.imageStatus = CatalogRequestStatus.unavailable});
  final CatalogRequestStatus imageStatus;
  int imageCalls = 0;
  int pageCalls = 0;
  final imageIds = <String>[];

  @override
  Future<CatalogImageResult> fetchImage({
    required String productId,
    required String accessToken,
  }) async {
    imageCalls++;
    imageIds.add(productId);
    return CatalogImageResult(
      imageStatus,
      bytes: imageStatus == CatalogRequestStatus.success
          ? Uint8List.fromList(const [1, 2, 3])
          : null,
    );
  }

  @override
  Future<CatalogCategoriesResult> fetchCategories({
    required String accessToken,
  }) async => const CatalogCategoriesResult(
    CatalogRequestStatus.success,
    categories: [],
  );

  @override
  Future<CatalogPageResult> fetchPage({
    required String accessToken,
    required int page,
    int limit = 20,
    String? categoryId,
  }) async {
    pageCalls++;
    return CatalogPageResult(
      CatalogRequestStatus.success,
      page: CatalogPage(
        items: const [
          CatalogProduct(
            id: _productId,
            name: 'Nome da vitrine',
            price: '10.00',
            category: CatalogCategory(
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Doces',
            ),
            imageAvailable: false,
          ),
        ],
        page: 1,
        limit: 20,
        hasMore: false,
      ),
    );
  }
}

CartItem _line({
  required String id,
  String name = 'Cupcake de festa',
  int quantity = 1,
  bool imageAvailable = false,
  List<CartPersonalization> personalizations = const [],
  String? unitPrice = '10.00',
  String? subtotal = '10.00',
  bool available = true,
  String? reason,
}) => CartItem(
  id: id,
  productId: _productId,
  name: name,
  imageAvailable: imageAvailable,
  quantity: quantity,
  personalizations: personalizations,
  unitPrice: unitPrice,
  subtotal: subtotal,
  available: available,
  reason: reason,
);

CartResult _cart(
  List<CartItem> items, {
  String? id,
  String subtotal = '10.00',
  String total = '10.00',
}) => CartResult(
  CartRequestStatus.success,
  cart: CustomerCart(
    id: id ?? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    items: items,
    subtotal: items.isEmpty ? '0.00' : subtotal,
    total: items.isEmpty ? '0.00' : total,
  ),
);

Future<CustomerSession> _session(_AuthApi auth) async {
  final session = CustomerSession(
    authApi: auth,
    storage: MemorySessionStorage(),
  );
  await session.restore();
  await session.signIn(email: 'cliente@example.com', password: 'senha');
  session.setForeground(false);
  return session;
}

Future<void> reveal(WidgetTester tester, Finder finder) async {
  final scrollable = find.byType(Scrollable);
  for (
    var attempt = 0;
    attempt < 40 && finder.hitTestable().evaluate().isEmpty;
    attempt++
  ) {
    await tester.drag(scrollable.first, const Offset(0, -160));
    await tester.pumpAndSettle();
  }
}

Future<void> tapVisible(WidgetTester tester, Finder finder) async {
  await reveal(tester, finder);
  await tester.tap(finder.hitTestable());
}

Widget _app({
  required CustomerSession session,
  required CustomerCartApi cartApi,
  required CustomerCatalogApi catalogApi,
  double scale = 1,
  bool storefront = false,
}) => MaterialApp(
  theme: AppTheme.light,
  home: MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(scale)),
    child: storefront
        ? StorefrontPage(session: session, api: catalogApi, cartApi: cartApi)
        : CartPage(session: session, cartApi: cartApi, catalogApi: catalogApi),
  ),
);

void main() {
  testWidgets('loading não parece carrinho vazio', (tester) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final pending = Completer<CartResult>();
    final cartApi = _CartApi([pending.future]);
    await tester.pumpWidget(
      _app(session: session, cartApi: cartApi, catalogApi: _CatalogApi()),
    );
    expect(find.text('Carrinho'), findsOneWidget);
    expect(find.bySemanticsLabel('Carregando carrinho…'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Seu carrinho está vazio.'), findsNothing);
    expect(find.text('ITENS SELECIONADOS (0)'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    pending.complete(const CartResult(CartRequestStatus.unavailable));
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('vazio sem preço oferece Continuar comprando e Continuar morto', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final catalog = _CatalogApi();
    final cartApi = _CartApi([
      Future.value(
        const CartResult(
          CartRequestStatus.success,
          cart: CustomerCart(id: null, items: []),
        ),
      ),
    ]);
    await tester.pumpWidget(
      _app(
        session: session,
        cartApi: cartApi,
        catalogApi: catalog,
        storefront: true,
      ),
    );
    await tester.pumpAndSettle();
    final storefront = tester.state(find.byType(StorefrontPage));
    await tester.tap(find.text('Carrinho'));
    await tester.pumpAndSettle();
    expect(find.text('Seu carrinho está vazio.'), findsOneWidget);
    expect(find.textContaining('R\$'), findsNothing);
    expect(find.textContaining('Frete'), findsNothing);
    expect(find.textContaining('Total'), findsNothing);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Continuar'))
          .onPressed,
      isNull,
    );
    await tester.tap(find.text('Continuar comprando'));
    await tester.pumpAndSettle();
    expect(find.byType(CartPage), findsNothing);
    expect(tester.state(find.byType(StorefrontPage)), same(storefront));
    expect(find.text('Nome da vitrine'), findsOneWidget);
    expect(catalog.pageCalls, 1);
    expect(cartApi.calls, 1);
  });

  testWidgets(
    'itens contam linhas, personalizações e controles de quantidade',
    (tester) async {
      final auth = _AuthApi();
      final session = await _session(auth);
      addTearDown(session.dispose);
      final catalog = _CatalogApi();
      final cartApi = _CartApi([
        Future.value(
          _cart(
            [
              _line(
                id: _itemId,
                name: _longName,
                quantity: 3,
                unitPrice: '10.50',
                subtotal: '31.50',
                personalizations: const [
                  CartPersonalization(id: _optionId, name: _longOption),
                ],
              ),
              _line(
                id: _secondItemId,
                quantity: 4,
                unitPrice: '8.00',
                subtotal: '32.00',
                available: false,
                reason: 'Quantidade superior à disponibilidade.',
              ),
            ],
            subtotal: '63.50',
            total: '63.50',
          ),
        ),
      ]);
      await tester.pumpWidget(
        _app(session: session, cartApi: cartApi, catalogApi: catalog),
      );
      await tester.pumpAndSettle();
      expect(find.text('ITENS SELECIONADOS (2)'), findsOneWidget);
      expect(find.text('7'), findsNothing);
      expect(find.text(_longName), findsOneWidget);
      expect(find.text(_longOption), findsOneWidget);
      expect(find.text('Cupcake de festa'), findsOneWidget);
      expect(
        find.text('Quantidade superior à disponibilidade.'),
        findsOneWidget,
      );
      expect(find.text('Preço unitário: R\$ 10,50'), findsOneWidget);
      expect(find.text('Subtotal do item: R\$ 31,50'), findsOneWidget);
      expect(find.text('Preço unitário: R\$ 8,00'), findsOneWidget);
      expect(find.text('Subtotal do item: R\$ 32,00'), findsOneWidget);
      expect(find.textContaining('Frete'), findsNothing);
      expect(find.bySemanticsLabel('Quantidade 3'), findsOneWidget);
      expect(find.bySemanticsLabel('Quantidade 4'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Imagem do produto indisponível'),
        findsNWidgets(2),
      );
      final name = tester.widget<Text>(find.text(_longName));
      final option = tester.widget<Text>(find.text(_longOption));
      expect(name.maxLines, isNull);
      expect(name.overflow, isNull);
      expect(option.maxLines, isNull);
      expect(option.overflow, isNull);
      expect(find.bySemanticsLabel('Diminuir quantidade'), findsNWidgets(2));
      expect(find.bySemanticsLabel('Aumentar quantidade'), findsNWidgets(2));
      expect(find.bySemanticsLabel('Remover item'), findsNWidgets(2));
      for (final button in tester.widgetList<IconButton>(
        find.byType(IconButton),
      )) {
        expect(button.onPressed, isNotNull);
      }
      await tester.scrollUntilVisible(
        find.text('Continuar'),
        400,
        scrollable: find.byType(Scrollable),
      );
      expect(
        find.text('Subtotal: R\$ 63,50', skipOffstage: false),
        findsOneWidget,
      );
      expect(
        find.text('Total: R\$ 63,50', skipOffstage: false),
        findsOneWidget,
      );
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Continuar'),
            )
            .onPressed,
        isNull,
      );
      await tester.tap(
        find.widgetWithText(FilledButton, 'Continuar'),
        warnIfMissed: false,
      );
      await tester.pump();
      expect(cartApi.calls, 1);
      expect(cartApi.mutations, isEmpty);
      expect(catalog.imageCalls, 0);
      expect(find.byType(CartPage), findsOneWidget);
      expect(
        find.text('Total: R\$ 63,50', skipOffstage: false),
        findsOneWidget,
      );
    },
  );

  testWidgets('falha de imagem mantém o nome e não vira erro da tela', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final catalog = _CatalogApi(imageStatus: CatalogRequestStatus.success);
    final cartApi = _CartApi([
      Future.value(
        _cart([
          _line(id: _itemId, imageAvailable: true),
          _line(id: _secondItemId, imageAvailable: false),
        ]),
      ),
    ]);
    await tester.pumpWidget(
      _app(session: session, cartApi: cartApi, catalogApi: catalog),
    );
    await tester.pumpAndSettle();
    expect(catalog.imageCalls, 1);
    expect(catalog.imageIds, [_productId]);
    expect(find.text('Cupcake de festa'), findsNWidgets(2));
    expect(
      find.text('Não foi possível carregar o carrinho. Tente novamente.'),
      findsNothing,
    );
    expect(
      find.bySemanticsLabel('Imagem do produto indisponível'),
      findsWidgets,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('erro faz um novo GET e 403 não tenta de novo', (tester) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final retry = Completer<CartResult>();
    final cartApi = _CartApi([
      Future.value(const CartResult(CartRequestStatus.unavailable)),
      retry.future,
    ]);
    await tester.pumpWidget(
      _app(session: session, cartApi: cartApi, catalogApi: _CatalogApi()),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Não foi possível carregar o carrinho. Tente novamente.'),
      findsOneWidget,
    );
    expect(find.text('Seu carrinho está vazio.'), findsNothing);
    await tester.tap(find.text('Tentar novamente'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Seu carrinho está vazio.'), findsNothing);
    retry.complete(_cart([_line(id: _itemId)]));
    await tester.pumpAndSettle();
    expect(cartApi.calls, 2);
    expect(find.text('Cupcake de festa'), findsOneWidget);

    final forbidden = _CartApi([
      Future.value(const CartResult(CartRequestStatus.forbidden)),
    ]);
    await tester.pumpWidget(
      _app(session: session, cartApi: forbidden, catalogApi: _CatalogApi()),
    );
    await tester.pumpAndSettle();
    expect(find.text('Sua conta não tem acesso ao carrinho.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
    expect(session.isAuthenticated, isTrue);
    await tester.pump(const Duration(seconds: 1));
    expect(forbidden.calls, 1);
    expect(auth.refreshCalls, 0);
  });

  testWidgets('401 atualiza a sessão uma vez e repete o GET', (tester) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(const CartResult(CartRequestStatus.unauthorized)),
      Future.value(_cart([_line(id: _itemId)])),
    ]);
    await tester.pumpWidget(
      _app(session: session, cartApi: cartApi, catalogApi: _CatalogApi()),
    );
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 1);
    expect(cartApi.calls, 2);
    expect(find.text('Cupcake de festa'), findsOneWidget);
    expect(session.isAuthenticated, isTrue);
  });

  testWidgets('refresh inválido após 401 encerra a sessão e sai do carrinho', (
    tester,
  ) async {
    final auth = _AuthApi(refreshStatus: AuthRequestStatus.invalidToken);
    final session = await _session(auth);
    addTearDown(session.dispose);
    final catalog = _CatalogApi();
    final cartApi = _CartApi([
      Future.value(const CartResult(CartRequestStatus.unauthorized)),
    ]);
    await tester.pumpWidget(
      _app(
        session: session,
        cartApi: cartApi,
        catalogApi: catalog,
        storefront: true,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Carrinho'));
    await tester.pumpAndSettle();
    expect(find.byType(CartPage), findsNothing);
    expect(session.isAuthenticated, isFalse);
    expect(auth.refreshCalls, 1);
    expect(cartApi.calls, 1);
    expect(find.text('Cupcake de festa'), findsNothing);
  });

  testWidgets('sair remove a rota do carrinho e os dados dos itens', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(_cart([_line(id: _itemId, name: _longName)])),
    ]);
    await tester.pumpWidget(
      _app(
        session: session,
        cartApi: cartApi,
        catalogApi: _CatalogApi(),
        storefront: true,
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Carrinho'));
    await tester.pumpAndSettle();
    expect(find.text(_longName), findsOneWidget);
    await session.signOut();
    await tester.pumpAndSettle();
    expect(find.byType(CartPage), findsNothing);
    expect(find.text(_longName), findsNothing);
    expect(find.text('Vitrine'), findsOneWidget);
  });

  Future<void> pumpCart(
    WidgetTester tester, {
    required _CartApi cartApi,
    required CustomerSession session,
    CustomerCatalogApi? catalogApi,
  }) async {
    await tester.pumpWidget(
      _app(
        session: session,
        cartApi: cartApi,
        catalogApi: catalogApi ?? _CatalogApi(),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'mais e menos enviam quantidade absoluta e mantêm personalização',
    (tester) async {
      final auth = _AuthApi();
      final session = await _session(auth);
      addTearDown(session.dispose);
      final catalog = _CatalogApi(imageStatus: CatalogRequestStatus.success);
      final cartApi = _CartApi([
        Future.value(
          _cart([
            _line(
              id: _itemId,
              quantity: 3,
              imageAvailable: true,
              personalizations: const [
                CartPersonalization(id: _optionId, name: 'Aroma'),
              ],
            ),
          ]),
        ),
      ]);
      cartApi.onMutation = (mutation) async => _cart([
        _line(
          id: mutation.itemId,
          quantity: mutation.quantity ?? 0,
          imageAvailable: true,
          personalizations: const [
            CartPersonalization(id: _optionId, name: 'Aroma'),
          ],
        ),
      ]);
      await pumpCart(
        tester,
        cartApi: cartApi,
        session: session,
        catalogApi: catalog,
      );
      expect(catalog.imageCalls, 1);
      await tester.tap(find.byIcon(Icons.add));
      await tester.pumpAndSettle();
      await tester.tap(find.byIcon(Icons.remove));
      await tester.pumpAndSettle();
      expect(cartApi.mutations.map((item) => item.quantity).toList(), [4, 3]);
      expect(cartApi.mutations.map((item) => item.method).toList(), [
        'PATCH',
        'PATCH',
      ]);
      expect(cartApi.mutations.map((item) => item.itemId).toSet(), {_itemId});
      expect(find.bySemanticsLabel('Quantidade 3'), findsOneWidget);
      expect(find.text('Aroma'), findsOneWidget);
      expect(catalog.imageCalls, 1);
      expect(find.text('Preço unitário: R\$ 10,00'), findsOneWidget);
      expect(find.text('Subtotal do item: R\$ 10,00'), findsOneWidget);
      expect(find.text('Subtotal: R\$ 10,00'), findsOneWidget);
      expect(find.text('Total: R\$ 10,00'), findsOneWidget);
      expect(find.textContaining('Frete'), findsNothing);
      expect(find.byType(SnackBar), findsNothing);
      expect(find.byType(AlertDialog), findsNothing);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Continuar'),
            )
            .onPressed,
        isNotNull,
      );
    },
  );

  testWidgets('quantidade 1 e quantidade máxima não disparam request', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart([
          _line(id: _itemId, name: 'Mínimo', quantity: 1),
          _line(id: _secondItemId, name: 'Máximo', quantity: 2147483647),
        ]),
      ),
    ]);
    await pumpCart(tester, cartApi: cartApi, session: session);
    final buttons = tester
        .widgetList<IconButton>(find.byType(IconButton))
        .toList();
    expect(buttons[0].onPressed, isNull);
    expect(buttons[1].onPressed, isNotNull);
    expect(buttons[3].onPressed, isNotNull);
    expect(buttons[4].onPressed, isNull);
    await tester.tap(find.byIcon(Icons.remove).first);
    await tapVisible(tester, find.byIcon(Icons.add).at(1));
    await tester.pump();
    expect(cartApi.mutations, isEmpty);
    expect(find.text('Mínimo'), findsOneWidget);
    expect(find.text('Máximo'), findsOneWidget);
  });

  testWidgets('lixeira remove só a linha e o último item mostra vazio', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart(
          [
            _line(
              id: _itemId,
              name: 'Linha A',
              personalizations: const [
                CartPersonalization(id: _optionId, name: 'Aroma'),
              ],
            ),
            _line(id: _secondItemId, name: 'Linha B'),
          ],
          subtotal: '20.00',
          total: '20.00',
        ),
      ),
      Future.value(
        _cart(
          [
            _line(
              id: _itemId,
              name: 'Linha A',
              unitPrice: '7.50',
              subtotal: '7.50',
              personalizations: const [
                CartPersonalization(id: _optionId, name: 'Aroma'),
              ],
            ),
          ],
          subtotal: '7.50',
          total: '7.50',
        ),
      ),
      Future.value(
        const CartResult(
          CartRequestStatus.success,
          cart: CustomerCart(
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            items: [],
            subtotal: '0.00',
            total: '0.00',
          ),
        ),
      ),
    ]);
    cartApi.onMutation = (_) async =>
        const CartResult(CartRequestStatus.success);
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tapVisible(tester, find.byIcon(Icons.delete_outline).at(1));
    await tester.pumpAndSettle();
    expect(cartApi.mutations.single.method, 'DELETE');
    expect(cartApi.mutations.single.itemId, _secondItemId);
    expect(cartApi.calls, 2);
    expect(find.text('Linha A'), findsOneWidget);
    expect(find.text('Aroma'), findsOneWidget);
    expect(find.text('Linha B'), findsNothing);
    expect(find.text('Total: R\$ 7,50'), findsOneWidget);
    expect(find.text('ITENS SELECIONADOS (1)'), findsOneWidget);
    expect(find.byType(SnackBar), findsNothing);
    expect(find.byType(AlertDialog), findsNothing);
    await tapVisible(tester, find.byIcon(Icons.delete_outline));
    await tester.pumpAndSettle();
    expect(find.text('Seu carrinho está vazio.'), findsOneWidget);
    expect(find.text('Linha A'), findsNothing);
    expect(find.textContaining('R\$'), findsNothing);
    expect(find.byType(CartPage), findsOneWidget);
    expect(find.byType(StorefrontPage), findsNothing);
    expect(find.text('Continuar comprando'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Continuar'))
          .onPressed,
      isNull,
    );
    expect(cartApi.calls, 3);
  });

  testWidgets('DELETE com GET seguinte falho não inventa total', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart(
          [_line(id: _itemId, name: 'Linha A', unitPrice: '12.00')],
          subtotal: '12.00',
          total: '12.00',
        ),
      ),
      Future.value(const CartResult(CartRequestStatus.unavailable)),
    ]);
    cartApi.onMutation = (_) async =>
        const CartResult(CartRequestStatus.success);
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.delete_outline));
    await tester.pumpAndSettle();
    expect(cartApi.calls, 2);
    expect(
      find.text('Não foi possível carregar o carrinho. Tente novamente.'),
      findsOneWidget,
    );
    expect(find.textContaining('R\$'), findsNothing);
    expect(find.text('Linha A'), findsNothing);
    expect(find.text('Tentar novamente'), findsOneWidget);
  });

  testWidgets('operação pendente bloqueia segundo toque e mantém a lista', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final gate = Completer<CartResult>();
    final cartApi = _CartApi([
      Future.value(
        _cart([
          _line(id: _itemId, name: 'Linha A', quantity: 3),
          _line(id: _secondItemId, name: 'Linha B', quantity: 4),
        ]),
      ),
    ]);
    cartApi.onMutation = (_) => gate.future;
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.add).first);
    await tester.pump();
    expect(cartApi.mutations, hasLength(1));
    expect(find.text('ITENS SELECIONADOS (2)'), findsOneWidget);
    expect(find.text('Atualizando quantidade…'), findsOneWidget);
    expect(
      find.ancestor(
        of: find.text('Atualizando quantidade…'),
        matching: find.byWidgetPredicate(
          (widget) =>
              widget is Semantics && widget.properties.liveRegion == true,
        ),
      ),
      findsOneWidget,
    );
    for (final button in tester.widgetList<IconButton>(
      find.byType(IconButton),
    )) {
      expect(button.onPressed, isNull);
    }
    await tester.tap(find.byIcon(Icons.add).first);
    await tester.tap(find.byIcon(Icons.remove).first);
    await tester.drag(find.byType(Scrollable).first, const Offset(0, -180));
    await tester.pump();
    await tester.tap(find.byIcon(Icons.delete_outline).at(1));
    await tester.pump();
    expect(cartApi.mutations, hasLength(1));
    gate.complete(
      _cart([
        _line(id: _itemId, name: 'Linha A', quantity: 4),
        _line(id: _secondItemId, name: 'Linha B', quantity: 4),
      ]),
    );
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Quantidade 4'), findsNWidgets(2));
    expect(find.text('Atualizando quantidade…'), findsNothing);
  });

  testWidgets('409 mantém quantidade e erro de rede mantém a linha', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart([
          _line(id: _itemId, name: 'Linha A', quantity: 3),
          _line(id: _secondItemId, name: 'Linha B'),
        ]),
      ),
    ]);
    cartApi.onMutation = (mutation) async => mutation.method == 'PATCH'
        ? const CartResult(
            CartRequestStatus.conflict,
            message: 'Quantidade superior à disponibilidade.',
          )
        : const CartResult(CartRequestStatus.unavailable);
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.add).first);
    await tester.pumpAndSettle();
    expect(cartApi.mutations.single.quantity, 4);
    expect(find.bySemanticsLabel('Quantidade 3'), findsOneWidget);
    expect(find.text('Quantidade superior à disponibilidade.'), findsOneWidget);
    expect(
      find.text('Não foi possível carregar o carrinho. Tente novamente.'),
      findsNothing,
    );
    await tapVisible(tester, find.byIcon(Icons.delete_outline).at(1));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    expect(cartApi.mutations, hasLength(2));
    expect(find.text('Linha A'), findsOneWidget);
    expect(find.text('Linha B'), findsOneWidget);
    expect(find.text('Não foi possível remover o item.'), findsOneWidget);
    expect(cartApi.calls, 1);
    expect(auth.refreshCalls, 0);
  });

  testWidgets('401 repete a mesma operação uma vez e 403 não repete', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(_cart([_line(id: _itemId, quantity: 3)])),
    ]);
    var attempts = 0;
    cartApi.onMutation = (mutation) async {
      attempts++;
      if (attempts == 1) {
        return const CartResult(CartRequestStatus.unauthorized);
      }
      return _cart([_line(id: mutation.itemId, quantity: mutation.quantity!)]);
    };
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 1);
    expect(cartApi.mutations.map((item) => item.quantity).toList(), [4, 4]);
    expect(cartApi.mutations.first.token, isNot(cartApi.mutations.last.token));
    expect(find.bySemanticsLabel('Quantidade 4'), findsOneWidget);
    expect(session.isAuthenticated, isTrue);

    final denied = _CartApi([
      Future.value(_cart([_line(id: _itemId, quantity: 2)])),
    ]);
    denied.onMutation = (_) async =>
        const CartResult(CartRequestStatus.forbidden);
    await tester.pumpWidget(
      _app(session: session, cartApi: denied, catalogApi: _CatalogApi()),
    );
    await tester.pumpAndSettle();
    final refreshes = auth.refreshCalls;
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Sua conta não tem acesso ao carrinho.'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
    expect(denied.mutations, hasLength(1));
    expect(auth.refreshCalls, refreshes);
    expect(session.isAuthenticated, isTrue);
  });

  testWidgets('segundo 401 não faz outro refresh', (tester) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(_cart([_line(id: _itemId, quantity: 2)])),
    ]);
    cartApi.onMutation = (_) async =>
        const CartResult(CartRequestStatus.unauthorized);
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 1);
    expect(cartApi.mutations, hasLength(2));
    expect(
      find.text('Não foi possível atualizar a quantidade.'),
      findsOneWidget,
    );
    expect(find.text('Cupcake de festa'), findsOneWidget);
    expect(session.isAuthenticated, isTrue);
    expect(find.byType(CartPage), findsOneWidget);
  });

  testWidgets('404 mostra a mensagem, sincroniza e não vira erro global', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart([
          _line(id: _itemId, name: 'Linha A'),
          _line(id: _secondItemId, name: 'Linha B'),
        ]),
      ),
      Future.value(_cart([_line(id: _secondItemId, name: 'Linha B')])),
    ]);
    cartApi.onMutation = (_) async =>
        const CartResult(CartRequestStatus.notFound);
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.delete_outline).first);
    await tester.pumpAndSettle();
    expect(cartApi.mutations, hasLength(1));
    expect(cartApi.calls, 2);
    expect(find.text('Item não encontrado.'), findsOneWidget);
    expect(find.text('Linha A'), findsNothing);
    expect(find.text('Linha B'), findsOneWidget);
    expect(
      find.text('Não foi possível carregar o carrinho. Tente novamente.'),
      findsNothing,
    );
    expect(find.text('Tentar novamente'), findsNothing);
    expect(session.isAuthenticated, isTrue);
  });

  testWidgets('mostra os valores da API e omite preço da linha inválida', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart(
          [
            _line(
              id: _itemId,
              quantity: 3,
              unitPrice: '10.00',
              subtotal: '7.11',
            ),
            _line(
              id: _secondItemId,
              name: 'Indisponível',
              unitPrice: null,
              subtotal: null,
              available: false,
              reason: 'Produto indisponível.',
            ),
          ],
          subtotal: '7.11',
          total: '8.22',
        ),
      ),
    ]);
    await pumpCart(tester, cartApi: cartApi, session: session);
    expect(find.text('Preço unitário: R\$ 10,00'), findsOneWidget);
    expect(find.text('Subtotal do item: R\$ 7,11'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Total: R\$ 8,22'),
      400,
      scrollable: find.byType(Scrollable),
    );
    expect(find.text('Subtotal: R\$ 7,11'), findsOneWidget);
    expect(find.text('Total: R\$ 8,22'), findsOneWidget);
    expect(find.text('Subtotal do item: R\$ 30,00'), findsNothing);
    expect(find.text('Total: R\$ 30,00'), findsNothing);
    expect(find.text('Total: R\$ 7,11'), findsNothing);
    expect(find.text('Produto indisponível.'), findsOneWidget);
    expect(find.textContaining('Preço unitário'), findsOneWidget);
  });

  testWidgets('PATCH inutilizável preserva quantidade e total anteriores', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final cartApi = _CartApi([
      Future.value(
        _cart(
          [_line(id: _itemId, quantity: 3, unitPrice: '10.00')],
          subtotal: '10.00',
          total: '10.00',
        ),
      ),
    ]);
    cartApi.onMutation = (_) async =>
        const CartResult(CartRequestStatus.unavailable);
    await pumpCart(tester, cartApi: cartApi, session: session);
    await tester.tap(find.byIcon(Icons.add));
    await tester.pumpAndSettle();
    expect(cartApi.mutations, hasLength(1));
    expect(cartApi.mutations.single.quantity, 4);
    expect(cartApi.calls, 1);
    expect(find.bySemanticsLabel('Quantidade 3'), findsOneWidget);
    expect(find.text('Total: R\$ 10,00'), findsOneWidget);
    expect(
      find.text('Não foi possível atualizar a quantidade.'),
      findsOneWidget,
    );
    expect(find.text('Tentar novamente'), findsNothing);
  });

  for (final width in [320.0, 390.0, 430.0]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets(
        'carrinho em ${width.toInt()} dp com texto ${scale.toInt()}x não estoura',
        (tester) async {
          tester.view.devicePixelRatio = 1;
          tester.view.physicalSize = Size(width, 640);
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final auth = _AuthApi();
          final session = await _session(auth);
          addTearDown(session.dispose);
          final cartApi = _CartApi([
            Future.value(
              _cart(
                [
                  _line(
                    id: _itemId,
                    name: _longName,
                    quantity: 3,
                    unitPrice: '1234.56',
                    subtotal: '3703.68',
                    personalizations: const [
                      CartPersonalization(id: _optionId, name: _longOption),
                    ],
                  ),
                  _line(
                    id: _secondItemId,
                    quantity: 4,
                    unitPrice: null,
                    subtotal: null,
                    available: false,
                    reason: _longReason,
                  ),
                ],
                subtotal: '3703.68',
                total: '3703.68',
              ),
            ),
          ]);
          await tester.pumpWidget(
            _app(
              session: session,
              cartApi: cartApi,
              catalogApi: _CatalogApi(),
              scale: scale,
            ),
          );
          await tester.pumpAndSettle();
          expect(find.text(_longName), findsOneWidget);
          expect(find.text(_longOption), findsOneWidget);
          expect(find.textContaining('Preço unitário'), findsOneWidget);
          final buttons = tester.widgetList<IconButton>(
            find.byType(IconButton),
          );
          expect(buttons, isNotEmpty);
          for (final button in buttons) {
            expect(button.constraints?.minWidth, greaterThanOrEqualTo(48));
            expect(button.constraints?.minHeight, greaterThanOrEqualTo(48));
          }
          final addButton = find.widgetWithIcon(IconButton, Icons.add).first;
          await reveal(tester, addButton);
          final addSize = tester.getSize(addButton);
          expect(addSize.width, greaterThanOrEqualTo(48));
          expect(addSize.height, greaterThanOrEqualTo(48));
          expect(
            tester
                .widgetList<IconButton>(find.byType(IconButton))
                .every((button) => button.onPressed != null),
            isTrue,
          );
          expect(tester.takeException(), isNull);
          cartApi.onMutation = (_) async => const CartResult(
            CartRequestStatus.conflict,
            message: 'Quantidade superior à disponibilidade.',
          );
          await tapVisible(tester, find.byIcon(Icons.add).first);
          await tester.pumpAndSettle();
          final unavailable = find.text(
            'Quantidade superior à disponibilidade.',
          );
          await reveal(tester, unavailable);
          expect(unavailable.hitTestable(), findsOneWidget);
          expect(
            find.ancestor(
              of: unavailable,
              matching: find.byWidgetPredicate(
                (widget) =>
                    widget is Semantics && widget.properties.liveRegion == true,
              ),
            ),
            findsOneWidget,
          );
          expect(
            tester.widget<Text>(unavailable).data,
            'Quantidade superior à disponibilidade.',
          );
          expect(find.bySemanticsLabel('Quantidade 3'), findsOneWidget);
          expect(find.text('Preço unitário: R\$ 1.234,56'), findsOneWidget);
          expect(find.text('Subtotal do item: R\$ 3.703,68'), findsOneWidget);
          expect(find.textContaining('Frete'), findsNothing);
          expect(tester.takeException(), isNull);
          await tester.scrollUntilVisible(
            find.text('Continuar'),
            400,
            scrollable: find.byType(Scrollable),
          );
          expect(
            find.text('Total: R\$ 3.703,68', skipOffstage: false),
            findsOneWidget,
          );
          final reason = find.text(_longReason, skipOffstage: false);
          expect(reason, findsOneWidget);
          expect(tester.widget<Text>(reason).data, _longReason);
          expect(tester.widget<Text>(reason).style?.color, isNotNull);
          final continuar = tester.widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Continuar'),
          );
          expect(
            continuar.style?.minimumSize?.resolve({})?.height,
            greaterThanOrEqualTo(48),
          );
          expect(find.text('Continuar'), findsOneWidget);
          expect(
            tester
                .widget<FilledButton>(
                  find.widgetWithText(FilledButton, 'Continuar'),
                )
                .onPressed,
            isNull,
          );
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox.shrink());
        },
      );
    }
  }
}
