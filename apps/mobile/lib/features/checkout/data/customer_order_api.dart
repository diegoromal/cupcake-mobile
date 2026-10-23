import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

enum OrderStatus {
  success,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unavailable,
  timeout,
  invalidResponse,
  networkError,
}

class OrderResult {
  const OrderResult(this.status, {this.value});
  final OrderStatus status;
  final Map<String, dynamic>? value;
}

class CustomerOrderApi {
  CustomerOrderApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;
  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<OrderResult> review(String token, String mode, String? addressId) =>
      _post(_config.orderReviewUri, token, {
        'modalidade': mode,
        'enderecoId': ?addressId,
      }, review: true);

  Future<OrderResult> confirm(
    String token,
    String mode,
    String? addressId,
    String attemptId,
    String reviewId,
  ) => _post(_config.ordersUri, token, {
    'modalidade': mode,
    'enderecoId': ?addressId,
    'tentativaId': attemptId,
    'revisaoId': reviewId,
  }, review: false);

  Future<OrderResult> _post(
    Uri? uri,
    String token,
    Map<String, Object> body, {
    required bool review,
  }) async {
    if (uri == null) return const OrderResult(OrderStatus.unavailable);
    final client = _clientFactory();
    try {
      final request = await client.postUrl(uri).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
      final response = await request.close().timeout(timeout);
      switch (response.statusCode) {
        case 401:
          return const OrderResult(OrderStatus.unauthorized);
        case 403:
          return const OrderResult(OrderStatus.forbidden);
        case 404:
          return const OrderResult(OrderStatus.notFound);
        case 409:
          return const OrderResult(OrderStatus.conflict);
        case 503:
          return const OrderResult(OrderStatus.unavailable);
      }
      if (response.statusCode != 201) {
        return const OrderResult(OrderStatus.unavailable);
      }
      final decoded = jsonDecode(
        await utf8.decoder.bind(response.timeout(timeout)).join(),
      );
      if (decoded is! Map<String, dynamic>) {
        return const OrderResult(OrderStatus.invalidResponse);
      }
      if (review ? !_validReview(decoded) : !_validOrder(decoded)) {
        return const OrderResult(OrderStatus.invalidResponse);
      }
      return OrderResult(OrderStatus.success, value: decoded);
    } on TimeoutException {
      return const OrderResult(OrderStatus.timeout);
    } on FormatException {
      return const OrderResult(OrderStatus.invalidResponse);
    } on SocketException {
      return const OrderResult(OrderStatus.networkError);
    } on Object {
      return const OrderResult(OrderStatus.networkError);
    } finally {
      client.close(force: true);
    }
  }
}

bool _validReview(Map<String, dynamic> data) {
  final items = data['itens'];
  if (data['revisaoId'] is! String ||
      !RegExp(r'^[a-f0-9]{64}$').hasMatch(data['revisaoId'] as String) ||
      data['modalidade'] is! String ||
      data['valorItens'] is! String ||
      data['freteAplicado'] is! String ||
      data['total'] is! String ||
      items is! List ||
      items.isEmpty) {
    return false;
  }
  final money = RegExp(r'^\d+\.\d{2}$');
  if (!money.hasMatch(data['valorItens'] as String) ||
      !money.hasMatch(data['freteAplicado'] as String) ||
      !money.hasMatch(data['total'] as String)) {
    return false;
  }
  if (data['modalidade'] == 'ENTREGA' &&
      data['enderecoEntregaSnapshot'] is! Map<String, dynamic>) {
    return false;
  }
  if (data['modalidade'] != 'ENTREGA' && data['modalidade'] != 'RETIRADA') {
    return false;
  }
  if (data['modalidade'] == 'RETIRADA' &&
      (data['enderecoEntregaSnapshot'] != null ||
          data['freteAplicado'] != '0.00')) {
    return false;
  }
  final address = data['enderecoEntregaSnapshot'];
  if (address is Map<String, dynamic> &&
      [
        'rua',
        'numero',
        'bairro',
        'cidade',
        'cep',
      ].any((key) => address[key] is! String)) {
    return false;
  }
  for (final item in items) {
    if (item is! Map<String, dynamic> ||
        item['produtoId'] is! String ||
        item['nome'] is! String ||
        item['quantidade'] is! int ||
        item['quantidade'] < 1 ||
        item['precoAplicado'] is! String ||
        item['subtotalAplicado'] is! String ||
        item['personalizacoes'] is! List ||
        !money.hasMatch(item['precoAplicado'] as String) ||
        !money.hasMatch(item['subtotalAplicado'] as String)) {
      return false;
    }
    for (final option in item['personalizacoes'] as List) {
      if (option is! Map<String, dynamic> ||
          option['nomeAplicado'] is! String) {
        return false;
      }
    }
  }
  return true;
}

bool _validOrder(Map<String, dynamic> data) =>
    data['id'] is String &&
    RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false,
    ).hasMatch(data['id'] as String) &&
    data['identificadorNegocio'] is String &&
    data['total'] is String &&
    RegExp(r'^\d+\.\d{2}$').hasMatch(data['total'] as String);
