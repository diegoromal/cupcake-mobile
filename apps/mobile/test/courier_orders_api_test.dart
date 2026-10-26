import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/courier/data/courier_orders_api.dart';
import 'package:flutter_test/flutter_test.dart';

const _id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

void main() {
  test('GET envia Bearer e valida somente o resumo da lista', () async {
    var body = jsonEncode([
      {
        'id': _id,
        'identificadorNegocio': 'PED-42',
        'statusAtual': 'SAIU_PARA_ENTREGA',
      },
    ]);
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);
    server.listen((request) async {
      expect(request.method, 'GET');
      expect(request.uri.path, '/entregador/pedidos');
      expect(request.uri.query, isEmpty);
      expect(
        request.headers.value(HttpHeaders.authorizationHeader),
        'Bearer access-token',
      );
      request.response
        ..statusCode = HttpStatus.ok
        ..headers.contentType = ContentType.json
        ..write(body);
      await request.response.close();
    });
    final api = CourierOrdersApi(
      config: ApiConfig(
        baseUrl: 'http://${server.address.address}:${server.port}',
      ),
    );
    Future<CourierOrdersResult> call() =>
        api.fetchOrders(accessToken: 'access-token');
    final result = await call();
    expect(result.status, CourierOrdersStatus.success);
    expect(result.orders?.single.id, _id);
    expect(result.orders?.single.businessNumber, 'PED-42');
    expect(result.orders?.single.status, 'SAIU_PARA_ENTREGA');
    body = '[]';
    expect((await call()).orders, isEmpty);
    body = jsonEncode([
      {
        'id': _id,
        'identificadorNegocio': 'PED-42',
        'statusAtual': 'ENTREGUE',
        'telefone': 'não expor',
      },
    ]);
    expect((await call()).status, CourierOrdersStatus.unavailable);
    body = jsonEncode([
      {
        'id': _id,
        'identificadorNegocio': 'PED-42',
        'statusAtual': 'ESTADO_DESCONHECIDO',
      },
    ]);
    expect((await call()).status, CourierOrdersStatus.unavailable);
  });

  test(
    'distingue 401, 403, HTTP inválido, JSON inválido e configuração',
    () async {
      var status = HttpStatus.unauthorized;
      var body = '';
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(server.close);
      server.listen((request) async {
        request.response.statusCode = status;
        request.response.write(body);
        await request.response.close();
      });
      final api = CourierOrdersApi(
        config: ApiConfig(
          baseUrl: 'http://${server.address.address}:${server.port}',
        ),
      );
      Future<CourierOrdersStatus> call() async =>
          (await api.fetchOrders(accessToken: 'token')).status;
      expect(await call(), CourierOrdersStatus.unauthorized);
      status = HttpStatus.forbidden;
      expect(await call(), CourierOrdersStatus.forbidden);
      status = HttpStatus.serviceUnavailable;
      expect(await call(), CourierOrdersStatus.unavailable);
      status = HttpStatus.ok;
      body = 'invalid-json';
      expect(await call(), CourierOrdersStatus.unavailable);
      expect(
        (await CourierOrdersApi(
          config: ApiConfig(baseUrl: ''),
        ).fetchOrders(accessToken: 'token')).status,
        CourierOrdersStatus.notConfigured,
      );
    },
  );
}
