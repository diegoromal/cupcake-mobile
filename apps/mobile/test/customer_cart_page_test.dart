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

class _CartApi extends CustomerCartApi {
  _CartApi(this.responses);
  final List<Future<CartResult>> responses;
  int calls = 0;

  @override
  Future<CartResult> fetchCart({required String accessToken}) {
    calls++;
    return responses.removeAt(0);
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
}) => CartItem(
  id: id,
  productId: _productId,
  name: name,
  imageAvailable: imageAvailable,
  quantity: quantity,
  personalizations: personalizations,
);

CartResult _cart(List<CartItem> items, {String? id}) => CartResult(
  CartRequestStatus.success,
  cart: CustomerCart(
    id: id ?? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    items: items,
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

  testWidgets('itens contam linhas, personalizações e controles sem request', (
    tester,
  ) async {
    final auth = _AuthApi();
    final session = await _session(auth);
    addTearDown(session.dispose);
    final catalog = _CatalogApi();
    final cartApi = _CartApi([
      Future.value(
        _cart([
          _line(
            id: _itemId,
            name: _longName,
            quantity: 3,
            personalizations: const [
              CartPersonalization(id: _optionId, name: _longOption),
            ],
          ),
          _line(id: _secondItemId, quantity: 4),
        ]),
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
    expect(find.bySemanticsLabel('Quantidade 3'), findsOneWidget);
    expect(find.bySemanticsLabel('Quantidade 4'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Imagem do produto indisponível'),
      findsNWidgets(2),
    );
    expect(find.textContaining('R\$'), findsNothing);
    expect(find.textContaining('Subtotal'), findsNothing);
    expect(find.textContaining('Frete'), findsNothing);
    expect(find.textContaining('Total'), findsNothing);
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
      expect(button.onPressed, isNull);
    }
    await tester.scrollUntilVisible(
      find.text('Continuar'),
      400,
      scrollable: find.byType(Scrollable),
    );
    expect(
      tester
          .widget<FilledButton>(find.widgetWithText(FilledButton, 'Continuar'))
          .onPressed,
      isNull,
    );
    await tester.tap(find.byIcon(Icons.remove).first, warnIfMissed: false);
    await tester.tap(find.byIcon(Icons.add).first, warnIfMissed: false);
    await tester.tap(
      find.byIcon(Icons.delete_outline).first,
      warnIfMissed: false,
    );
    await tester.tap(
      find.widgetWithText(FilledButton, 'Continuar'),
      warnIfMissed: false,
    );
    await tester.pump();
    expect(cartApi.calls, 1);
    expect(catalog.imageCalls, 0);
    expect(
      find.text('ITENS SELECIONADOS (2)', skipOffstage: false),
      findsOneWidget,
    );
  });

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
              _cart([
                _line(
                  id: _itemId,
                  name: _longName,
                  quantity: 3,
                  personalizations: const [
                    CartPersonalization(id: _optionId, name: _longOption),
                  ],
                ),
                _line(id: _secondItemId, quantity: 4),
              ]),
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
          expect(tester.takeException(), isNull);
          await tester.scrollUntilVisible(
            find.text('Continuar'),
            400,
            scrollable: find.byType(Scrollable),
          );
          expect(find.text('Continuar'), findsOneWidget);
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox.shrink());
        },
      );
    }
  }
}
