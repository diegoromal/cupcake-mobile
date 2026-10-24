import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

enum PaymentStatus {
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

class PaymentResult {
  const PaymentResult(this.status, {this.value});

  final PaymentStatus status;
  final Map<String, dynamic>? value;
}

class CustomerPaymentApi {
  CustomerPaymentApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<PaymentResult> start(
    String token,
    String orderId,
    String method,
    String attemptId,
  ) => _send(
    _config.paymentUri(orderId, method),
    token,
    orderId,
    method,
    attemptId,
    initiate: true,
  );

  Future<PaymentResult> verify(
    String token,
    String orderId,
    String method,
    String attemptId,
  ) => _send(
    _config.paymentAttemptUri(orderId, method, attemptId),
    token,
    orderId,
    method,
    attemptId,
    initiate: false,
  );

  Future<PaymentResult> _send(
    Uri? uri,
    String token,
    String orderId,
    String method,
    String attemptId, {
    required bool initiate,
  }) async {
    if (uri == null) return const PaymentResult(PaymentStatus.unavailable);
    final client = _clientFactory();
    try {
      final request =
          await (initiate ? client.postUrl(uri) : client.getUrl(uri)).timeout(
            timeout,
          );
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      if (initiate) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode({'tentativaId': attemptId}));
      }
      final response = await request.close().timeout(timeout);
      switch (response.statusCode) {
        case 401:
          return const PaymentResult(PaymentStatus.unauthorized);
        case 403:
          return const PaymentResult(PaymentStatus.forbidden);
        case 404:
          return const PaymentResult(PaymentStatus.notFound);
        case 409:
          return const PaymentResult(PaymentStatus.conflict);
        case 503:
          return const PaymentResult(PaymentStatus.unavailable);
        case 200:
        case 201:
          break;
        default:
          return const PaymentResult(PaymentStatus.unavailable);
      }
      final decoded = jsonDecode(
        await utf8.decoder.bind(response.timeout(timeout)).join(),
      );
      if (decoded is! Map<String, dynamic> ||
          !_validPayment(decoded, orderId, method, attemptId)) {
        return const PaymentResult(PaymentStatus.invalidResponse);
      }
      return PaymentResult(PaymentStatus.success, value: decoded);
    } on TimeoutException {
      return const PaymentResult(PaymentStatus.timeout);
    } on FormatException {
      return const PaymentResult(PaymentStatus.invalidResponse);
    } on SocketException {
      return const PaymentResult(PaymentStatus.networkError);
    } on Object {
      return const PaymentResult(PaymentStatus.networkError);
    } finally {
      client.close(force: true);
    }
  }
}

bool _validPayment(
  Map<String, dynamic> data,
  String orderId,
  String method,
  String attemptId,
) =>
    data['tentativaId'] is String &&
    RegExp(
      r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      caseSensitive: false,
    ).hasMatch(data['tentativaId'] as String) &&
    data['tentativaId'] == attemptId &&
    data['pedidoId'] == orderId &&
    data['forma'] == (method == 'pix' ? 'PIX' : 'CARTAO') &&
    const {'PENDENTE', 'APROVADO', 'RECUSADO'}.contains(data['resultado']) &&
    data['valorAplicavel'] is String &&
    RegExp(r'^\d+\.\d{2}$').hasMatch(data['valorAplicavel'] as String) &&
    (data['dataTransacao'] == null || data['dataTransacao'] is String);
