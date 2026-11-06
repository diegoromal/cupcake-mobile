import 'dart:async';
import 'dart:convert';

import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/cart/data/customer_cart_api.dart';
import 'package:cupcake_mobile/features/cart/presentation/cart_page.dart';
import 'package:cupcake_mobile/features/catalog/data/customer_catalog_api.dart';
import 'package:cupcake_mobile/features/catalog/presentation/storefront_page.dart';
import 'package:cupcake_mobile/features/checkout/presentation/fulfillment_page.dart';
import 'package:cupcake_mobile/features/orders/presentation/customer_orders_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _category1 = CatalogCategory(
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Doces especiais e presentes',
);
const _category2 = CatalogCategory(
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Bolos',
);
CatalogProduct _product(int index, {CatalogCategory? category, String? name}) =>
    CatalogProduct(
      id: '${index.toString().padLeft(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: name ?? 'Cupcake número $index',
      price: index == 1 ? '1234.50' : '12.30',
      category: category ?? _category1,
      imageAvailable: index.isEven,
    );
CatalogPage _page(
  int number,
  List<CatalogProduct> items, {
  bool hasMore = false,
}) => CatalogPage(items: items, page: number, limit: 20, hasMore: hasMore);

class _AuthApi extends CustomerAuthApi {
  _AuthApi(this.tokens, {this.refreshedAccessToken, this.refreshStatus});
  final CustomerTokens tokens;
  final String? refreshedAccessToken;
  final AuthRequestStatus? refreshStatus;
  int refreshCalls = 0;
  @override
  Future<AuthRequestResult> login({
    required String email,
    required String password,
  }) async => AuthRequestResult(AuthRequestStatus.success, tokens: tokens);
  @override
  Future<AuthRequestResult> refresh(String refreshToken) async {
    refreshCalls++;
    return AuthRequestResult(
      refreshStatus ?? AuthRequestStatus.success,
      accessToken: refreshedAccessToken ?? tokens.accessToken,
    );
  }
}

class _CatalogApi extends CustomerCatalogApi {
  _CatalogApi(this.responses, {this.categoryResponses});
  final List<Future<CatalogPageResult> Function(int)> responses;
  final List<Future<CatalogCategoriesResult> Function()>? categoryResponses;
  int calls = 0;
  int categoryCalls = 0;
  final filters = <String?>[];
  final pages = <int>[];
  @override
  Future<CatalogCategoriesResult> fetchCategories({
    required String accessToken,
  }) {
    final index = categoryCalls++;
    if (categoryResponses != null) return categoryResponses![index]();
    return Future.value(
      const CatalogCategoriesResult(
        CatalogRequestStatus.success,
        categories: [_category1, _category2],
      ),
    );
  }

  @override
  Future<CatalogPageResult> fetchPage({
    required String accessToken,
    required int page,
    int limit = 20,
    String? categoryId,
  }) {
    filters.add(categoryId);
    pages.add(page);
    final response = responses[calls++];
    return response(page);
  }
}

Future<CustomerSession> _session({CustomerAuthApi? authApi}) async {
  final tokens = CustomerTokens(
    accessToken: _testToken('access'),
    refreshToken: _testToken('refresh'),
  );
  final session = CustomerSession(
    authApi: authApi ?? _AuthApi(tokens),
    storage: MemorySessionStorage(),
  );
  await session.restore();
  await session.signIn(email: 'cliente@example.com', password: 'senha');
  session.setForeground(false);
  return session;
}

void _disposeSession(CustomerSession session) {
  session.setForeground(false);
  session.dispose();
}

class _CartApi extends CustomerCartApi {
  int calls = 0;
  @override
  Future<CartResult> fetchCart({required String accessToken}) async {
    calls++;
    return const CartResult(
      CartRequestStatus.success,
      cart: CustomerCart(id: null, items: []),
    );
  }
}

Widget _app(
  CustomerSession session,
  CustomerCatalogApi api, {
  double scale = 1,
  CustomerCartApi? cartApi,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData.fromView(
      WidgetsBinding.instance.platformDispatcher.views.first,
    ).copyWith(textScaler: TextScaler.linear(scale)),
    child: StorefrontPage(session: session, api: api, cartApi: cartApi),
  ),
);

