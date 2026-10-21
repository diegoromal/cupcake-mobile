import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

final _uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

const _cartKeys = {'id', 'itens'};
const _itemKeys = {
  'id',
  'produtoId',
  'nome',
  'imagemDisponivel',
  'quantidade',
  'personalizacoes',
};
const _personalizationKeys = {'id', 'nome'};

enum CartRequestStatus {
  success,
  unauthorized,
  forbidden,
  unavailable,
  notConfigured,
}

class CartPersonalization {
  const CartPersonalization({required this.id, required this.name});
  final String id;
  final String name;

  static CartPersonalization? parse(Object? value) {
    if (value is! Map<String, dynamic> ||
        !_sameKeys(value, _personalizationKeys)) {
      return null;
    }
    final id = value['id'];
    final name = value['nome'];
    if (id is! String ||
        !_uuidPattern.hasMatch(id) ||
        name is! String ||
        name.isEmpty) {
      return null;
    }
    return CartPersonalization(id: id, name: name);
  }
}

class CartItem {
  const CartItem({
    required this.id,
    required this.productId,
    required this.name,
    required this.imageAvailable,
    required this.quantity,
    required this.personalizations,
  });
  final String id;
  final String productId;
  final String name;
  final bool imageAvailable;
  final int quantity;
  final List<CartPersonalization> personalizations;

  static CartItem? parse(Object? value) {
    if (value is! Map<String, dynamic> || !_sameKeys(value, _itemKeys)) {
      return null;
    }
    final id = value['id'];
    final productId = value['produtoId'];
    final name = value['nome'];
    final imageAvailable = value['imagemDisponivel'];
    final quantity = value['quantidade'];
    final rawOptions = value['personalizacoes'];
    if (id is! String ||
        !_uuidPattern.hasMatch(id) ||
        productId is! String ||
        !_uuidPattern.hasMatch(productId) ||
        name is! String ||
        name.isEmpty ||
        imageAvailable is! bool ||
        quantity is! int ||
        quantity < 1 ||
        rawOptions is! List) {
      return null;
    }
    final personalizations = <CartPersonalization>[];
    final ids = <String>{};
    for (final raw in rawOptions) {
      final option = CartPersonalization.parse(raw);
      if (option == null || !ids.add(option.id)) return null;
      personalizations.add(option);
    }
    return CartItem(
      id: id,
      productId: productId,
      name: name,
      imageAvailable: imageAvailable,
      quantity: quantity,
      personalizations: List.unmodifiable(personalizations),
    );
  }
}

class CustomerCart {
  const CustomerCart({required this.id, required this.items});
  final String? id;
  final List<CartItem> items;

  static CustomerCart? parse(Object? value) {
    if (value is! Map<String, dynamic> || !_sameKeys(value, _cartKeys)) {
      return null;
    }
    final rawId = value['id'];
    final rawItems = value['itens'];
    if ((rawId != null &&
            (rawId is! String || !_uuidPattern.hasMatch(rawId))) ||
        rawItems is! List) {
      return null;
    }
    final items = <CartItem>[];
    final ids = <String>{};
    for (final raw in rawItems) {
      final item = CartItem.parse(raw);
      if (item == null || !ids.add(item.id)) return null;
      items.add(item);
    }
    if (rawId == null && items.isNotEmpty) return null;
    return CustomerCart(id: rawId as String?, items: List.unmodifiable(items));
  }
}

class CartResult {
  const CartResult(this.status, {this.cart});
  final CartRequestStatus status;
  final CustomerCart? cart;
}

class CustomerCartApi {
  CustomerCartApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<CartResult> fetchCart({required String accessToken}) async {
    final uri = _config.cartUri;
    if (uri == null) return const CartResult(CartRequestStatus.notConfigured);
    final client = _clientFactory();
    try {
      final request = await client.getUrl(uri).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(
        HttpHeaders.authorizationHeader,
        'Bearer $accessToken',
      );
      final response = await request.close().timeout(timeout);
      if (response.statusCode == HttpStatus.unauthorized) {
        return const CartResult(CartRequestStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const CartResult(CartRequestStatus.forbidden);
      }
      if (response.statusCode != HttpStatus.ok) {
        return const CartResult(CartRequestStatus.unavailable);
      }
      final cart = CustomerCart.parse(
        jsonDecode(await utf8.decoder.bind(response.timeout(timeout)).join()),
      );
      return cart == null
          ? const CartResult(CartRequestStatus.unavailable)
          : CartResult(CartRequestStatus.success, cart: cart);
    } on Object {
      return const CartResult(CartRequestStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }
}

bool _sameKeys(Map<String, dynamic> value, Set<String> keys) =>
    value.length == keys.length && value.keys.every(keys.contains);
