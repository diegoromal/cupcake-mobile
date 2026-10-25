import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/cart/data/customer_cart_api.dart';
import 'package:cupcake_mobile/features/catalog/data/customer_catalog_api.dart';
import 'package:cupcake_mobile/features/catalog/presentation/product_detail_page.dart';
import 'package:cupcake_mobile/features/catalog/presentation/storefront_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const id = '11111111-1111-4111-8111-111111111111';
const category = CatalogCategory(
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Doces',
);
const detail = CatalogProductDetail(
  id: id,
  name: 'Cupcake atual',
  description: 'Chocolate',
  price: '12.30',
  category: category,
  imageAvailable: false,
);

String token(String jti) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': id, 'perfil': 'CLIENTE', 'type': jti == 'refresh' ? 'refresh' : 'access', 'jti': jti, 'iat': now, 'exp': now + 3600})}.signature';
}

class AuthApi extends CustomerAuthApi {
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

class Api extends CustomerCatalogApi {
  Api(this.detailResponses);
  final List<Future<CatalogDetailResult>> detailResponses;
  final ids = <String>[];
  int pageCalls = 0;
  int imageCalls = 0;
  final previewResponses = <Future<CatalogPriceResult>>[];
  final previewSelections = <List<String>>[];
  @override
  Future<CatalogPriceResult> previewPrice({
    required String productId,
    required String accessToken,
    required List<String> personalizationIds,
  }) {
    previewSelections.add(personalizationIds);
    return previewResponses.removeAt(0);
  }

  @override
  Future<CatalogImageResult> fetchImage({
    required String productId,
    required String accessToken,
  }) async {
    imageCalls++;
    return const CatalogImageResult(CatalogRequestStatus.unavailable);
  }

  @override
  Future<CatalogDetailResult> fetchDetail({
    required String productId,
    required String accessToken,
  }) {
    ids.add(productId);
    return detailResponses.removeAt(0);
  }

  @override
  Future<CatalogCategoriesResult> fetchCategories({
    required String accessToken,
  }) async => const CatalogCategoriesResult(
    CatalogRequestStatus.success,
    categories: [category],
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
            id: id,
            name: 'Nome antigo',
            price: '9.00',
            category: category,
            imageAvailable: false,
          ),
        ],
        page: page,
        limit: limit,
        hasMore: false,
      ),
    );
  }
}

class CartApi extends CustomerCartApi {
  final responses = <Future<CartResult>>[];
  final additions = <(String, int, List<String>, String)>[];
  int cartReads = 0;

  @override
  Future<CartResult> addItem({
    required String accessToken,
    required String productId,
    required int quantity,
    required List<String> personalizationIds,
  }) {
    additions.add((productId, quantity, personalizationIds, accessToken));
    return responses.removeAt(0);
  }

  @override
  Future<CartResult> fetchCart({required String accessToken}) async {
    cartReads++;
    return const CartResult(
      CartRequestStatus.success,
      cart: CustomerCart(
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        items: [
          CartItem(
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            productId: id,
            name: 'Cupcake atual',
            imageAvailable: false,
            quantity: 2,
            personalizations: [],
            unitPrice: '12.30',
            subtotal: '24.60',
            available: true,
            reason: null,
          ),
        ],
        subtotal: '24.60',
        total: '24.60',
      ),
    );
  }
}

Future<CustomerSession> session(AuthApi auth) async {
  final result = CustomerSession(
    authApi: auth,
    storage: MemorySessionStorage(),
  );
  await result.restore();
  await result.signIn(email: 'cliente@example.com', password: 'senha');
  result.setForeground(false);
  return result;
}

Widget app(
  CustomerSession session,
  Api api, {
  CustomerCartApi? cartApi,
  bool storefront = false,
  double scale = 1,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(scale)),
    child: storefront
        ? StorefrontPage(session: session, api: api, cartApi: cartApi)
        : ProductDetailPage(
            productId: id,
            session: session,
            api: api,
            cartApi: cartApi,
          ),
  ),
);

