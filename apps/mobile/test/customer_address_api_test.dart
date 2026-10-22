import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/address/data/customer_address_api.dart';
import 'package:flutter_test/flutter_test.dart';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
Map<String, Object?> address({Object? latitude, Object? longitude}) => {
  'id': id,
  'rua': 'Rua A',
  'numero': '12',
  'bairro': 'Centro',
  'cidade': 'Curitiba',
  'cep': '80000000',
  'complemento': null,
  'referencia': null,
  'latitude': latitude,
  'longitude': longitude,
};

Future<HttpServer> server(Future<void> Function(HttpRequest) handle) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen(handle);
  return server;
}

void main() {
  test(
    'consulta, cria, lista e geocodifica com token sem expor coordenadas no modelo visual',
    () async {
      final seen = <String>[];
      final local = await server((request) async {
        seen.add('${request.method} ${request.uri.path}');
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer token',
        );
        request.response.headers.contentType = ContentType.json;
        switch ('${request.method} ${request.uri.path}') {
          case 'GET /enderecos/cep/80000000':
            request.response.write(
              jsonEncode({
                'rua': 'Rua A',
                'bairro': 'Centro',
                'cidade': 'Curitiba',
                'uf': 'PR',
              }),
            );
          case 'GET /enderecos':
            request.response.write(jsonEncode([address()]));
          case 'POST /enderecos':
            expect(
              jsonDecode(await utf8.decoder.bind(request).join()),
              containsPair('cep', '80000-000'),
            );
            request.response.statusCode = 201;
            request.response.write(jsonEncode(address()));
          case 'POST /enderecos/$id/geocodificacao':
            request.response.write(
              jsonEncode({'latitude': '-25.000000', 'longitude': '-49.000000'}),
            );
        }
        await request.response.close();
      });
      addTearDown(local.close);
      final api = CustomerAddressApi(
        config: ApiConfig(
          baseUrl: 'http://${local.address.address}:${local.port}',
        ),
      );
      expect((await api.lookupCep('token', '80000000')).value?.uf, 'PR');
      expect((await api.list('token')).value?.single.located, false);
      expect(
        (await api.create('token', {'cep': '80000-000'})).status,
        AddressStatus.success,
      );
      expect((await api.geocode('token', id)).status, AddressStatus.success);
      expect(seen, [
        'GET /enderecos/cep/80000000',
        'GET /enderecos',
        'POST /enderecos',
        'POST /enderecos/$id/geocodificacao',
      ]);
    },
  );

  test(
    'não confirma POST com corpo inválido e distingue 401, 403, 404 e falha de rede',
    () async {
      var status = 201;
      final local = await server((request) async {
        request.response.statusCode = status;
        request.response.headers.contentType = ContentType.json;
        request.response.write(status == 201 ? '{}' : '{"message":"erro"}');
        await request.response.close();
      });
      final api = CustomerAddressApi(
        config: ApiConfig(
          baseUrl: 'http://${local.address.address}:${local.port}',
        ),
      );
      expect((await api.create('x', {})).status, AddressStatus.indeterminate);
      status = 401;
      expect((await api.list('x')).status, AddressStatus.unauthorized);
      status = 403;
      expect((await api.list('x')).status, AddressStatus.forbidden);
      status = 404;
      expect(
        (await api.lookupCep('x', '80000000')).status,
        AddressStatus.notFound,
      );
      await local.close();
      expect((await api.list('x')).status, AddressStatus.unavailable);
    },
  );
}
