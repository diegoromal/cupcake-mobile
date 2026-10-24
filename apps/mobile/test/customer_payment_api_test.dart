import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/checkout/data/customer_payment_api.dart';
import 'package:flutter_test/flutter_test.dart';

const orderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const attemptId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

void main() {
  late HttpServer server;
  late CustomerPaymentApi api;
  final requests = <HttpRequest>[];
  final requestBodies = <String?>[];
  String responseResult = 'APROVADO';
  String responseAttemptId = attemptId;
  int? responseStatus;
  String? responseText;
  Duration responseDelay = Duration.zero;
  late String baseUrl;

  setUp(() async {
    requests.clear();
    requestBodies.clear();
    responseResult = 'APROVADO';
    responseAttemptId = attemptId;
    responseStatus = null;
    responseText = null;
    responseDelay = Duration.zero;
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    unawaited(() async {
      await for (final request in server) {
        requests.add(request);
        final body = request.method == 'POST'
            ? await utf8.decoder.bind(request).join()
            : null;
        requestBodies.add(body);
        if (responseDelay > Duration.zero) {
          await Future<void>.delayed(responseDelay);
        }
        try {
          request.response.statusCode =
              responseStatus ?? (request.method == 'POST' ? 201 : 200);
          request.response.headers.contentType = ContentType.json;
          request.response.write(
            responseText ??
                jsonEncode({
                  'tentativaId': responseAttemptId,
                  'pedidoId': orderId,
                  'forma':
                      request.uri.path.endsWith('/pix') ||
                          request.uri.path.endsWith('/pix/$attemptId')
                      ? 'PIX'
                      : 'CARTAO',
                  'resultado': responseResult,
                  'valorAplicavel': '20.00',
                  'dataTransacao': '2026-10-23T12:00:00.000Z',
                }),
          );
          await request.response.close();
        } on IOException {
          // The client may close its socket after a timeout.
        }
      }
    }());
    baseUrl = 'http://127.0.0.1:${server.port}';
    api = CustomerPaymentApi(
      config: ApiConfig(baseUrl: baseUrl),
      timeout: const Duration(seconds: 2),
    );
  });

  tearDown(() async => server.close(force: true));

  test('inicia tentativa com pedido, método e token do cliente', () async {
    final result = await api.start('access-token', orderId, 'pix', attemptId);
    expect(result.status, PaymentStatus.success);
    expect(result.value?['resultado'], 'APROVADO');
    expect(requests.single.method, 'POST');
    expect(requests.single.uri.path, '/pedidos/$orderId/pagamentos/pix');
    expect(
      requests.single.headers.value(HttpHeaders.authorizationHeader),
      'Bearer access-token',
    );
    expect(jsonDecode(requestBodies.single!), {'tentativaId': attemptId});
  });

  test('consulta a mesma tentativa sem iniciar outra cobrança', () async {
    responseResult = 'PENDENTE';
    final result = await api.verify(
      'access-token',
      orderId,
      'cartao',
      attemptId,
    );
    expect(result.status, PaymentStatus.success);
    expect(result.value?['resultado'], 'PENDENTE');
    expect(requests.single.method, 'GET');
    expect(
      requests.single.uri.path,
      '/pedidos/$orderId/pagamentos/cartao/$attemptId',
    );
    expect(requestBodies.single, isNull);
  });

  test('mapeia respostas HTTP de autenticação e elegibilidade', () async {
    for (final (httpStatus, paymentStatus) in [
      (401, PaymentStatus.unauthorized),
      (403, PaymentStatus.forbidden),
      (404, PaymentStatus.notFound),
      (409, PaymentStatus.conflict),
      (503, PaymentStatus.unavailable),
    ]) {
      responseStatus = httpStatus;
      final result = await api.start('access-token', orderId, 'pix', attemptId);
      expect(result.status, paymentStatus, reason: 'HTTP $httpStatus');
    }
  });

  test('resposta malformada ou incompatível não vira sucesso', () async {
    responseText = '{';
    var result = await api.start('access-token', orderId, 'pix', attemptId);
    expect(result.status, PaymentStatus.invalidResponse);

    responseText = jsonEncode({'tentativaId': attemptId});
    result = await api.start('access-token', orderId, 'pix', attemptId);
    expect(result.status, PaymentStatus.invalidResponse);
  });

  test(
    'consulta rejeita resposta de outra tentativa do mesmo pedido',
    () async {
      responseAttemptId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      final result = await api.verify(
        'access-token',
        orderId,
        'pix',
        attemptId,
      );
      expect(result.status, PaymentStatus.invalidResponse);
      expect(requests.single.uri.path, endsWith('/pix/$attemptId'));
    },
  );

  test('timeout é indeterminado e não é convertido em sucesso', () async {
    responseDelay = const Duration(milliseconds: 120);
    final shortTimeoutApi = CustomerPaymentApi(
      config: ApiConfig(baseUrl: baseUrl),
      timeout: const Duration(milliseconds: 20),
    );
    final result = await shortTimeoutApi.start(
      'access-token',
      orderId,
      'pix',
      attemptId,
    );
    expect(result.status, PaymentStatus.timeout);
    await Future<void>.delayed(const Duration(milliseconds: 130));
  });

  test(
    'rejeita método e identificador fora do contrato antes de enviar',
    () async {
      final result = await api.start(
        'access-token',
        'invalid',
        'boleto',
        attemptId,
      );
      expect(result.status, PaymentStatus.unavailable);
      expect(requests, isEmpty);
    },
  );
}