void main() {
  setUp(() {
    final binding = TestWidgetsFlutterBinding.ensureInitialized();
    binding.platformDispatcher.textScaleFactorTestValue = 1;
  });

  testWidgets('401 refreshes once and retries the catalog GET successfully', (
    tester,
  ) async {
    final tokens = CustomerTokens(
      accessToken: _testToken('access', 'before'),
      refreshToken: _testToken('refresh'),
    );
    final auth = _AuthApi(
      tokens,
      refreshedAccessToken: _testToken('access', 'after'),
    );
    final session = await _session(authApi: auth);
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async =>
          const CatalogPageResult(CatalogRequestStatus.unauthorized),
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, [_product(1)]),
      ),
    ]);
    await tester.pumpWidget(_app(session, api));
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 1);
    expect(api.calls, 2);
    expect(find.text('Cupcake número 1'), findsWidgets);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('definitive refresh after 401 ends session without retry', (
    tester,
  ) async {
    final tokens = CustomerTokens(
      accessToken: _testToken('access', 'expired'),
      refreshToken: _testToken('refresh'),
    );
    final auth = _AuthApi(
      tokens,
      refreshStatus: AuthRequestStatus.invalidToken,
    );
    final session = await _session(authApi: auth);
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async =>
          const CatalogPageResult(CatalogRequestStatus.unauthorized),
    ]);
    await tester.pumpWidget(_app(session, api));
    await tester.pump(const Duration(milliseconds: 100));
    expect(auth.refreshCalls, 1);
    expect(api.calls, 1);
    expect(session.isAuthenticated, isFalse);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('403 does not refresh and reports access denied', (tester) async {
    final tokens = CustomerTokens(
      accessToken: _testToken('access', 'forbidden'),
      refreshToken: _testToken('refresh'),
    );
    final auth = _AuthApi(tokens);
    final session = await _session(authApi: auth);
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async => const CatalogPageResult(CatalogRequestStatus.forbidden),
    ]);
    await tester.pumpWidget(_app(session, api));
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 0);
    expect(api.calls, 1);
    expect(find.text('Sua conta não tem acesso à vitrine.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'response arriving after logout cannot repopulate the storefront',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final response = Completer<CatalogPageResult>();
      final api = _CatalogApi([(page) => response.future]);
      await tester.pumpWidget(_app(session, api));
      await tester.pump();
      await session.signOut();
      response.complete(
        CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(1, [_product(1)]),
        ),
      );
      await tester.pump(const Duration(milliseconds: 50));
      expect(session.isAuthenticated, isFalse);
      expect(find.text('Cupcake número 1'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('late response after storefront is unmounted is discarded', (
    tester,
  ) async {
    final session = await _session();
    addTearDown(() => _disposeSession(session));
    final response = Completer<CatalogPageResult>();
    final api = _CatalogApi([(page) => response.future]);
    await tester.pumpWidget(_app(session, api));
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    response.complete(
      CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(1, [_product(1)]),
      ),
    );
    await tester.pump(const Duration(milliseconds: 50));
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'success shows multiple categories, BRL, fallback and accessible headings',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final api = _CatalogApi([
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [
            _product(1),
            _product(2),
            _product(3, category: _category2),
          ]),
        ),
      ]);
      await tester.pumpWidget(_app(session, api));
      await tester.pumpAndSettle();
      expect(find.text('Doces especiais e presentes'), findsWidgets);
      expect(find.text('Bolos'), findsWidgets);
      await tester.scrollUntilVisible(
        find.text('Destaques Artesanais'),
        300,
        scrollable: _verticalScrollable(),
      );
      await tester.scrollUntilVisible(
        find.text('Cupcake número 1').first,
        250,
        scrollable: _verticalScrollable(),
      );
      expect(find.text('Cupcake número 1'), findsWidgets);
      await tester.scrollUntilVisible(
        find.text('Cupcake número 2').first,
        250,
        scrollable: _verticalScrollable(),
      );
      expect(find.text('Cupcake número 2'), findsWidgets);
      expect(find.text('R\$ 1.234,50'), findsWidgets);
      expect(find.byIcon(Icons.cake_outlined), findsWidgets);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.label == 'Imagem do produto indisponível',
        ),
        findsWidgets,
      );
      expect(
        tester.getSemantics(find.text('Categorias')),
        matchesSemantics(label: 'Categorias', isHeader: true),
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'initial and next-page loading block duplicate actions and preserve items',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final first = Completer<CatalogPageResult>();
      final next = Completer<CatalogPageResult>();
      final api = _CatalogApi([(page) => first.future, (page) => next.future]);
      await tester.pumpWidget(_app(session, api));
      expect(find.bySemanticsLabel('Carregando produtos…'), findsOneWidget);
      first.complete(
        CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(1, [_product(1)], hasMore: true),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Carregar mais produtos', skipOffstage: false),
        250,
        scrollable: _verticalScrollable(),
      );
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(
              OutlinedButton,
              'Carregar mais produtos',
              skipOffstage: false,
            ),
          )
          .onPressed!
          .call();
      await tester.pump();
      expect(
        find.bySemanticsLabel('Carregando mais produtos…'),
        findsOneWidget,
      );
      expect(find.text('Cupcake número 1'), findsWidgets);
      next.complete(
        CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(2, [_product(2)]),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 2'), findsWidgets);
      expect(find.text('Fim dos produtos disponíveis.'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('valid empty response is distinct from error and can refresh', (
    tester,
  ) async {
    final session = await _session();
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, []),
      ),
      (page) async => CatalogPageResult(CatalogRequestStatus.unavailable),
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, [_product(1)]),
      ),
    ]);
    await tester.pumpWidget(_app(session, api));
    await tester.pumpAndSettle();
    expect(
      find.text('Não há produtos disponíveis no momento.'),
      findsOneWidget,
    );
    await tester.tap(find.widgetWithText(FilledButton, 'Atualizar').first);
    await tester.pumpAndSettle();
    expect(
      find.text('Não foi possível carregar os produtos. Tente novamente.'),
      findsOneWidget,
    );
    expect(find.text('Não há produtos disponíveis no momento.'), findsNothing);
    await tester.ensureVisible(find.text('Tentar carregar novamente'));
    await tester.tap(find.text('Tentar carregar novamente'));
    await tester.pumpAndSettle();
    expect(find.text('Cupcake número 1'), findsWidgets);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'network failure has safe retry and refresh replaces list without duplication',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final api = _CatalogApi([
        (page) async => CatalogPageResult(CatalogRequestStatus.unavailable),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(1), _product(2)], hasMore: true),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(2), _product(3)]),
        ),
      ]);
      await tester.pumpWidget(_app(session, api));
      await tester.pumpAndSettle();
      expect(
        find.text('Não foi possível carregar os produtos. Tente novamente.'),
        findsOneWidget,
      );
      expect(find.textContaining('Exception'), findsNothing);
      await tester.ensureVisible(find.text('Tentar carregar novamente'));
      final retry = find.widgetWithText(
        FilledButton,
        'Tentar carregar novamente',
      );
      await tester.tapAt(tester.getTopLeft(retry) + const Offset(12, 12));
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 1'), findsWidgets);
      await tester.scrollUntilVisible(
        find.text('Carregar mais produtos', skipOffstage: false),
        250,
        scrollable: _verticalScrollable(),
      );
      final loadMore = tester.widget<OutlinedButton>(
        find.widgetWithText(
          OutlinedButton,
          'Carregar mais produtos',
          skipOffstage: false,
        ),
      );
      loadMore.onPressed!.call();
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 1'), findsWidgets);
      expect(find.text('Cupcake número 2'), findsWidgets);
      expect(find.text('Cupcake número 3'), findsWidgets);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'pagination error retries the same page without duplicate or lost products',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final api = _CatalogApi([
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(1)], hasMore: true),
        ),
        (page) async => CatalogPageResult(CatalogRequestStatus.unavailable),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(1), _product(2)]),
        ),
      ]);
      await tester.pumpWidget(_app(session, api));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Carregar mais produtos'),
        250,
        scrollable: _verticalScrollable(),
      );
      tester
          .widget<OutlinedButton>(
            find.widgetWithText(
              OutlinedButton,
              'Carregar mais produtos',
              skipOffstage: false,
            ),
          )
          .onPressed!
          .call();
      await tester.pumpAndSettle();
      expect(
        find.text('Não foi possível carregar os produtos. Tente novamente.'),
        findsOneWidget,
      );
      await tester.scrollUntilVisible(
        find.text('Tentar carregar novamente'),
        250,
        scrollable: _verticalScrollable(),
      );
      await tester.ensureVisible(find.text('Tentar carregar novamente'));
      final retry = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Tentar carregar novamente'),
      );
      retry.onPressed!();
      await tester.pumpAndSettle();
      expect(api.pages, [1, 2, 2]);
      expect(find.text('Cupcake número 2'), findsWidgets);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'loading, empty and error remain usable at 320dp with enlarged text',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 800);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final pending = Completer<CatalogPageResult>();
      final api = _CatalogApi([
        (page) => pending.future,
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, []),
        ),
        (page) async => CatalogPageResult(CatalogRequestStatus.unavailable),
      ]);
      await tester.pumpWidget(_app(session, api, scale: 1.5));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is Semantics &&
              widget.properties.label == 'Carregando produtos…',
        ),
        findsOneWidget,
      );
      pending.complete(
        CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(1, [_product(1)]),
        ),
      );
      await tester.pumpAndSettle();
      await _pullToRefresh(tester);
      await tester.pumpAndSettle();
      expect(
        find.text('Não há produtos disponíveis no momento.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await _pullToRefresh(tester);
      await tester.pumpAndSettle();
      expect(
        find.text('Não foi possível carregar os produtos. Tente novamente.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'category A to B to A resets pages and keeps filtered pagination',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final api = _CatalogApi([
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(1)]),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(2)], hasMore: true),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(2), _product(3)]),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(4, category: _category2)]),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(5)]),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(6)]),
        ),
      ]);
      await tester.pumpWidget(_app(session, api));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Todas'))
            .selected,
        isTrue,
      );
      final categoryA = find.widgetWithText(
        ChoiceChip,
        _category1.name,
        skipOffstage: false,
      );
      await tester.ensureVisible(categoryA);
      tester.widget<ChoiceChip>(categoryA).onSelected!(true);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Carregar mais produtos'),
        250,
        scrollable: _verticalScrollable(),
      );
      tester
          .widget<OutlinedButton>(
            find.ancestor(
              of: find.text('Carregar mais produtos'),
              matching: find.byType(OutlinedButton),
            ),
          )
          .onPressed!
          .call();
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 2'), findsWidgets);
      await _selectCategory(tester, _category2.name);
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 2'), findsNothing);
      await _selectCategory(tester, _category1.name);
      await tester.pumpAndSettle();
      await _selectCategory(tester, 'Todas');
      await tester.pumpAndSettle();
      expect(api.filters, [
        null,
        _category1.id,
        _category1.id,
        _category2.id,
        _category1.id,
        null,
      ]);
      expect(api.pages, [1, 1, 2, 1, 1, 1]);
      expect(find.text('Cupcake número 6'), findsWidgets);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'late A response is discarded after B and filtered refresh stays on B',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final lateA = Completer<CatalogPageResult>();
      final api = _CatalogApi([
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, []),
        ),
        (page) => lateA.future,
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(3, category: _category2)]),
        ),
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, []),
        ),
      ]);
      await tester.pumpWidget(_app(session, api));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ChoiceChip, _category1.name));
      await tester.pump();
      await _selectCategory(tester, _category2.name);
      await tester.pumpAndSettle();
      lateA.complete(
        CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(1, [_product(1)]),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 1'), findsNothing);
      expect(find.text('Cupcake número 3'), findsWidgets);
      await _pullToRefresh(tester);
      await tester.pumpAndSettle();
      expect(api.filters.last, _category2.id);
      expect(
        find.text('Não há produtos disponíveis em ${_category2.name}.'),
        findsOneWidget,
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'category failure has specific retry while products remain usable',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 800);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final api = _CatalogApi(
        [
          (page) async => CatalogPageResult(
            CatalogRequestStatus.success,
            page: _page(page, [_product(1)]),
          ),
        ],
        categoryResponses: [
          () async =>
              const CatalogCategoriesResult(CatalogRequestStatus.unavailable),
          () async => const CatalogCategoriesResult(
            CatalogRequestStatus.success,
            categories: [_category1],
          ),
        ],
      );
      await tester.pumpWidget(_app(session, api, scale: 1.5));
      await tester.pumpAndSettle();
      expect(find.text('Cupcake número 1'), findsWidgets);
      expect(
        find.text('Não foi possível carregar as categorias.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Tentar categorias novamente'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(ChoiceChip, _category1.name), findsOneWidget);
      expect(api.calls, 1);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('category 401 refreshes and retries categories', (tester) async {
    final tokens = CustomerTokens(
      accessToken: _testToken('access', 'before-categories'),
      refreshToken: _testToken('refresh'),
    );
    final auth = _AuthApi(
      tokens,
      refreshedAccessToken: _testToken('access', 'after-categories'),
    );
    final session = await _session(authApi: auth);
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi(
      [
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, []),
        ),
      ],
      categoryResponses: [
        () async =>
            const CatalogCategoriesResult(CatalogRequestStatus.unauthorized),
        () async => const CatalogCategoriesResult(
          CatalogRequestStatus.success,
          categories: [_category1],
        ),
      ],
    );
    await tester.pumpWidget(_app(session, api));
    await tester.pumpAndSettle();
    expect(auth.refreshCalls, 1);
    expect(api.categoryCalls, 2);
    expect(find.widgetWithText(ChoiceChip, _category1.name), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('filtered error retries the same category and page', (
    tester,
  ) async {
    final session = await _session();
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, []),
      ),
      (page) async => const CatalogPageResult(CatalogRequestStatus.unavailable),
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, [_product(1)]),
      ),
    ]);
    await tester.pumpWidget(_app(session, api));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, _category1.name));
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Não foi possível carregar os produtos de ${_category1.name}. Tente novamente.',
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Tentar carregar novamente'));
    await tester.pumpAndSettle();
    expect(api.filters, [null, _category1.id, _category1.id]);
    expect(api.pages, [1, 1, 1]);
    expect(find.text('Cupcake número 1'), findsWidgets);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final width in [320.0, 390.0, 430.0]) {
    testWidgets(
      'responsive long catalog at ${width.toInt()}dp and enlarged text',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = Size(width, 800);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final session = await _session();
        addTearDown(() => _disposeSession(session));
        final items = List.generate(
          32,
          (i) => _product(
            i + 1,
            category: i > 15
                ? const CatalogCategory(
                    id: '22222222-2222-4222-8222-222222222222',
                    name:
                        'Uma categoria com nome deliberadamente muito comprido',
                  )
                : _category1,
            name: 'Cupcake artesanal de chocolate com recheio longo ${i + 1}',
          ),
        );
        final api = _CatalogApi([
          (page) async => CatalogPageResult(
            CatalogRequestStatus.success,
            page: _page(page, items),
          ),
        ]);
        await tester.pumpWidget(_app(session, api, scale: 1.5));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('R\$ 1.234,50'), findsWidgets);
        await tester.scrollUntilVisible(
          find.text('Cupcake artesanal de chocolate com recheio longo 32'),
          600,
          scrollable: _verticalScrollable(),
        );
        expect(tester.takeException(), isNull);
        expect(
          find.text('Cupcake artesanal de chocolate com recheio longo 32'),
          findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }

  testWidgets('Carrinho abre por push e o pop conserva a mesma vitrine', (
    tester,
  ) async {
    final session = await _session();
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, [_product(1)]),
      ),
    ]);
    final cartApi = _CartApi();
    await tester.pumpWidget(_app(session, api, cartApi: cartApi));
    await tester.pumpAndSettle();
    expect(find.text('Carrinho', skipOffstage: false), findsOneWidget);
    final storefront = tester.state(find.byType(StorefrontPage));
    await _activateInkWell(tester, 'Carrinho');
    await tester.pumpAndSettle();
    expect(find.byType(CartPage), findsOneWidget);
    expect(find.text('Seu carrinho está vazio.'), findsOneWidget);
    expect(cartApi.calls, 1);
    expect(api.calls, 1);
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.byType(CartPage), findsNothing);
    expect(tester.state(find.byType(StorefrontPage)), same(storefront));
    expect(find.text('Cupcake número 1'), findsWidgets);
    expect(api.calls, 1);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'footer navega entre Cardápio, Pedidos e Carrinho sem duplicar destinos',
    (tester) async {
      final session = await _session();
      addTearDown(() => _disposeSession(session));
      final api = _CatalogApi([
        (page) async => CatalogPageResult(
          CatalogRequestStatus.success,
          page: _page(page, [_product(1)]),
        ),
      ]);
      await tester.pumpWidget(_app(session, api, cartApi: _CartApi()));
      await tester.pumpAndSettle();
      for (final label in ['Cardápio', 'Carrinho', 'Pedidos', 'Perfil']) {
        expect(find.text(label), findsOneWidget);
      }
      await _activateInkWell(tester, 'Pedidos');
      await tester.pumpAndSettle();
      expect(find.byType(CustomerOrdersPage), findsOneWidget);
      expect(find.text('Carrinho'), findsOneWidget);
      await _activateInkWell(tester, 'Carrinho');
      await tester.pumpAndSettle();
      expect(find.byType(CartPage), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('modalidade e busca reagem ao toque e atualizam os produtos', (
    tester,
  ) async {
    final session = await _session();
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, [
          _product(1, name: 'Chocolate'),
          _product(2, name: 'Baunilha'),
        ]),
      ),
    ]);
    final cartApi = _CartApi();
    await tester.pumpWidget(_app(session, api, cartApi: cartApi));
    await tester.pumpAndSettle();
    await _activateInkWell(tester, 'Retirada');
    await _activateInkWell(tester, 'Carrinho');
    await tester.pumpAndSettle();
    expect(
      tester.widget<CartPage>(find.byType(CartPage)).initialFulfillmentMode,
      FulfillmentMode.pickup,
    );
    await tester.pageBack();
    await tester.pumpAndSettle();
    await _activateInkWell(tester, 'Delivery');
    await _activateInkWell(tester, 'Carrinho');
    await tester.pumpAndSettle();
    expect(
      tester.widget<CartPage>(find.byType(CartPage)).initialFulfillmentMode,
      FulfillmentMode.delivery,
    );
    await tester.pageBack();
    await tester.pumpAndSettle();
    final search = tester.widget<TextField>(
      find.byType(TextField, skipOffstage: false),
    );
    search.onChanged!('chocolate');
    await tester.pumpAndSettle();
    expect(find.text('Chocolate', skipOffstage: false), findsWidgets);
    expect(find.text('Baunilha', skipOffstage: false), findsNothing);
    tester
        .widget<IconButton>(
          find
              .ancestor(
                of: find.byTooltip('Limpar busca', skipOffstage: false),
                matching: find.byType(IconButton, skipOffstage: false),
              )
              .first,
        )
        .onPressed!
        .call();
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<TextField>(find.byType(TextField, skipOffstage: false))
          .controller
          ?.text,
      isEmpty,
    );
    expect(find.byTooltip('Limpar busca', skipOffstage: false), findsNothing);
    tester
        .widget<TextField>(find.byType(TextField, skipOffstage: false))
        .onChanged!('sem resultado');
    await tester.pumpAndSettle();
    expect(find.text('Chocolate', skipOffstage: false), findsNothing);
    expect(find.text('Baunilha', skipOffstage: false), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('busca dispensa foco fora, ao rolar e pela ação do teclado', (
    tester,
  ) async {
    final session = await _session();
    addTearDown(() => _disposeSession(session));
    final api = _CatalogApi([
      (page) async => CatalogPageResult(
        CatalogRequestStatus.success,
        page: _page(page, List.generate(8, (index) => _product(index + 1))),
      ),
    ]);
    await tester.pumpWidget(_app(session, api, cartApi: _CartApi()));
    await tester.pumpAndSettle();
    final search = find.byType(TextField);
    await tester.tap(search);
    await tester.enterText(search, 'cupcake');
    await tester.pump();
    expect(FocusManager.instance.primaryFocus, isNotNull);
    await tester.tap(find.text('Olá!'));
    await tester.pump();
    expect(tester.widget<TextField>(search).focusNode!.hasFocus, isFalse);

    await tester.tap(search);
    await tester.enterText(search, 'número');
    await tester.pump();
    await tester.drag(find.byType(ListView).first, const Offset(0, -180));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(search).focusNode!.hasFocus, isFalse);

    await tester.drag(find.byType(ListView).first, const Offset(0, 500));
    await tester.pumpAndSettle();
    await tester.ensureVisible(search);
    await tester.tap(search);
    await tester.enterText(search, 'chocolate');
    await tester.pump();
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pump();
    expect(tester.widget<TextField>(search).focusNode!.hasFocus, isFalse);
    await tester.ensureVisible(find.byTooltip('Limpar busca'));
    await tester.tap(find.byTooltip('Limpar busca'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(search).controller?.text, isEmpty);
    await _activateInkWell(tester, 'Carrinho');
    await tester.pumpAndSettle();
    expect(find.byType(CartPage), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  for (final width in [320.0, 390.0, 430.0]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets(
        'vitrine se adapta a ${width.toInt()} dp e texto ${scale.toInt()}x sem overflow',
        (tester) async {
          tester.view.devicePixelRatio = 1;
          tester.view.physicalSize = Size(width, 800);
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final session = await _session();
          addTearDown(() => _disposeSession(session));
          final api = _CatalogApi([
            (page) async => CatalogPageResult(
              CatalogRequestStatus.success,
              page: _page(page, [_product(1)]),
            ),
          ]);
          await tester.pumpWidget(_app(session, api, scale: scale));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          expect(find.text('Cupcake Mobile'), findsOneWidget);
          expect(find.text('Categorias', skipOffstage: false), findsOneWidget);
          expect(
            find.text('Destaques Artesanais', skipOffstage: false),
            findsOneWidget,
          );
          expect(find.text('Início'), findsNothing);
          expect(find.text('Cardápio'), findsOneWidget);
          expect(find.text('Carrinho'), findsOneWidget);
          expect(find.text('Pedidos'), findsOneWidget);
          expect(find.text('Perfil'), findsOneWidget);
          expect(find.byType(FloatingActionButton), findsNothing);
          await tester.pumpWidget(const SizedBox.shrink());
        },
      );
    }
  }
}

Future<void> _pullToRefresh(WidgetTester tester) async {
  await tester.drag(_verticalScrollable(), const Offset(0, 450));
  await tester.pumpAndSettle();
}

Finder _verticalScrollable() => find
    .byWidgetPredicate(
      (widget) =>
          widget is Scrollable && widget.axisDirection == AxisDirection.down,
      skipOffstage: false,
    )
    .first;

String _testToken(String type, [String id = 'fixed']) {
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  String encode(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  return '${encode({'alg': 'HS256', 'typ': 'JWT'})}.${encode({'sub': '9b72c770-bc74-4c77-82c7-205c2d91628a', 'perfil': 'CLIENTE', 'type': type, 'jti': id, 'iat': now, 'exp': now + 3600})}.signature';
}

Future<void> _activateInkWell(WidgetTester tester, String label) async {
  final visible = find.text(label);
  final labelFinder = visible.evaluate().isNotEmpty
      ? visible
      : find.text(label, skipOffstage: false);
  final target = find
      .ancestor(
        of: labelFinder,
        matching: find.byType(InkWell, skipOffstage: false),
      )
      .first;
  tester.widget<InkWell>(target).onTap!.call();
  await tester.pumpAndSettle();
}

Future<void> _selectCategory(WidgetTester tester, String label) async {
  final chip = find.widgetWithText(ChoiceChip, label, skipOffstage: false);
  tester.widget<ChoiceChip>(chip).onSelected!(true);
}
