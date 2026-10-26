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

  test(
    'detalhe GET usa id na rota, Bearer e aceita opcionais ausentes',
    () async {
      var body = jsonEncode({
        'identificadorNegocio': 'PED-42',
        'cliente': {'nome': 'Cliente', 'telefone': '11999999999'},
        'enderecoEntregaSnapshot': {
          'rua': 'Rua A',
          'numero': '10',
          'bairro': 'Centro',
          'cidade': 'São Paulo',
          'cep': '01001000',
          'complemento': null,
          'referencia': 'Portaria',
        },
        'dataHoraSaidaParaEntrega': '2026-10-25T12:34:00.000Z',
      });
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(server.close);
      server.listen((request) async {
        expect(request.method, 'GET');
        expect(request.uri.path, '/entregador/pedidos/$_id');
        expect(request.uri.query, isEmpty);
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer token',
        );
        request.response
          ..headers.contentType = ContentType.json
          ..write(body);
        await request.response.close();
      });
      final api = CourierOrdersApi(
        config: ApiConfig(
          baseUrl: 'http://${server.address.address}:${server.port}',
        ),
      );
      Future<CourierOrderDetailResult> call() =>
          api.fetchDetail(orderId: _id, accessToken: 'token');
      final result = await call();
      expect(result.status, CourierOrdersStatus.success);
      expect(result.detail?.businessNumber, 'PED-42');
      expect(result.detail?.customerPhone, '11999999999');
      expect(result.detail?.address.street, 'Rua A');
      expect(result.detail?.address.complement, isNull);
      expect(result.detail?.address.reference, 'Portaria');
      expect(result.detail?.departureAt, DateTime.utc(2026, 10, 25, 12, 34));

      body = jsonEncode({
        'identificadorNegocio': 'PED-42',
        'cliente': {
          'nome': 'Cliente',
          'telefone': '11999999999',
          'email': 'leak',
        },
        'enderecoEntregaSnapshot': {
          'rua': 'Rua A',
          'numero': '10',
          'bairro': 'Centro',
          'cidade': 'São Paulo',
          'cep': '01001000',
          'complemento': null,
          'referencia': null,
        },
        'dataHoraSaidaParaEntrega': null,
      });
      expect((await call()).status, CourierOrdersStatus.unavailable);
      body = jsonEncode({
        'identificadorNegocio': 'PED-42',
        'cliente': {'nome': 'Cliente', 'telefone': '11999999999'},
        'enderecoEntregaSnapshot': {
          'rua': 'Rua A',
          'numero': '10',
          'bairro': 'Centro',
          'cidade': 'São Paulo',
          'cep': '01001000',
          'referencia': null,
          'coordenadas': 'não expor',
        },
        'dataHoraSaidaParaEntrega': null,
      });
      expect((await call()).status, CourierOrdersStatus.unavailable);
    },
  );

  test('detalhe distingue 401, 403, 404, falha e UUID inválido', () async {
    var status = HttpStatus.unauthorized;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);
    server.listen((request) async {
      request.response.statusCode = status;
      await request.response.close();
    });
    final api = CourierOrdersApi(
      config: ApiConfig(
        baseUrl: 'http://${server.address.address}:${server.port}',
      ),
    );
    Future<CourierOrdersStatus> call() async =>
        (await api.fetchDetail(orderId: _id, accessToken: 'token')).status;
    expect(await call(), CourierOrdersStatus.unauthorized);
    status = HttpStatus.forbidden;
    expect(await call(), CourierOrdersStatus.forbidden);
    status = HttpStatus.notFound;
    expect(await call(), CourierOrdersStatus.notFound);
    status = HttpStatus.serviceUnavailable;
    expect(await call(), CourierOrdersStatus.unavailable);
    expect(
      (await api.fetchDetail(orderId: 'invalid', accessToken: 'token')).status,
      CourierOrdersStatus.notConfigured,
    );
  });

  test(
    'PATCH confirmação envia só rota e Bearer e valida resposta do banco',
    () async {
      var body = jsonEncode({
        'statusAtual': 'ENTREGUE',
        'dataHora': '2026-10-25T12:34:00.000Z',
      });
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      addTearDown(server.close);
      server.listen((request) async {
        expect(request.method, 'PATCH');
        expect(request.uri.path, '/entregador/pedidos/$_id/confirmar-entrega');
        expect(request.uri.query, isEmpty);
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer token',
        );
        expect(await utf8.decoder.bind(request).join(), isEmpty);
        request.response
          ..headers.contentType = ContentType.json
          ..write(body);
        await request.response.close();
      });
      final api = CourierOrdersApi(
        config: ApiConfig(
          baseUrl: 'http://${server.address.address}:${server.port}',
        ),
      );
      Future<CourierDeliveryConfirmationResult> call() =>
          api.confirmDelivery(orderId: _id, accessToken: 'token');
      final result = await call();
      expect(result.status, CourierOrdersStatus.success);
      expect(result.deliveredAt, DateTime.utc(2026, 10, 25, 12, 34));
      body = jsonEncode({'statusAtual': 'ENTREGUE', 'dataHora': 'invalid'});
      expect((await call()).status, CourierOrdersStatus.unavailable);
      body = jsonEncode({
        'statusAtual': 'SAIU_PARA_ENTREGA',
        'dataHora': '2026-10-25T12:34:00.000Z',
      });
      expect((await call()).status, CourierOrdersStatus.unavailable);
    },
  );

  test('PATCH distingue 401, 403, 404, 409 e falha transitória', () async {
    var status = HttpStatus.unauthorized;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(server.close);
    server.listen((request) async {
      request.response.statusCode = status;
      await request.response.close();
    });
    final api = CourierOrdersApi(
      config: ApiConfig(
        baseUrl: 'http://${server.address.address}:${server.port}',
      ),
    );
    Future<CourierOrdersStatus> call() async =>
        (await api.confirmDelivery(orderId: _id, accessToken: 'token')).status;
    expect(await call(), CourierOrdersStatus.unauthorized);
    status = HttpStatus.forbidden;
    expect(await call(), CourierOrdersStatus.forbidden);
    status = HttpStatus.notFound;
    expect(await call(), CourierOrdersStatus.notFound);
    status = HttpStatus.conflict;
    expect(await call(), CourierOrdersStatus.conflict);
    status = HttpStatus.serviceUnavailable;
    expect(await call(), CourierOrdersStatus.unavailable);
    expect(
      (await api.confirmDelivery(
        orderId: 'invalid',
        accessToken: 'token',
      )).status,
      CourierOrdersStatus.notConfigured,
    );
  });
}
