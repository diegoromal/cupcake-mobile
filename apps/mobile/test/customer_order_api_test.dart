import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/checkout/data/customer_order_api.dart';
import 'package:flutter_test/flutter_test.dart';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

Future<OrderResult> respond(
  int code,
  String body, {
  bool confirm = false,
}) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen((request) async {
    expect(request.method, 'POST');
    expect(request.uri.path, confirm ? '/pedidos' : '/pedidos/revisao');
    final sent =
        jsonDecode(await utf8.decoder.bind(request).join())
            as Map<String, dynamic>;
    expect(sent['modalidade'], 'RETIRADA');
    request.response.statusCode = code;
    request.response.write(body);
    await request.response.close();
  });
  try {
    final api = CustomerOrderApi(
      config: ApiConfig(baseUrl: 'http://127.0.0.1:${server.port}'),
    );
    return confirm
        ? await api.confirm('token', 'RETIRADA', null, id, 'a' * 64)
        : await api.review('token', 'RETIRADA', null);
  } finally {
    await server.close(force: true);
  }
}

void main() {
  test('interpreta revisão válida e rejeita JSON inválido', () async {
    final valid = jsonEncode({
      'revisaoId': 'a' * 64,
      'modalidade': 'RETIRADA',
      'enderecoEntregaSnapshot': null,
      'valorItens': '20.00',
      'freteAplicado': '0.00',
      'total': '20.00',
      'itens': [
        {
          'produtoId': id,
          'nome': 'Cupcake',
          'quantidade': 2,
          'precoAplicado': '10.00',
          'subtotalAplicado': '20.00',
          'personalizacoes': [],
        },
      ],
    });
    expect((await respond(201, valid)).status, OrderStatus.success);
    expect((await respond(201, '{')).status, OrderStatus.invalidResponse);
    expect((await respond(201, '{}')).status, OrderStatus.invalidResponse);
    expect(
      (await respond(201, jsonEncode({'id': id}))).status,
      OrderStatus.invalidResponse,
    );
  });

  test('interpreta confirmação e estados HTTP esperados', () async {
    final valid = jsonEncode({
      'id': id,
      'identificadorNegocio': 'PED-$id',
      'total': '20.00',
    });
    expect(
      (await respond(201, valid, confirm: true)).status,
      OrderStatus.success,
    );
    expect(
      (await respond(201, '{}', confirm: true)).status,
      OrderStatus.invalidResponse,
    );
    for (final pair in <(int, OrderStatus)>[
      (401, OrderStatus.unauthorized),
      (403, OrderStatus.forbidden),
      (404, OrderStatus.notFound),
      (409, OrderStatus.conflict),
      (503, OrderStatus.unavailable),
    ]) {
      expect((await respond(pair.$1, '{}')).status, pair.$2);
    }
  });
}
