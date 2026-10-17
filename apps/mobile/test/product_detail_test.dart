import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
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
  bool storefront = false,
  double scale = 1,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(scale)),
    child: storefront
        ? StorefrontPage(session: session, api: api)
        : ProductDetailPage(productId: id, session: session, api: api),
  ),
);

void main() {
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
