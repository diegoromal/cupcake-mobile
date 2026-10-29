import 'dart:convert';

import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:cupcake_mobile/features/cart/data/customer_cart_api.dart';
import 'package:cupcake_mobile/features/cart/presentation/cart_page.dart';
import 'package:cupcake_mobile/features/catalog/data/customer_catalog_api.dart';
import 'package:cupcake_mobile/features/catalog/presentation/storefront_page.dart';
import 'package:cupcake_mobile/features/checkout/data/customer_order_api.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'session_test_support.dart';

const _customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const _productId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const _itemId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const _orderId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const _categoryId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

String _token(String type) {
  String part(Object value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
  final now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
  return '${part({'alg': 'HS256'})}.${part({'sub': _customerId, 'perfil': 'CLIENTE', 'type': type, 'iat': now, 'exp': now + 3600})}.signature';
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

class _CatalogApi extends CustomerCatalogApi {
  static const _category = CatalogCategory(id: _categoryId, name: 'Clássicos');
  static const _product = CatalogProduct(
    id: _productId,
    name: 'Cupcake de chocolate',
    price: '12.50',
    category: _category,
    imageAvailable: false,
  );

  @override
  Future<CatalogCategoriesResult> fetchCategories({
    required String accessToken,
  }) async => const CatalogCategoriesResult(
    CatalogRequestStatus.success,
    categories: [_category],
  );

  @override
  Future<CatalogPageResult> fetchPage({
    required String accessToken,
    required int page,
    int limit = 20,
    String? categoryId,
  }) async => CatalogPageResult(
    CatalogRequestStatus.success,
    page: CatalogPage(
      items: [_product],
      page: page,
      limit: limit,
      hasMore: false,
    ),
  );

  @override
  Future<CatalogDetailResult> fetchDetail({
    required String productId,
    required String accessToken,
  }) async => CatalogDetailResult(
    CatalogRequestStatus.success,
    product: const CatalogProductDetail(
      id: _productId,
      name: 'Cupcake de chocolate',
      description: 'Massa de chocolate',
      price: '12.50',
      category: _category,
      imageAvailable: false,
    ),
  );
}

class _CartApi extends CustomerCartApi {
  _CartApi({this.additions = 0});

  int additions;

  @override
  Future<CartResult> addItem({
    required String accessToken,
    required String productId,
    required int quantity,
    required List<String> personalizationIds,
  }) async {
    expect(productId, _productId);
    expect(quantity, 1);
    additions++;
    return const CartResult(CartRequestStatus.success);
  }

  @override
  Future<CartResult> fetchCart({required String accessToken}) async {
    final cart = additions == 0
        ? const CustomerCart(id: null, items: [])
        : const CustomerCart(
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            items: [
              CartItem(
                id: _itemId,
                productId: _productId,
                name: 'Cupcake de chocolate',
                imageAvailable: false,
                quantity: 1,
                personalizations: [],
                unitPrice: '12.50',
                subtotal: '12.50',
                available: true,
                reason: null,
              ),
            ],
            subtotal: '12.50',
            total: '12.50',
          );
    return CartResult(CartRequestStatus.success, cart: cart);
  }
}

class _OrderApi extends CustomerOrderApi {
  int reviews = 0;
  int confirmations = 0;

  @override
  Future<OrderResult> review(
    String token,
    String mode,
    String? addressId,
  ) async {
    expect(mode, 'RETIRADA');
    expect(addressId, isNull);
    reviews++;
    return const OrderResult(
      OrderStatus.success,
      value: {
        'revisaoId':
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'modalidade': 'RETIRADA',
        'valorItens': '12.50',
        'freteAplicado': '0.00',
        'total': '12.50',
        'itens': [
          {
            'produtoId': _productId,
            'nome': 'Cupcake de chocolate',
            'quantidade': 1,
            'precoAplicado': '12.50',
            'subtotalAplicado': '12.50',
            'personalizacoes': [],
          },
        ],
        'enderecoEntregaSnapshot': null,
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
    expect(mode, 'RETIRADA');
    expect(addressId, isNull);
    expect(reviewId, hasLength(64));
    confirmations++;
    return const OrderResult(
      OrderStatus.success,
      value: {
        'id': _orderId,
        'identificadorNegocio': 'PED-99',
        'total': '12.50',
      },
    );
  }
}

void main() {
  testWidgets('cliente percorre vitrine, produto e carrinho', (tester) async {
    final session = await _signedInSession();
    addTearDown(session.dispose);
    final catalog = _CatalogApi();
    final cart = _CartApi();
    await tester.pumpWidget(
      MaterialApp(
        home: StorefrontPage(session: session, api: catalog, cartApi: cart),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Cupcake de chocolate'), findsOneWidget);

    await tester.tap(find.text('Cupcake de chocolate'));
    await tester.pumpAndSettle();
    expect(find.text('Massa de chocolate'), findsOneWidget);
    await tester.drag(find.byType(ListView).last, const Offset(0, -700));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Adicionar ao carrinho'));
    await tester.pumpAndSettle();
    expect(cart.additions, 1);

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.text('Carrinho'));
    await tester.pumpAndSettle();
    expect(find.text('Subtotal: R\$ 12,50'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('cliente seleciona retirada e confirma o pedido', (tester) async {
    final session = await _signedInSession();
    addTearDown(session.dispose);
    final order = _OrderApi();
    await tester.pumpWidget(
      MaterialApp(
        home: CartPage(
          session: session,
          cartApi: _CartApi(additions: 1),
          catalogApi: _CatalogApi(),
          orderApi: order,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();

    expect(find.text('Forma de recebimento'), findsOneWidget);
    await tester.tap(find.text('Retirada'));
    await tester.pumpAndSettle();
    expect(find.text('Retirada selecionada. Frete: R\$ 0,00'), findsOneWidget);
    await tester.tap(find.text('Continuar'));
    await tester.pumpAndSettle();
    expect(order.reviews, 1);
    expect(find.text('Revisar Pedido'), findsOneWidget);
    expect(find.text('Total: R\$ 12.50'), findsOneWidget);

    await tester.tap(find.text('Confirmar pedido'));
    await tester.pumpAndSettle();
    expect(order.confirmations, 1);
    expect(find.text('Pagamento'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}

Future<CustomerSession> _signedInSession() async {
  final session = createCustomerSession(authApi: _AuthApi());
  await session.restore();
  await session.signIn(email: 'cliente@example.test', password: 'senha');
  session.setForeground(false);
  return session;
}
