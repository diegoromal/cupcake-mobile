import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/address/data/customer_address_api.dart';
import 'package:flutter_test/flutter_test.dart';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

void main() {
  test('URI, Bearer, parsing estrito e status HTTP', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    addTearDown(() => server.close(force: true));
    final replies = <(int, String)>[
      (
        200,
        '{"situacao":"ATENDIDO","distanciaKm":"1.234","raioMaximoKm":"5.000","frete":"12.34"}',
      ),
      (
        200,
        '{"situacao":"FORA_DA_COBERTURA","distanciaKm":"6.000","raioMaximoKm":"5.000","frete":null}',
      ),
      (
        200,
        '{"situacao":"LOCALIZACAO_INDISPONIVEL","distanciaKm":null,"raioMaximoKm":null,"frete":null}',
      ),
      (401, ''),
      (403, ''),
      (404, ''),
      (503, ''),
      (200, '{'),
      (
        200,
        '{"situacao":"ATENDIDO","distanciaKm":"1.234","raioMaximoKm":"5.000","frete":null}',
      ),
      (418, ''),
    ];
    final received = <String>[];
    final serving = () async {
      await for (final request in server) {
        received.add(
          '${request.method} ${request.uri.path} ${request.headers.value(HttpHeaders.authorizationHeader)}',
        );
        final reply = replies.removeAt(0);
        request.response.statusCode = reply.$1;
        request.response.write(reply.$2);
        await request.response.close();
      }
    }();
    final api = CustomerAddressApi(
      config: ApiConfig(baseUrl: 'http://127.0.0.1:${server.port}'),
    );
    final expected = [
      AddressStatus.success,
      AddressStatus.success,
      AddressStatus.success,
      AddressStatus.unauthorized,
      AddressStatus.forbidden,
      AddressStatus.notFound,
      AddressStatus.configurationUnavailable,
      AddressStatus.invalidResponse,
      AddressStatus.invalidResponse,
      AddressStatus.invalidResponse,
    ];
    final results = <AddressResult<CoverageFreight>>[];
    for (var i = 0; i < expected.length; i++) {
      results.add(await api.coverageFreight('abc', id));
    }
    expect(results.map((r) => r.status).toList(), expected);
    expect(results[0].value!.situation, CoverageSituation.attended);
    expect(results[0].value!.freight, '12.34');
    expect(results[1].value!.situation, CoverageSituation.outsideCoverage);
    expect(results[1].value!.freight, isNull);
    expect(results[2].value!.situation, CoverageSituation.locationUnavailable);
    expect(results[2].value!.freight, isNull);
    expect(
      received,
      everyElement('GET /enderecos/$id/cobertura-frete Bearer abc'),
    );
    await server.close(force: true);
    await serving;
  });

  test(
    'falha de rede é recuperável e ID inválido não dispara request',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final port = server.port;
      await server.close(force: true);
      final api = CustomerAddressApi(
        config: ApiConfig(baseUrl: 'http://127.0.0.1:$port'),
        timeout: const Duration(milliseconds: 100),
      );
      expect(
        (await api.coverageFreight('abc', id)).status,
        AddressStatus.networkError,
      );
      expect(
        (await api.coverageFreight('abc', 'invalid')).status,
        AddressStatus.notConfigured,
      );
    },
  );

  test(
    'parser não aceita campos extras, frete nulo atendido ou valores calculados',
    () {
      final valid = {
        'situacao': 'ATENDIDO',
        'distanciaKm': '1.234',
        'raioMaximoKm': '5.000',
        'frete': '999999999.99',
      };
      expect(CoverageFreight.parse(valid)?.freight, '999999999.99');
      expect(CoverageFreight.parse({...valid, 'frete': null}), isNull);
      expect(CoverageFreight.parse({...valid, 'extra': 1}), isNull);
      expect(CoverageFreight.parse({...valid, 'distanciaKm': 1.234}), isNull);
      expect(
        CoverageFreight.parse({...valid, 'situacao': 'DESCONHECIDO'}),
        isNull,
      );
    },
  );
}
