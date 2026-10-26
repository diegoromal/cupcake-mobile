import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

final _uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

const _statuses = {
  'PENDENTE_PAGAMENTO',
  'PAGO',
  'EM_PREPARO',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'PRONTO_PARA_RETIRADA',
  'RETIRADO',
  'EXPIRADO',
  'CANCELADO',
};

enum CourierOrdersStatus {
  success,
  unauthorized,
  forbidden,
  unavailable,
  notConfigured,
}

class CourierOrder {
  const CourierOrder({
    required this.id,
    required this.businessNumber,
    required this.status,
  });

  final String id;
  final String businessNumber;
  final String status;

  static CourierOrder? parse(Object? value) {
    if (value is! Map<String, dynamic> ||
        value.length != 3 ||
        value['id'] is! String ||
        !_uuidPattern.hasMatch(value['id'] as String) ||
        value['identificadorNegocio'] is! String ||
        (value['identificadorNegocio'] as String).isEmpty ||
        value['statusAtual'] is! String ||
        !_statuses.contains(value['statusAtual'])) {
      return null;
    }
    return CourierOrder(
      id: value['id'] as String,
      businessNumber: value['identificadorNegocio'] as String,
      status: value['statusAtual'] as String,
    );
  }
}

class CourierOrdersResult {
  const CourierOrdersResult(this.status, {this.orders});

  final CourierOrdersStatus status;
  final List<CourierOrder>? orders;
}

class CourierOrdersApi {
  CourierOrdersApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<CourierOrdersResult> fetchOrders({required String accessToken}) async {
    final uri = _config.courierOrdersUri;
    if (uri == null) {
      return const CourierOrdersResult(CourierOrdersStatus.notConfigured);
    }
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
        return const CourierOrdersResult(CourierOrdersStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const CourierOrdersResult(CourierOrdersStatus.forbidden);
      }
      if (response.statusCode != HttpStatus.ok) {
        return const CourierOrdersResult(CourierOrdersStatus.unavailable);
      }
      final body = jsonDecode(
        await utf8.decoder.bind(response.timeout(timeout)).join(),
      );
      if (body is! List) {
        return const CourierOrdersResult(CourierOrdersStatus.unavailable);
      }
      final orders = <CourierOrder>[];
      final ids = <String>{};
      for (final value in body) {
        final order = CourierOrder.parse(value);
        if (order == null || !ids.add(order.id)) {
          return const CourierOrdersResult(CourierOrdersStatus.unavailable);
        }
        orders.add(order);
      }
      return CourierOrdersResult(
        CourierOrdersStatus.success,
        orders: List.unmodifiable(orders),
      );
    } on Object {
      return const CourierOrdersResult(CourierOrdersStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }
}
