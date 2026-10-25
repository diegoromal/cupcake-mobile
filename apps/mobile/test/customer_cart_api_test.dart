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
  Object? unitPrice = '10.00',
  Object? subtotal = '10.00',
  bool available = true,
  Object? reason,
}) => {
  'id': id ?? _itemId,
  'produtoId': _productId,
  'nome': 'Cupcake de festa',
  'imagemDisponivel': false,
  'quantidade': quantity,
  'personalizacoes': personalizations,
  'precoUnitario': unitPrice,
  'subtotal': subtotal,
  'disponivel': available,
  'motivo': reason,
};

Map<String, Object?> _body({
  Object? id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  List<Map<String, Object?>> items = const [],
  String subtotal = '0.00',
  String total = '0.00',
}) => {'id': id, 'itens': items, 'subtotal': subtotal, 'total': total};

void main() {
  test(
    'POST envia seleção autenticada e confirma somente item criado coerente',
    () async {
      var status = HttpStatus.created;
      Object body = {
        'id': _itemId,
        'carrinhoId': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'produtoId': _productId,
        'quantidade': 2,
        'personalizacaoIds': [_optionId],
      };
      var calls = 0;
      final server = await _server((request) async {
        calls++;
        expect(request.method, 'POST');
        expect(request.uri.path, '/carrinho/itens');
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer secret-session-value',
        );
        expect(request.headers.contentType?.mimeType, 'application/json');
        expect(jsonDecode(await utf8.decoder.bind(request).join()), {
          'produtoId': _productId,
          'quantidade': 2,
          'personalizacaoIds': [_optionId],
        });
        request.response
          ..statusCode = status
          ..headers.contentType = ContentType.json
          ..write(jsonEncode(body));
        await request.response.close();
      });
      addTearDown(server.close);
      Future<CartResult> add() => _api(server).addItem(
        accessToken: 'secret-session-value',
        productId: _productId,
        quantity: 2,
        personalizationIds: [_optionId],
      );
      expect((await add()).status, CartRequestStatus.success);
      body = {...body as Map<String, Object?>, 'produtoId': _secondItemId};
      expect((await add()).status, CartRequestStatus.unavailable);
      body = {'id': _itemId};
      expect((await add()).status, CartRequestStatus.unavailable);
      status = HttpStatus.ok;
      expect((await add()).status, CartRequestStatus.unavailable);
      expect(calls, 4);
    },
  );

  test('POST distingue 401, 403, 404, 409 e falha de rede', () async {
    var status = HttpStatus.unauthorized;
    final server = await _server((request) async {
      await request.drain<void>();
      request.response.statusCode = status;
      if (status == HttpStatus.conflict) {
        request.response.write(
          jsonEncode({'message': 'Quantidade superior à disponibilidade.'}),
        );
      }
      await request.response.close();
    });
    addTearDown(server.close);
    Future<CartResult> add(CustomerCartApi api) => api.addItem(
      accessToken: 'token',
      productId: _productId,
      quantity: 1,
      personalizationIds: const [],
    );
    final api = _api(server);
    expect((await add(api)).status, CartRequestStatus.unauthorized);
    status = HttpStatus.forbidden;
    expect((await add(api)).status, CartRequestStatus.forbidden);
    status = HttpStatus.notFound;
    expect((await add(api)).status, CartRequestStatus.notFound);
    status = HttpStatus.conflict;
    final conflict = await add(api);
    expect(conflict.status, CartRequestStatus.conflict);
    expect(conflict.message, 'Quantidade superior à disponibilidade.');
    expect(
      (await add(CustomerCartApi(config: ApiConfig(baseUrl: '')))).status,
      CartRequestStatus.notConfigured,
    );
    await server.close();
    expect((await add(api)).status, CartRequestStatus.unavailable);
  });
  test(
    'interpreta o contrato do GET com preço, subtotal, total e linha indisponível',
    () async {
      var body = jsonEncode(_body(id: null, subtotal: '0.00', total: '0.00'));
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
      expect(missing.cart?.subtotal, '0.00');
      expect(missing.cart?.total, '0.00');

      body = jsonEncode(_body());
      final empty = await api.fetchCart(accessToken: 'secret-session-value');
      expect(empty.cart?.id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
      expect(empty.cart?.items, isEmpty);
      expect(empty.cart?.total, '0.00');

      body = jsonEncode(
        _body(
          subtotal: '30.00',
          total: '30.00',
          items: [
            _item(
              personalizations: [
                {'id': _optionId, 'nome': 'Aroma'},
              ],
            ),
            _item(id: _secondItemId, quantity: 2, subtotal: '20.00'),
          ],
        ),
      );
      final loaded = await api.fetchCart(accessToken: 'secret-session-value');
      expect(loaded.status, CartRequestStatus.success);
      expect(loaded.cart?.subtotal, '30.00');
      expect(loaded.cart?.total, '30.00');
      expect(loaded.cart?.items, hasLength(2));
      expect(loaded.cart?.items.first.productId, _productId);
      expect(loaded.cart?.items.first.name, 'Cupcake de festa');
      expect(loaded.cart?.items.first.quantity, 1);
      expect(loaded.cart?.items.first.imageAvailable, isFalse);
      expect(loaded.cart?.items.first.personalizations.single.name, 'Aroma');
      expect(loaded.cart?.items.first.personalizations.single.id, _optionId);
      expect(loaded.cart?.items.first.unitPrice, '10.00');
      expect(loaded.cart?.items.first.subtotal, '10.00');
      expect(loaded.cart?.items.first.available, isTrue);
      expect(loaded.cart?.items.first.reason, isNull);
      expect(loaded.cart?.items.last.personalizations, isEmpty);
      expect(loaded.cart?.items.last.quantity, 2);
      expect(loaded.cart?.items.last.subtotal, '20.00');
      expect(loaded.cart?.items.first.id, isNot(loaded.cart?.items.last.id));

      body = jsonEncode(
        _body(
          items: [
            _item(
              unitPrice: null,
              subtotal: null,
              available: false,
              reason: 'Produto indisponível.',
            ),
          ],
        ),
      );
      final unavailable = await api.fetchCart(
        accessToken: 'secret-session-value',
      );
      expect(unavailable.status, CartRequestStatus.success);
      expect(unavailable.cart?.items.single.available, isFalse);
      expect(unavailable.cart?.items.single.unitPrice, isNull);
      expect(unavailable.cart?.items.single.subtotal, isNull);
      expect(unavailable.cart?.items.single.reason, 'Produto indisponível.');

      body = jsonEncode(
        _body(
          subtotal: '10.00',
          total: '10.00',
          items: [
            _item(
              available: false,
              reason: 'Quantidade superior à disponibilidade.',
            ),
          ],
        ),
      );
      final short = await api.fetchCart(accessToken: 'secret-session-value');
      expect(short.status, CartRequestStatus.success);
      expect(short.cart?.items.single.available, isFalse);
      expect(short.cart?.items.single.unitPrice, '10.00');
      expect(short.cart?.items.single.subtotal, '10.00');
      expect(
        short.cart?.items.single.reason,
        'Quantidade superior à disponibilidade.',
      );

      body = jsonEncode(
        _body(
          subtotal: '10.00',
          total: '10.00',
          items: [
            _item(
              available: true,
              unitPrice: null,
              subtotal: null,
              reason: null,
            ),
          ],
        ),
      );
      expect(
        (await api.fetchCart(accessToken: 'secret-session-value')).status,
        CartRequestStatus.unavailable,
      );

      body = jsonEncode(
        _body(
          subtotal: '10.00',
          total: '10.00',
          items: [
            {..._item(), 'precoAtual': '10.00'},
          ],
        ),
      );
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

  test('PATCH envia a quantidade absoluta e aceita o corpo do GET', () async {
    final seen = <String>[];
    var body = '';
    final server = await _server((request) async {
      seen.add('${request.method} ${request.uri.path}');
      body = await utf8.decoder.bind(request).join();
      expect(
        request.headers.value(HttpHeaders.authorizationHeader),
        'Bearer secret-session-value',
      );
      expect(
        request.headers.value(HttpHeaders.contentTypeHeader),
        contains('application/json'),
      );
      request.response
        ..statusCode = HttpStatus.ok
        ..headers.contentType = ContentType.json
        ..write(
          jsonEncode(
            _body(
              subtotal: '40.00',
              total: '40.00',
              items: [_item(quantity: 4, subtotal: '40.00')],
            ),
          ),
        );
      await request.response.close();
    });
    addTearDown(server.close);
    final api = _api(server);
    final updated = await api.updateQuantity(
      accessToken: 'secret-session-value',
      itemId: _itemId,
      quantity: 4,
    );
    expect(seen, ['PATCH /carrinho/itens/$_itemId']);
    expect(body, '{"quantidade":4}');
    expect(updated.status, CartRequestStatus.success);
    expect(updated.cart?.items.single.quantity, 4);
    expect(updated.cart?.total, '40.00');
    expect(updated.cart?.items.single.subtotal, '40.00');

    final priced = await _server((request) async {
      await request.drain<void>();
      request.response
        ..statusCode = HttpStatus.ok
        ..write(
          jsonEncode(
            _body(
              subtotal: '10.00',
              total: '10.00',
              items: [
                {..._item(), 'precoAtual': '10.00'},
              ],
            ),
          ),
        );
      await request.response.close();
    });
    addTearDown(priced.close);
    expect(
      (await _api(priced).updateQuantity(
        accessToken: 'secret-session-value',
        itemId: _itemId,
        quantity: 1,
      )).status,
      CartRequestStatus.unavailable,
    );
  });

  test('DELETE espera 204 e distingue 409, 404, 401, 403 e rede', () async {
    var status = HttpStatus.noContent;
    var payload = '';
    final methods = <String>[];
    final server = await _server((request) async {
      methods.add(request.method);
      expect(request.uri.path, '/carrinho/itens/$_itemId');
      await request.drain<void>();
      request.response.statusCode = status;
      if (payload.isNotEmpty) request.response.write(payload);
      await request.response.close();
    });
    addTearDown(server.close);
    final api = _api(server);
    final removed = await api.removeItem(
      accessToken: 'secret-session-value',
      itemId: _itemId,
    );
    expect(removed.status, CartRequestStatus.success);
    expect(removed.cart, isNull);
    expect(methods, ['DELETE']);

    status = HttpStatus.notFound;
    expect(
      (await api.removeItem(
        accessToken: 'secret-session-value',
        itemId: _itemId,
      )).status,
      CartRequestStatus.notFound,
    );
    status = HttpStatus.unauthorized;
    expect(
      (await api.updateQuantity(
        accessToken: 'secret-session-value',
        itemId: _itemId,
        quantity: 2,
      )).status,
      CartRequestStatus.unauthorized,
    );
    status = HttpStatus.forbidden;
    expect(
      (await api.updateQuantity(
        accessToken: 'secret-session-value',
        itemId: _itemId,
        quantity: 2,
      )).status,
      CartRequestStatus.forbidden,
    );
    expect(methods, ['DELETE', 'DELETE', 'PATCH', 'PATCH']);

    final conflict = await _server((request) async {
      expect(request.method, 'PATCH');
      await request.drain<void>();
      request.response
        ..statusCode = HttpStatus.conflict
        ..write(
          jsonEncode({'message': 'Quantidade superior à disponibilidade.'}),
        );
      await request.response.close();
    });
    addTearDown(conflict.close);
    final conflictResult = await _api(conflict).updateQuantity(
      accessToken: 'secret-session-value',
      itemId: _itemId,
      quantity: 9,
    );
    expect(conflictResult.status, CartRequestStatus.conflict);
    expect(conflictResult.message, 'Quantidade superior à disponibilidade.');

    final bare = await _server((request) async {
      await request.drain<void>();
      request.response.statusCode = HttpStatus.conflict;
      await request.response.close();
    });
    addTearDown(bare.close);
    expect(
      (await _api(bare).updateQuantity(
        accessToken: 'secret-session-value',
        itemId: _itemId,
        quantity: 9,
      )).message,
      'Quantidade superior à disponibilidade.',
    );

    final closed = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final offline = CustomerCartApi(
      config: ApiConfig(
        baseUrl: 'http://${closed.address.address}:${closed.port}',
      ),
      timeout: const Duration(milliseconds: 200),
    );
    await closed.close();
    expect(
      (await offline.updateQuantity(
        accessToken: 'secret-session-value',
        itemId: _itemId,
        quantity: 1,
      )).status,
      CartRequestStatus.unavailable,
    );
    expect(
      (await offline.removeItem(
        accessToken: 'secret-session-value',
        itemId: _itemId,
      )).status,
      CartRequestStatus.unavailable,
    );
    expect(
      (await api.updateQuantity(
        accessToken: 'secret-session-value',
        itemId: 'item-invalido',
        quantity: 1,
      )).status,
      CartRequestStatus.notConfigured,
    );
  });

  test('guarda subtotal e total recebidos sem recalcular', () async {
    final server = await _server((request) async {
      request.response
        ..statusCode = HttpStatus.ok
        ..headers.contentType = ContentType.json
        ..write(
          jsonEncode(
            _body(
              subtotal: '7.11',
              total: '8.22',
              items: [_item(quantity: 3, unitPrice: '10.00', subtotal: '7.11')],
            ),
          ),
        );
      await request.response.close();
    });
    addTearDown(server.close);
    final loaded = await _api(
      server,
    ).fetchCart(accessToken: 'secret-session-value');
    expect(loaded.status, CartRequestStatus.success);
    expect(loaded.cart?.items.single.quantity, 3);
    expect(loaded.cart?.items.single.unitPrice, '10.00');
    expect(loaded.cart?.items.single.subtotal, '7.11');
    expect(loaded.cart?.subtotal, '7.11');
    expect(loaded.cart?.total, '8.22');
  });

  test(
    'JSON inválido no PATCH e DELETE fora de 204 não inventam carrinho',
    () async {
      final invalid = await _server((request) async {
        await request.drain<void>();
        request.response
          ..statusCode = HttpStatus.ok
          ..write('nao-json');
        await request.response.close();
      });
      addTearDown(invalid.close);
      final patched = await _api(invalid).updateQuantity(
        accessToken: 'secret-session-value',
        itemId: _itemId,
        quantity: 4,
      );
      expect(patched.status, CartRequestStatus.unavailable);
      expect(patched.cart, isNull);

      final deleted = await _server((request) async {
        await request.drain<void>();
        request.response
          ..statusCode = HttpStatus.ok
          ..write('{"total":"99.00"}');
        await request.response.close();
      });
      addTearDown(deleted.close);
      final removed = await _api(
        deleted,
      ).removeItem(accessToken: 'secret-session-value', itemId: _itemId);
      expect(removed.status, CartRequestStatus.unavailable);
      expect(removed.cart, isNull);
    },
  );
}
