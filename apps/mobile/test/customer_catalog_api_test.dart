import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/catalog/data/customer_catalog_api.dart';
import 'package:flutter_test/flutter_test.dart';

const _id = '9b72c770-bc74-4c77-82c7-205c2d91628a';

Future<HttpServer> _server(Future<void> Function(HttpRequest) handler) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen(handler);
  return server;
}

CustomerCatalogApi _api(HttpServer server) => CustomerCatalogApi(
  config: ApiConfig(baseUrl: 'http://${server.address.address}:${server.port}'),
  timeout: const Duration(seconds: 2),
);

String _token() => 'secret-session-value';

void main() {
  test(
    'categories and optional filter use Bearer and preserve the safe DTO',
    () async {
      final server = await _server((request) async {
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer ${_token()}',
        );
        request.response.statusCode = 200;
        request.response.headers.contentType = ContentType.json;
        if (request.uri.path == '/catalogo/categorias') {
          request.response.write(
            jsonEncode([
              {'id': '11111111-1111-4111-8111-111111111111', 'nome': 'Doces'},
            ]),
          );
        } else {
          expect(request.uri.queryParameters, {
            'page': '1',
            'limit': '20',
            'categoriaId': '11111111-1111-4111-8111-111111111111',
          });
          request.response.write(
            '{"items":[],"page":1,"limit":20,"hasMore":false}',
          );
        }
        await request.response.close();
      });
      addTearDown(server.close);
      final api = _api(server);
      final categories = await api.fetchCategories(accessToken: _token());
      expect(categories.status, CatalogRequestStatus.success);
      expect(categories.categories?.single.name, 'Doces');
      final page = await api.fetchPage(
        accessToken: _token(),
        page: 1,
        categoryId: categories.categories!.single.id,
      );
      expect(page.status, CatalogRequestStatus.success);
      expect(page.page?.items, isEmpty);
    },
  );

  test('envia Bearer e consulta página com o contrato validado', () async {
    final server = await _server((request) async {
      expect(request.method, 'GET');
      expect(request.uri.path, '/catalogo/produtos');
      expect(request.uri.queryParameters, {'page': '2', 'limit': '20'});
      expect(
        request.headers.value(HttpHeaders.authorizationHeader),
        'Bearer ${_token()}',
      );
      request.response
        ..statusCode = 200
        ..headers.contentType = ContentType.json
        ..write(
          jsonEncode({
            'items': [
              {
                'id': _id,
                'nome': 'Cupcake de chocolate',
                'precoAtual': '12.50',
                'categoria': {
                  'id': '11111111-1111-4111-8111-111111111111',
                  'nome': 'Doces',
                },
                'imagemDisponivel': false,
              },
            ],
            'page': 2,
            'limit': 20,
            'hasMore': false,
          }),
        );
      await request.response.close();
    });
    addTearDown(server.close);

    final result = await _api(server).fetchPage(accessToken: _token(), page: 2);
    expect(result.status, CatalogRequestStatus.success);
    expect(result.page?.items.single.price, '12.50');
    expect(result.page?.items.single.category.name, 'Doces');
    expect(result.page?.hasMore, isFalse);
  });

  test('distingue 401 e 403 e rejeita corpos inválidos', () async {
    var status = HttpStatus.unauthorized;
    final server = await _server((request) async {
      request.response.statusCode = status;
      if (status == HttpStatus.ok) {
        request.response
          ..headers.contentType = ContentType.json
          ..write('{"items":[],"page":0,"limit":20,"hasMore":false}');
      }
      await request.response.close();
    });
    addTearDown(server.close);
    final api = _api(server);

    expect(
      (await api.fetchPage(accessToken: _token(), page: 1)).status,
      CatalogRequestStatus.unauthorized,
    );
    status = HttpStatus.forbidden;
    expect(
      (await api.fetchPage(accessToken: _token(), page: 1)).status,
      CatalogRequestStatus.forbidden,
    );
    status = HttpStatus.ok;
    expect(
      (await api.fetchPage(accessToken: _token(), page: 1)).status,
      CatalogRequestStatus.unavailable,
    );
  });

  test(
    'imagem exige image/webp e retorna bytes sem transformar key em URL',
    () async {
      final server = await _server((request) async {
        expect(request.uri.path, '/catalogo/produtos/$_id/imagem');
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer ${_token()}',
        );
        request.response
          ..statusCode = 200
          ..headers.contentType = ContentType('image', 'webp')
          ..add([1, 2, 3]);
        await request.response.close();
      });
      addTearDown(server.close);
      final result = await _api(
        server,
      ).fetchImage(productId: _id, accessToken: _token());
      expect(result.status, CatalogRequestStatus.success);
      expect(result.bytes, [1, 2, 3]);
    },
  );
}
