import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/cart/data/customer_cart_api.dart';
import 'package:flutter_test/flutter_test.dart';

const _itemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const _secondItemId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const _productId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const _optionId = '11111111-1111-4111-8111-111111111111';

Future<HttpServer> _server(Future<void> Function(HttpRequest) handler) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen(handler);
  return server;
}

CustomerCartApi _api(HttpServer server) => CustomerCartApi(
  config: ApiConfig(baseUrl: 'http://${server.address.address}:${server.port}'),
  timeout: const Duration(seconds: 2),
);

Map<String, Object?> _item({
  String? id,
  List<Map<String, String>> personalizations = const [],
  int quantity = 1,
}) => {
  'id': id ?? _itemId,
  'produtoId': _productId,
  'nome': 'Cupcake de festa',
  'imagemDisponivel': false,
  'quantidade': quantity,
  'personalizacoes': personalizations,
};

void main() {
  test(
    'interpreta carrinho vazio, itens e personalizações sem preço',
    () async {
      var body = jsonEncode({'id': null, 'itens': <Object>[]});
      final server = await _server((request) async {
        expect(request.method, 'GET');
        expect(request.uri.path, '/carrinho');
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer secret-session-value',
        );
        request.response
          ..statusCode = HttpStatus.ok
          ..headers.contentType = ContentType.json
          ..write(body);
        await request.response.close();
      });
      addTearDown(server.close);
      final api = _api(server);

      final missing = await api.fetchCart(accessToken: 'secret-session-value');
      expect(missing.status, CartRequestStatus.success);
      expect(missing.cart?.id, isNull);
      expect(missing.cart?.items, isEmpty);

      body = jsonEncode({
        'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'itens': <Object>[],
      });
      final empty = await api.fetchCart(accessToken: 'secret-session-value');
      expect(empty.cart?.id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      expect(empty.cart?.items, isEmpty);

      body = jsonEncode({
        'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'itens': [
          _item(
            personalizations: [
              {'id': _optionId, 'nome': 'Aroma'},
            ],
          ),
          _item(id: _secondItemId, quantity: 2),
        ],
      });
      final loaded = await api.fetchCart(accessToken: 'secret-session-value');
      expect(loaded.status, CartRequestStatus.success);
      expect(loaded.cart?.items, hasLength(2));
      expect(loaded.cart?.items.first.productId, _productId);
      expect(loaded.cart?.items.first.name, 'Cupcake de festa');
      expect(loaded.cart?.items.first.quantity, 1);
      expect(loaded.cart?.items.first.imageAvailable, isFalse);
      expect(loaded.cart?.items.first.personalizations.single.name, 'Aroma');
      expect(loaded.cart?.items.first.personalizations.single.id, _optionId);
      expect(loaded.cart?.items.last.personalizations, isEmpty);
      expect(loaded.cart?.items.last.quantity, 2);
      expect(loaded.cart?.items.first.id, isNot(loaded.cart?.items.last.id));

      body = jsonEncode({
        'id': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'itens': [
          {..._item(), 'precoAtual': '10.00'},
        ],
      });
      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.unavailable,
      );
    },
  );

  test(
    'rejeita corpo inválido e distingue 401, 403 e indisponibilidade',
    () async {
      var status = HttpStatus.ok;
      var body = '{"id":null}';
      final server = await _server((request) async {
        request.response.statusCode = status;
        if (status == HttpStatus.ok) request.response.write(body);
        await request.response.close();
      });
      addTearDown(server.close);
      final api = _api(server);

      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.unavailable,
      );
      body = 'nao-json';
      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.unavailable,
      );
      status = HttpStatus.unauthorized;
      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.unauthorized,
      );
      status = HttpStatus.forbidden;
      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.forbidden,
      );
      status = HttpStatus.serviceUnavailable;
      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.unavailable,
      );
    },
  );

  test('API não configurada e conexão recusada não viram sucesso', () async {
    expect(
      (await CustomerCartApi(
        config: ApiConfig(baseUrl: ''),
      ).fetchCart(accessToken: 'secret-session-value')).status,
      CartRequestStatus.notConfigured,
    );
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final api = CustomerCartApi(
      config: ApiConfig(
        baseUrl: 'http://${server.address.address}:${server.port}',
      ),
      timeout: const Duration(milliseconds: 200),
    );
    await server.close();
    expect(
      (await api.fetchCart(accessToken: 'secret-session-value')).status,
      CartRequestStatus.unavailable,
    );
  });
}
