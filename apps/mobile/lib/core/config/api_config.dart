import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig({String? baseUrl}) : _baseUrl = baseUrl ?? _configuredBaseUrl;

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');
  static final _itemIdPattern = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  final String _baseUrl;

  Uri? get usersUri {
    final baseUri = _validBaseUri;
    return baseUri?.resolve('/users');
  }

  Uri? get customerLoginUri => _validBaseUri?.resolve('/auth/login');

  Uri? get refreshUri => _validBaseUri?.resolve('/auth/refresh');

  Uri? catalogPageUri(int page, int limit, {String? categoryId}) =>
      _validBaseUri
          ?.resolve('/catalogo/produtos')
          .replace(
            queryParameters: {
              'page': '$page',
              'limit': '$limit',
              'categoriaId': ?categoryId,
            },
          );

  Uri? get catalogCategoriesUri =>
      _validBaseUri?.resolve('/catalogo/categorias');

  Uri? catalogImageUri(String productId) =>
      _validBaseUri?.resolve('/catalogo/produtos/$productId/imagem');

  Uri? catalogDetailUri(String productId) =>
      _validBaseUri?.resolve('/catalogo/produtos/$productId');

  Uri? catalogPriceUri(String productId) =>
      _validBaseUri?.resolve('/catalogo/produtos/$productId/preco');

  Uri? get cartUri => _validBaseUri?.resolve('/carrinho');

  Uri? get cartItemsUri => _validBaseUri?.resolve('/carrinho/itens');

  Uri? get orderReviewUri => _validBaseUri?.resolve('/pedidos/revisao');

  Uri? get ordersUri => _validBaseUri?.resolve('/pedidos');

  Uri? paymentUri(String orderId, String method) {
    if (!_itemIdPattern.hasMatch(orderId) ||
        (method != 'pix' && method != 'cartao')) {
      return null;
    }
    return _validBaseUri?.resolve('/pedidos/$orderId/pagamentos/$method');
  }

  Uri? paymentAttemptUri(String orderId, String method, String attemptId) {
    if (!_itemIdPattern.hasMatch(attemptId)) return null;
    final uri = paymentUri(orderId, method);
    return uri?.resolve('${uri.path}/$attemptId');
  }

  Uri? get addressesUri => _validBaseUri?.resolve('/enderecos');
  Uri? cepUri(String cep) => _validBaseUri?.resolve('/enderecos/cep/$cep');
  Uri? geocodingUri(String id) {
    if (!_itemIdPattern.hasMatch(id)) return null;
    return _validBaseUri?.resolve('/enderecos/$id/geocodificacao');
  }

  Uri? coverageFreightUri(String id) {
    if (!_itemIdPattern.hasMatch(id)) return null;
    return _validBaseUri?.resolve('/enderecos/$id/cobertura-frete');
  }

  Uri? cartItemUri(String itemId) {
    if (!_itemIdPattern.hasMatch(itemId)) return null;
    return _validBaseUri?.resolve('/carrinho/itens/$itemId');
  }

  Uri? get _validBaseUri {
    final value = _baseUrl.trim();
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        (uri.scheme != 'https' && uri.scheme != 'http') ||
        (uri.scheme == 'http' &&
            !const {'localhost', '127.0.0.1', '::1'}.contains(uri.host) &&
            !(!kReleaseMode &&
                const bool.fromEnvironment('ALLOW_LOCAL_HTTP_API') &&
                const {'172.25.0.17', '192.168.18.3'}.contains(uri.host))) ||
        uri.userInfo.isNotEmpty ||
        uri.query.isNotEmpty ||
        uri.fragment.isNotEmpty ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      return null;
    }
    return uri;
  }
}
