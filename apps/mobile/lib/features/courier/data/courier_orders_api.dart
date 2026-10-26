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
  notFound,
  unavailable,
  notConfigured,
}

class CourierDeliveryAddress {
  const CourierDeliveryAddress({
    required this.street,
    required this.number,
    required this.neighborhood,
    required this.city,
    required this.postalCode,
    required this.complement,
    required this.reference,
  });

  final String street;
  final String number;
  final String neighborhood;
  final String city;
  final String postalCode;
  final String? complement;
  final String? reference;

  static CourierDeliveryAddress? parse(Object? value) {
    if (value is! Map<String, dynamic> ||
        value.length != 7 ||
        !value.containsKey('complemento') ||
        !value.containsKey('referencia') ||
        value['rua'] is! String ||
        value['numero'] is! String ||
        value['bairro'] is! String ||
        value['cidade'] is! String ||
        value['cep'] is! String ||
        (value['complemento'] != null && value['complemento'] is! String) ||
        (value['referencia'] != null && value['referencia'] is! String)) {
      return null;
    }
    return CourierDeliveryAddress(
      street: value['rua'] as String,
      number: value['numero'] as String,
      neighborhood: value['bairro'] as String,
      city: value['cidade'] as String,
      postalCode: value['cep'] as String,
      complement: value['complemento'] as String?,
      reference: value['referencia'] as String?,
    );
  }
}

class CourierOrderDetail {
  const CourierOrderDetail({
    required this.businessNumber,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    required this.departureAt,
  });

  final String businessNumber;
  final String customerName;
  final String customerPhone;
  final CourierDeliveryAddress address;
  final DateTime? departureAt;

  static CourierOrderDetail? parse(Object? value) {
    if (value is! Map<String, dynamic> ||
        value.length != 4 ||
        !value.containsKey('dataHoraSaidaParaEntrega')) {
      return null;
    }
    final customer = value['cliente'];
    if (customer is! Map<String, dynamic> ||
        customer.length != 2 ||
        customer['nome'] is! String ||
        customer['telefone'] is! String ||
        value['identificadorNegocio'] is! String ||
        (value['identificadorNegocio'] as String).isEmpty) {
      return null;
    }
    final address = CourierDeliveryAddress.parse(
      value['enderecoEntregaSnapshot'],
    );
    final departureValue = value['dataHoraSaidaParaEntrega'];
    if (address == null ||
        (departureValue != null &&
            (departureValue is! String ||
                DateTime.tryParse(departureValue) == null))) {
      return null;
    }
    return CourierOrderDetail(
      businessNumber: value['identificadorNegocio'] as String,
      customerName: customer['nome'] as String,
      customerPhone: customer['telefone'] as String,
      address: address,
      departureAt: departureValue == null
          ? null
          : DateTime.parse(departureValue as String),
    );
  }
}

class CourierOrderDetailResult {
  const CourierOrderDetailResult(this.status, {this.detail});

  final CourierOrdersStatus status;
  final CourierOrderDetail? detail;
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

  Future<CourierOrderDetailResult> fetchDetail({
    required String orderId,
    required String accessToken,
  }) async {
    final uri = _config.courierOrderDetailUri(orderId);
    if (uri == null) {
      return const CourierOrderDetailResult(CourierOrdersStatus.notConfigured);
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
        return const CourierOrderDetailResult(CourierOrdersStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const CourierOrderDetailResult(CourierOrdersStatus.forbidden);
      }
      if (response.statusCode == HttpStatus.notFound) {
        return const CourierOrderDetailResult(CourierOrdersStatus.notFound);
      }
      if (response.statusCode != HttpStatus.ok) {
        return const CourierOrderDetailResult(CourierOrdersStatus.unavailable);
      }
      final detail = CourierOrderDetail.parse(
        jsonDecode(await utf8.decoder.bind(response.timeout(timeout)).join()),
      );
      return detail == null
          ? const CourierOrderDetailResult(CourierOrdersStatus.unavailable)
          : CourierOrderDetailResult(
              CourierOrdersStatus.success,
              detail: detail,
            );
    } on Object {
      return const CourierOrderDetailResult(CourierOrdersStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }
}
