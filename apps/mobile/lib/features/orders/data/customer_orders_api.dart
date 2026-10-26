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

enum CustomerOrdersStatus {
  success,
  unauthorized,
  forbidden,
  unavailable,
  notConfigured,
}

class CustomerOrder {
  const CustomerOrder({
    required this.id,
    required this.businessNumber,
    required this.date,
    required this.fulfillment,
    required this.total,
    required this.status,
  });

  final String id;
  final String businessNumber;
  final DateTime date;
  final String fulfillment;
  final String total;
  final String status;

  static CustomerOrder? parse(Object? value) {
    if (value is! Map<String, dynamic> ||
        value.length != 6 ||
        value['id'] is! String ||
        !_uuidPattern.hasMatch(value['id'] as String) ||
        value['identificadorNegocio'] is! String ||
        (value['identificadorNegocio'] as String).isEmpty ||
        value['data'] is! String ||
        DateTime.tryParse(value['data'] as String) == null ||
        (value['modalidade'] != 'ENTREGA' &&
            value['modalidade'] != 'RETIRADA') ||
        value['total'] is! String ||
        !RegExp(r'^\d+\.\d{2}$').hasMatch(value['total'] as String) ||
        value['statusAtual'] is! String ||
        !_statuses.contains(value['statusAtual'])) {
      return null;
    }
    return CustomerOrder(
      id: value['id'] as String,
      businessNumber: value['identificadorNegocio'] as String,
      date: DateTime.parse(value['data'] as String),
      fulfillment: value['modalidade'] as String,
      total: value['total'] as String,
      status: value['statusAtual'] as String,
    );
  }
}

class CustomerOrdersResult {
  const CustomerOrdersResult(this.status, {this.orders});

  final CustomerOrdersStatus status;
  final List<CustomerOrder>? orders;
}

class CustomerOrdersApi {
  CustomerOrdersApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<CustomerOrdersResult> fetchOrders({
    required String accessToken,
  }) async {
    final uri = _config.ordersUri;
    if (uri == null) {
      return const CustomerOrdersResult(CustomerOrdersStatus.notConfigured);
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
        return const CustomerOrdersResult(CustomerOrdersStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const CustomerOrdersResult(CustomerOrdersStatus.forbidden);
      }
      if (response.statusCode != HttpStatus.ok) {
        return const CustomerOrdersResult(CustomerOrdersStatus.unavailable);
      }
      final body = jsonDecode(
        await utf8.decoder.bind(response.timeout(timeout)).join(),
      );
      if (body is! List) {
        return const CustomerOrdersResult(CustomerOrdersStatus.unavailable);
      }
      final orders = <CustomerOrder>[];
      for (final item in body) {
        final order = CustomerOrder.parse(item);
        if (order == null) {
          return const CustomerOrdersResult(CustomerOrdersStatus.unavailable);
        }
        orders.add(order);
      }
      return CustomerOrdersResult(CustomerOrdersStatus.success, orders: orders);
    } on Object {
      return const CustomerOrdersResult(CustomerOrdersStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }
}