void main() {
  testWidgets(
    'detalhe envia seleção e quantidade uma vez, confirma e carrinho lê linha',
    (tester) async {
      final active = await session(AuthApi());
      addTearDown(active.dispose);
      const option = CatalogPersonalization(
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Cobertura',
        description: null,
        available: true,
        adjustment: '1.00',
      );
      final catalog = Api([
        Future.value(
          const CatalogDetailResult(
            CatalogRequestStatus.success,
            product: CatalogProductDetail(
              id: id,
              name: 'Cupcake atual',
              description: null,
              price: '12.30',
              category: category,
              imageAvailable: false,
              personalizations: [option],
            ),
          ),
        ),
      ]);
      catalog.previewResponses.add(
        Future.value(
          const CatalogPriceResult(
            CatalogRequestStatus.success,
            unitPrice: '13.30',
          ),
        ),
      );
      final cart = CartApi();
      final pending = Completer<CartResult>();
      cart.responses.add(pending.future);
      await tester.pumpWidget(
        app(active, catalog, storefront: true, cartApi: cart),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Nome antigo'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Cobertura'));
      await tester.tap(find.text('Cobertura'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byTooltip('Aumentar quantidade'));
      await tester.tap(find.byTooltip('Aumentar quantidade'));
      await tester.pumpAndSettle();
      expect(find.text('2'), findsOneWidget);
      expect(find.text('Subtotal: R\$ 26,60'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 250);
      await tester.tap(find.text('Adicionar ao carrinho'));
      await tester.pump();
      expect(cart.additions, hasLength(1));
      expect(cart.additions.single.$1, id);
      expect(cart.additions.single.$2, 2);
      expect(cart.additions.single.$3, [option.id]);
      expect(cart.additions.single.$4, isNotEmpty);
      expect(find.text('Adicionando…'), findsOneWidget);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Adicionando…'),
            )
            .onPressed,
        isNull,
      );
      pending.complete(const CartResult(CartRequestStatus.success));
      await tester.pumpAndSettle();
      expect(find.text('Item adicionado ao carrinho.'), findsOneWidget);
      expect(find.text('Detalhes do cupcake'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Carrinho'));
      await tester.pumpAndSettle();
      expect(cart.cartReads, 1);
      expect(find.text('Cupcake atual'), findsOneWidget);
      expect(find.text('Subtotal: R\$ 24,60'), findsOneWidget);
    },
  );

  testWidgets('resultado indeterminado bloqueia reenvio e abre carrinho', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final catalog = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
    ]);
    final cart = CartApi();
    cart.responses.add(
      Future.value(const CartResult(CartRequestStatus.unavailable)),
    );
    cart.responses.add(
      Future.value(const CartResult(CartRequestStatus.success)),
    );
    await tester.pumpWidget(
      app(active, catalog, storefront: true, cartApi: cart),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nome antigo'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 250);
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(find.textContaining('O item pode ter sido criado'), findsOneWidget);
    expect(find.text('Item adicionado ao carrinho.'), findsNothing);
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 100);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Adicionar ao carrinho'),
          )
          .onPressed,
      isNull,
    );
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(cart.additions, hasLength(1));
    await tester.ensureVisible(find.text('Abrir carrinho'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Abrir carrinho'));
    await tester.pumpAndSettle();
    expect(find.text('Carrinho'), findsOneWidget);
    expect(cart.cartReads, 1);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Detalhes do cupcake'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Adicionar ao carrinho'),
          )
          .onPressed,
      isNull,
    );
    expect(cart.additions, hasLength(1));
    await tester.ensureVisible(find.byTooltip('Aumentar quantidade'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Aumentar quantidade'));
    await tester.pumpAndSettle();
    expect(find.text('2'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 100);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Adicionar ao carrinho'),
          )
          .onPressed,
      isNotNull,
    );
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(cart.additions, hasLength(2));
    expect(cart.additions.last.$2, 2);
    await tester.ensureVisible(find.byTooltip('Diminuir quantidade'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Diminuir quantidade'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 100);
    expect(find.textContaining('O item pode ter sido criado'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Adicionar ao carrinho'),
          )
          .onPressed,
      isNull,
    );
    expect(cart.additions, hasLength(2));
  });

  testWidgets('reabrir mesmo payload indeterminado não reenviará POST', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final catalog = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
    ]);
    final cart = CartApi()
      ..responses.add(
        Future.value(const CartResult(CartRequestStatus.unavailable)),
      );
    await tester.pumpWidget(
      app(active, catalog, storefront: true, cartApi: cart),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nome antigo'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 250);
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(cart.additions, hasLength(1));
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nome antigo'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 250);
    expect(find.textContaining('O item pode ter sido criado'), findsOneWidget);
    expect(find.text('Abrir carrinho'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Adicionar ao carrinho'),
          )
          .onPressed,
      isNull,
    );
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(cart.additions, hasLength(1));
  });

  testWidgets('conflito não confirma inclusão e permite atualizar o produto', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final catalog = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
    ]);
    final cart = CartApi()
      ..responses.add(
        Future.value(
          const CartResult(
            CartRequestStatus.conflict,
            message: 'Quantidade superior à disponibilidade.',
          ),
        ),
      );
    await tester.pumpWidget(app(active, catalog, cartApi: cart));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Adicionar ao carrinho'), 250);
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(find.text('Quantidade superior à disponibilidade.'), findsOneWidget);
    expect(find.text('Item adicionado ao carrinho.'), findsNothing);
    await tester.ensureVisible(find.text('Atualizar produto'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Atualizar produto'));
    await tester.pumpAndSettle();
    expect(catalog.ids, [id, id]);
    expect(find.text('Cupcake atual'), findsOneWidget);
  });
  testWidgets('negative preview hides old price and 401 refreshes once', (
    tester,
  ) async {
    final auth = AuthApi();
    final active = await session(auth);
    addTearDown(active.dispose);
    const option = CatalogPersonalization(
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Desconto',
      description: null,
      available: true,
      adjustment: '-20.00',
    );
    final api = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: CatalogProductDetail(
            id: id,
            name: 'Cupcake',
            description: null,
            price: '12.30',
            category: category,
            imageAvailable: false,
            personalizations: [option],
          ),
        ),
      ),
    ]);
    api.previewResponses.addAll([
      Future.value(const CatalogPriceResult(CatalogRequestStatus.unauthorized)),
      Future.value(
        const CatalogPriceResult(CatalogRequestStatus.negativePrice),
      ),
    ]);
    await tester.pumpWidget(app(active, api));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Desconto'));
    await tester.tap(find.text('Desconto'));
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 1);
    expect(api.previewSelections, [
      [option.id],
      [option.id],
    ]);
    expect(find.textContaining('preço negativo'), findsOneWidget);
    expect(find.textContaining('Preço unitário:'), findsNothing);
    expect(find.textContaining('Subtotal:'), findsNothing);
    expect(active.isAuthenticated, isTrue);
  });
  testWidgets(
    'selection, stale preview and retry keep API price authoritative',
    (tester) async {
      final active = await session(AuthApi());
      addTearDown(active.dispose);
      const option = CatalogPersonalization(
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Cobertura',
        description: null,
        available: true,
        adjustment: '1.00',
      );
      const unavailable = CatalogPersonalization(
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Indisponível',
        description: 'Extra',
        available: false,
        adjustment: null,
      );
      final api = Api([
        Future.value(
          const CatalogDetailResult(
            CatalogRequestStatus.success,
            product: CatalogProductDetail(
              id: id,
              name: 'Cupcake',
              description: null,
              price: '12.30',
              category: category,
              imageAvailable: false,
              personalizations: [option, unavailable],
            ),
          ),
        ),
      ]);
      final stale = Completer<CatalogPriceResult>();
      api.previewResponses.addAll([
        stale.future,
        Future.value(
          const CatalogPriceResult(CatalogRequestStatus.unavailable),
        ),
        Future.value(
          const CatalogPriceResult(
            CatalogRequestStatus.success,
            unitPrice: '11.25',
          ),
        ),
      ]);
      await tester.pumpWidget(app(active, api));
      await tester.pumpAndSettle();
      expect(
        find.text('Nenhuma personalização disponível para este produto.'),
        findsNothing,
      );
      await tester.ensureVisible(find.text('Cobertura'));
      await tester.tap(find.text('Cobertura'));
      await tester.pump();
      expect(
        find.bySemanticsLabel('Calculando preço unitário…'),
        findsOneWidget,
      );
      expect(find.textContaining('Subtotal:'), findsNothing);
      await tester.tap(find.text('Cobertura'));
      await tester.pumpAndSettle();
      stale.complete(
        const CatalogPriceResult(
          CatalogRequestStatus.success,
          unitPrice: '99.00',
        ),
      );
      await tester.pump();
      expect(find.textContaining('99,00'), findsNothing);
      expect(find.textContaining('Não foi possível calcular'), findsOneWidget);
      expect(find.textContaining('Subtotal:'), findsNothing);
      await tester.tap(find.text('Tentar novamente'));
      await tester.pumpAndSettle();
      expect(find.text('Preço unitário: R\$ 11,25'), findsOneWidget);
      expect(api.previewSelections, [
        [option.id],
        <String>[],
        <String>[],
      ]);
      expect(find.text('Indisponível'), findsWidgets);
    },
  );
  testWidgets('image request failure keeps accessible fallback', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final api = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: CatalogProductDetail(
            id: id,
            name: 'Cupcake atual',
            description: null,
            price: '12.30',
            category: category,
            imageAvailable: true,
          ),
        ),
      ),
    ]);
    await tester.pumpWidget(app(active, api));
    await tester.pumpAndSettle();
    expect(api.imageCalls, 1);
    expect(
      find.bySemanticsLabel('Imagem do produto indisponível'),
      findsOneWidget,
    );
    expect(find.text('Cupcake atual'), findsOneWidget);
  });
  testWidgets('long name and description remain readable at 320dp', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final longName =
        'Cupcake artesanal de chocolate com cobertura especial e nome extenso';
    final longDescription = List.filled(
      40,
      'Descrição cadastrada longa.',
    ).join(' ');
    final api = Api([
      Future.value(
        CatalogDetailResult(
          CatalogRequestStatus.success,
          product: CatalogProductDetail(
            id: id,
            name: longName,
            description: longDescription,
            price: '1234.50',
            category: category,
            imageAvailable: false,
          ),
        ),
      ),
    ]);
    await tester.pumpWidget(app(active, api, scale: 1.5));
    await tester.pumpAndSettle();
    expect(find.text(longName), findsOneWidget);
    await tester.scrollUntilVisible(find.text(longDescription), 300);
    expect(find.text(longDescription), findsOneWidget);
    expect(find.text('R\$ 1.234,50'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('loading, retry and description absent stay usable', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final pending = Completer<CatalogDetailResult>();
    final api = Api([
      pending.future,
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: CatalogProductDetail(
            id: id,
            name: 'Sem descrição',
            description: null,
            price: '2.00',
            category: category,
            imageAvailable: false,
          ),
        ),
      ),
    ]);
    await tester.pumpWidget(app(active, api));
    expect(find.bySemanticsLabel('Carregando produto…'), findsOneWidget);
    pending.complete(
      const CatalogDetailResult(CatalogRequestStatus.unavailable),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tentar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Sem descrição'), findsOneWidget);
    expect(find.text('R\$ 2,00'), findsOneWidget);
    expect(find.text('Chocolate'), findsNothing);
    expect(
      find.bySemanticsLabel('Imagem do produto indisponível'),
      findsOneWidget,
    );
  });

  testWidgets('late response for old product cannot replace current content', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final late = Completer<CatalogDetailResult>();
    const nextId = '33333333-3333-4333-8333-333333333333';
    final api = Api([
      late.future,
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: CatalogProductDetail(
            id: nextId,
            name: 'Produto novo',
            description: null,
            price: '4.00',
            category: category,
            imageAvailable: false,
          ),
        ),
      ),
    ]);
    Widget page(String productId) => MaterialApp(
      home: ProductDetailPage(productId: productId, session: active, api: api),
    );
    await tester.pumpWidget(page(id));
    await tester.pumpWidget(page(nextId));
    await tester.pumpAndSettle();
    late.complete(
      const CatalogDetailResult(CatalogRequestStatus.success, product: detail),
    );
    await tester.pumpAndSettle();
    expect(api.ids, [id, nextId]);
    expect(find.text('Produto novo'), findsOneWidget);
    expect(find.text('Cupcake atual'), findsNothing);
  });
  for (final width in [320.0, 390.0, 430.0]) {
    testWidgets('detail content at ${width.toInt()}dp with enlarged text', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 800);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final auth = AuthApi();
      final active = await session(auth);
      addTearDown(active.dispose);
      final api = Api([
        Future.value(
          const CatalogDetailResult(
            CatalogRequestStatus.success,
            product: detail,
          ),
        ),
      ]);
      await tester.pumpWidget(app(active, api, scale: 1.5));
      await tester.pumpAndSettle();
      expect(find.text('Cupcake atual'), findsOneWidget);
      expect(find.text('R\$ 12,30'), findsOneWidget);
      expect(find.text('Chocolate'), findsOneWidget);
      expect(
        find.bySemanticsLabel('Imagem do produto indisponível'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('card opens real ID and pop preserves storefront', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final api = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
    ]);
    await tester.pumpWidget(app(active, api, storefront: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nome antigo'));
    await tester.pumpAndSettle();
    expect(api.ids, [id]);
    expect(find.text('Cupcake atual'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Nome antigo'), findsOneWidget);
    expect(api.pageCalls, 1);
  });

  testWidgets('session loss removes the detail route and its product data', (
    tester,
  ) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final api = Api([
      Future.value(
        const CatalogDetailResult(
          CatalogRequestStatus.success,
          product: detail,
        ),
      ),
    ]);
    await tester.pumpWidget(app(active, api, storefront: true));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Nome antigo'));
    await tester.pumpAndSettle();
    expect(find.text('Cupcake atual'), findsOneWidget);
    await active.signOut();
    await tester.pumpAndSettle();
    expect(find.text('Cupcake atual'), findsNothing);
    expect(find.text('Detalhes do cupcake'), findsNothing);
  });

  testWidgets('404, retry and stale response after dispose', (tester) async {
    final active = await session(AuthApi());
    addTearDown(active.dispose);
    final late = Completer<CatalogDetailResult>();
    final api = Api([
      Future.value(const CatalogDetailResult(CatalogRequestStatus.notFound)),
      late.future,
    ]);
    await tester.pumpWidget(app(active, api));
    await tester.pumpAndSettle();
    expect(find.text('Produto indisponível'), findsOneWidget);
    await tester.pumpWidget(
      app(
        active,
        Api([
          Future.value(
            const CatalogDetailResult(CatalogRequestStatus.unavailable),
          ),
          late.future,
        ]),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tentar novamente'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    late.complete(
      const CatalogDetailResult(CatalogRequestStatus.success, product: detail),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
  });

  testWidgets('401 refreshes once and 403 stays on detail', (tester) async {
    final auth = AuthApi();
    final active = await session(auth);
    addTearDown(active.dispose);
    final api = Api([
      Future.value(
        const CatalogDetailResult(CatalogRequestStatus.unauthorized),
      ),
      Future.value(const CatalogDetailResult(CatalogRequestStatus.forbidden)),
    ]);
    await tester.pumpWidget(app(active, api));
    await tester.pump(const Duration(milliseconds: 200));
    expect(auth.refreshCalls, 1);
    expect(api.ids, [id, id]);
    expect(
      find.text('Sua conta não tem acesso a este produto.'),
      findsOneWidget,
    );
    expect(active.isAuthenticated, isTrue);
  });
}
