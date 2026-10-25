import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

final _uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

final _moneyPattern = RegExp(r'^\d+\.\d{2}$');

const _cartKeys = {'id', 'itens', 'subtotal', 'total'};
const _itemKeys = {
  'id',
  'produtoId',
  'nome',
  'imagemDisponivel',
  'quantidade',
  'personalizacoes',
  'precoUnitario',
  'subtotal',
  'disponivel',
  'motivo',
};
const _personalizationKeys = {'id', 'nome'};

enum CartRequestStatus {
  success,
  unauthorized,
  forbidden,
  conflict,
  notFound,
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
    required this.unitPrice,
    required this.subtotal,
    required this.available,
    required this.reason,
  });
  final String id;
  final String productId;
  final String name;
  final bool imageAvailable;
  final int quantity;
  final List<CartPersonalization> personalizations;
  final String? unitPrice;
  final String? subtotal;
  final bool available;
  final String? reason;

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
    final available = value['disponivel'];
    final reason = value['motivo'];
    final unitPrice = value['precoUnitario'];
    final subtotal = value['subtotal'];
    if (id is! String ||
        !_uuidPattern.hasMatch(id) ||
        productId is! String ||
        !_uuidPattern.hasMatch(productId) ||
        name is! String ||
        name.isEmpty ||
        imageAvailable is! bool ||
        quantity is! int ||
        quantity < 1 ||
        rawOptions is! List ||
        available is! bool ||
        !_pairedMoney(unitPrice, subtotal) ||
        (available && (reason != null || unitPrice is! String)) ||
        (!available && (reason is! String || reason.isEmpty))) {
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
      unitPrice: unitPrice as String?,
      subtotal: subtotal as String?,
      available: available,
      reason: reason as String?,
    );
  }
}

class CustomerCart {
  const CustomerCart({
    required this.id,
    required this.items,
    this.subtotal = '0.00',
    this.total = '0.00',
  });
  final String? id;
  final List<CartItem> items;
  final String subtotal;
  final String total;

  static CustomerCart? parse(Object? value) {
    if (value is! Map<String, dynamic> || !_sameKeys(value, _cartKeys)) {
      return null;
    }
    final rawId = value['id'];
    final rawItems = value['itens'];
    final subtotal = value['subtotal'];
    final total = value['total'];
    if ((rawId != null &&
            (rawId is! String || !_uuidPattern.hasMatch(rawId))) ||
        rawItems is! List ||
        subtotal is! String ||
        !_moneyPattern.hasMatch(subtotal) ||
        total is! String ||
        !_moneyPattern.hasMatch(total)) {
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
    if (items.isEmpty && (subtotal != '0.00' || total != '0.00')) return null;
    return CustomerCart(
      id: rawId as String?,
      items: List.unmodifiable(items),
      subtotal: subtotal,
      total: total,
    );
  }
}

class CartResult {
  const CartResult(this.status, {this.cart, this.message});
  final CartRequestStatus status;
  final CustomerCart? cart;
  final String? message;
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

  Future<CartResult> addItem({
    required String accessToken,
    required String productId,
    required int quantity,
    required List<String> personalizationIds,
  }) async {
    final uri = _config.cartItemsUri;
    if (uri == null) return const CartResult(CartRequestStatus.notConfigured);
    final client = _clientFactory();
    try {
      final request = await client.postUrl(uri).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(
        HttpHeaders.authorizationHeader,
        'Bearer $accessToken',
      );
      request.headers.contentType = ContentType.json;
      request.write(
        jsonEncode({
          'produtoId': productId,
          'quantidade': quantity,
          'personalizacaoIds': personalizationIds,
        }),
      );
      final response = await request.close().timeout(timeout);
      if (response.statusCode == HttpStatus.unauthorized) {
        return const CartResult(CartRequestStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const CartResult(CartRequestStatus.forbidden);
      }
      if (response.statusCode == HttpStatus.notFound) {
        return const CartResult(CartRequestStatus.notFound);
      }
      if (response.statusCode == HttpStatus.conflict) {
        return CartResult(
          CartRequestStatus.conflict,
          message: await _conflictMessage(response),
        );
      }
      if (response.statusCode != HttpStatus.created) {
        return const CartResult(CartRequestStatus.unavailable);
      }
      final created = jsonDecode(
        await utf8.decoder.bind(response.timeout(timeout)).join(),
      );
      if (!_matchesCreatedItem(
        created,
        productId,
        quantity,
        personalizationIds,
      )) {
        return const CartResult(CartRequestStatus.unavailable);
      }
      return const CartResult(CartRequestStatus.success);
    } on Object {
      return const CartResult(CartRequestStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }

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

  Future<CartResult> updateQuantity({
    required String accessToken,
    required String itemId,
    required int quantity,
  }) => _mutate(
    accessToken: accessToken,
    itemId: itemId,
    method: 'PATCH',
    body: jsonEncode({'quantidade': quantity}),
  );

  Future<CartResult> removeItem({
    required String accessToken,
    required String itemId,
  }) => _mutate(accessToken: accessToken, itemId: itemId, method: 'DELETE');

  Future<CartResult> _mutate({
    required String accessToken,
    required String itemId,
    required String method,
    String? body,
  }) async {
    final uri = _config.cartItemUri(itemId);
    if (uri == null) return const CartResult(CartRequestStatus.notConfigured);
    final client = _clientFactory();
    try {
      final request = method == 'PATCH'
          ? await client.patchUrl(uri).timeout(timeout)
          : await client.deleteUrl(uri).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(
        HttpHeaders.authorizationHeader,
        'Bearer $accessToken',
      );
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(body);
      }
      final response = await request.close().timeout(timeout);
      if (response.statusCode == HttpStatus.unauthorized) {
        return const CartResult(CartRequestStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const CartResult(CartRequestStatus.forbidden);
      }
      if (response.statusCode == HttpStatus.notFound) {
        return const CartResult(CartRequestStatus.notFound);
      }
      if (response.statusCode == HttpStatus.conflict) {
        return CartResult(
          CartRequestStatus.conflict,
          message: await _conflictMessage(response),
        );
      }
      if (method == 'DELETE') {
        if (response.statusCode != HttpStatus.noContent) {
          return const CartResult(CartRequestStatus.unavailable);
        }
        return const CartResult(CartRequestStatus.success);
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

  Future<String> _conflictMessage(HttpClientResponse response) async {
    try {
      final raw = jsonDecode(
        await utf8.decoder.bind(response.timeout(timeout)).join(),
      );
      if (raw is Map<String, dynamic> &&
          raw['message'] is String &&
          (raw['message'] as String).isNotEmpty) {
        return raw['message'] as String;
      }
    } on Object {
      return 'Quantidade superior à disponibilidade.';
    }
    return 'Quantidade superior à disponibilidade.';
  }
}

bool _matchesCreatedItem(
  Object? value,
  String productId,
  int quantity,
  List<String> personalizationIds,
) {
  if (value is! Map<String, dynamic> ||
      !_sameKeys(value, const {
        'id',
        'carrinhoId',
        'produtoId',
        'quantidade',
        'personalizacaoIds',
      }) ||
      value['id'] is! String ||
      !_uuidPattern.hasMatch(value['id'] as String) ||
      value['carrinhoId'] is! String ||
      !_uuidPattern.hasMatch(value['carrinhoId'] as String) ||
      value['produtoId'] is! String ||
      (value['produtoId'] as String).toLowerCase() != productId.toLowerCase() ||
      value['quantidade'] != quantity ||
      value['personalizacaoIds'] is! List) {
    return false;
  }
  final ids = value['personalizacaoIds'] as List;
  if (ids.length != personalizationIds.length ||
      ids.any((id) => id is! String || !_uuidPattern.hasMatch(id))) {
    return false;
  }
  return ids.map((id) => (id as String).toLowerCase()).toSet().length ==
          ids.length &&
      ids
          .map((id) => (id as String).toLowerCase())
          .toSet()
          .containsAll(personalizationIds.map((id) => id.toLowerCase()));
}

bool _sameKeys(Map<String, dynamic> value, Set<String> keys) =>
    value.length == keys.length && value.keys.every(keys.contains);

bool _pairedMoney(Object? unitPrice, Object? subtotal) {
  final unitOk =
      unitPrice == null ||
      (unitPrice is String && _moneyPattern.hasMatch(unitPrice));
  final subtotalOk =
      subtotal == null ||
      (subtotal is String && _moneyPattern.hasMatch(subtotal));
  return unitOk && subtotalOk && (unitPrice == null) == (subtotal == null);
}
