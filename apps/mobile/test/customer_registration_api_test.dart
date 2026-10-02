import 'dart:convert';
import 'dart:io';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_registration_api.dart';
import 'package:flutter_test/flutter_test.dart';

const _uuid = '9b72c770-bc74-4c77-82c7-205c2d91628a';

Future<HttpServer> _server(
  Future<void> Function(HttpRequest request) handler,
) async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  server.listen(handler);
  return server;
}

CustomerRegistrationApi _api(HttpServer server, {Duration? timeout}) =>
    CustomerRegistrationApi(
      config: ApiConfig(
        baseUrl: 'http://${server.address.address}:${server.port}',
      ),
      timeout: timeout ?? const Duration(seconds: 2),
    );

void main() {
  test('envia um POST /users com JSON e exatamente quatro campos', () async {
    late Map<String, dynamic> payload;
    var requests = 0;
    final server = await _server((request) async {
      requests++;
      expect(request.method, 'POST');
      expect(request.uri.path, '/users');
      expect(request.headers.contentType?.mimeType, 'application/json');
      expect(request.headers.value(HttpHeaders.authorizationHeader), isNull);
      payload =
          jsonDecode(await utf8.decoder.bind(request).join())
              as Map<String, dynamic>;
      request.response
        ..statusCode = 201
        ..write(
          jsonEncode({
            'id': _uuid,
            'nome': 'Ana',
            'email': 'ana@example.com',
            'telefone': '123',
            'perfil': 'CLIENTE',
          }),
        );
      await request.response.close();
    });
    addTearDown(server.close);

    final result = await _api(server).register(
      nome: ' Ana ',
      email: ' ANA@EXAMPLE.COM ',
      telefone: ' 123 ',
      senha: ' senha123 ',
    );
    expect(result.status, RegistrationStatus.created);
    expect(payload.keys.toSet(), {'nome', 'email', 'telefone', 'senha'});
    expect(payload, {
      'nome': 'Ana',
      'email': 'ana@example.com',
      'telefone': '123',
      'senha': ' senha123 ',
    });
    expect(requests, 1);
  });

  test('mapeia 400 reconhecível e mantém fallback defensivo', () async {
    final server = await _server((request) async {
      request.response
        ..statusCode = 400
        ..write(
          jsonEncode({
            'message': ['email must be an email', '<html>interno'],
          }),
        );
      await request.response.close();
    });
    addTearDown(server.close);
    final result = await _api(
      server,
    ).register(nome: 'Ana', email: 'a@b.com', telefone: '1', senha: '12345678');
    expect(result.status, RegistrationStatus.validation);
    expect(result.fieldErrors, {'email': 'Informe um e-mail válido.'});
  });

  test('mapeia 409 e falha técnica 500 sem repetir', () async {
    var requests = 0;
    final server = await _server((request) async {
      requests++;
      request.response.statusCode = requests == 1 ? 409 : 500;
      await request.response.close();
    });
    addTearDown(server.close);
    Future<RegistrationResult> send() => _api(
      server,
    ).register(nome: 'Ana', email: 'a@b.com', telefone: '1', senha: '12345678');
    expect((await send()).status, RegistrationStatus.conflict);
    expect((await send()).status, RegistrationStatus.serverResponseError);
    expect(requests, 2);
  });

  test(
    '201 inválido não confirma sucesso; timeout é indeterminado sem retry',
    () async {
      var requests = 0;
      final server = await _server((request) async {
        requests++;
        await Future<void>.delayed(const Duration(milliseconds: 100));
        request.response
          ..statusCode = 201
          ..write('{}');
        await request.response.close();
      });
      addTearDown(server.close);
      final result =
          await _api(
            server,
            timeout: const Duration(milliseconds: 20),
          ).register(
            nome: 'Ana',
            email: 'a@b.com',
            telefone: '1',
            senha: '12345678',
          );
      expect(result.status, RegistrationStatus.indeterminate);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(requests, 1);
    },
  );

  test(
    'rejeita resposta 201 sem estrutura, corpo não JSON e status inesperado',
    () async {
      var requests = 0;
      final server = await _server((request) async {
        requests++;
        request.response
          ..statusCode = requests < 3 ? 201 : 422
          ..write(switch (requests) {
            1 => '{}',
            2 => '<html>erro</html>',
            _ => '{}',
          });
        await request.response.close();
      });
      addTearDown(server.close);
      Future<RegistrationResult> send() => _api(server).register(
        nome: 'Ana',
        email: 'a@b.com',
        telefone: '1',
        senha: '12345678',
      );
      expect((await send()).status, RegistrationStatus.indeterminate);
      expect((await send()).status, RegistrationStatus.indeterminate);
      expect((await send()).status, RegistrationStatus.serverResponseError);
    },
  );

  test(
    'SocketException é resultado indeterminado sem expor detalhes',
    () async {
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      final port = server.port;
      await server.close(force: true);
      final result =
          await CustomerRegistrationApi(
            config: ApiConfig(baseUrl: 'http://127.0.0.1:$port'),
            timeout: const Duration(seconds: 1),
          ).register(
            nome: 'Ana',
            email: 'a@b.com',
            telefone: '1',
            senha: '12345678',
          );
      expect(result.status, RegistrationStatus.indeterminate);
    },
  );

  test(
    'HttpException antes dos headers resulta em estado indeterminado',
    () async {
      Future<HttpServer> serverClosingBeforeHeaders(
        void Function() onRequest,
      ) => _server((request) async {
        onRequest();
        final socket = await request.response.detachSocket(writeHeaders: false);
        socket.destroy();
      });

      var probeRequests = 0;
      final probeServer = await serverClosingBeforeHeaders(
        () => probeRequests++,
      );
      addTearDown(probeServer.close);

      // The production API intentionally hides transport exceptions. Probe the
      // identical pre-headers failure through HttpClient to capture its type.
      final client = HttpClient();
      HttpException? capturedException;
      try {
        final request = await client.postUrl(
          Uri.parse(
            'http://${probeServer.address.address}:${probeServer.port}/users',
          ),
        );
        await request.close();
        fail('Esperava HttpException antes de receber headers.');
      } on HttpException catch (exception) {
        capturedException = exception;
      } finally {
        client.close(force: true);
      }
      expect(capturedException, isA<HttpException>());
      expect(probeRequests, 1);

      var apiRequests = 0;
      final apiServer = await serverClosingBeforeHeaders(() => apiRequests++);
      addTearDown(apiServer.close);
      final result = await _api(apiServer).register(
        nome: 'Ana',
        email: 'a@b.com',
        telefone: '1',
        senha: '12345678',
      );
      expect(result.status, RegistrationStatus.indeterminate);
      expect(result.statusCode, isNull);
      expect(result.hasHttpResponse, isFalse);
      expect(apiRequests, 1);
    },
  );

  for (final statusCode in [400, 409, 500, 418, 201]) {
    test('preserva HTTP $statusCode quando o corpo é interrompido', () async {
      var requests = 0;
      final server = await _server((request) async {
        requests++;
        final socket = await request.response.detachSocket(writeHeaders: false);
        socket
          ..write('HTTP/1.1 $statusCode Test\r\n')
          ..write('Content-Type: application/json\r\n')
          ..write('Content-Length: 100\r\n\r\n')
          ..write('{"partial":');
        await socket.flush();
        socket.destroy();
      });
      addTearDown(server.close);

      final result = await _api(server).register(
        nome: 'Ana',
        email: 'a@b.com',
        telefone: '1',
        senha: '12345678',
      );

      expect(result.statusCode, statusCode);
      expect(result.hasHttpResponse, isTrue);
      expect(result.bodyRead, isFalse);
      expect(result.bodyParsed, isFalse);
      expect(requests, 1);
      expect(result.status, switch (statusCode) {
        400 => RegistrationStatus.validation,
        409 => RegistrationStatus.conflict,
        500 => RegistrationStatus.serverResponseError,
        418 => RegistrationStatus.serverResponseError,
        _ => RegistrationStatus.indeterminate,
      });
      if (statusCode == 400) {
        expect(result.fieldErrors, isEmpty);
      }
      if (statusCode == 418) {
        expect(result.status, RegistrationStatus.serverResponseError);
      }
    });
  }

  test('HttpException após status preserva resposta HTTP conhecida', () async {
    var requests = 0;
    final server = await _server((request) async {
      requests++;
      final socket = await request.response.detachSocket(writeHeaders: false);
      socket
        ..write('HTTP/1.1 418 Teapot\r\n')
        ..write('Transfer-Encoding: chunked\r\n\r\n')
        ..write('not-a-chunk\r\n');
      await socket.flush();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      socket.destroy();
    });
    addTearDown(server.close);

    final result = await _api(
      server,
    ).register(nome: 'Ana', email: 'a@b.com', telefone: '1', senha: '12345678');

    expect(result.statusCode, 418);
    expect(result.hasHttpResponse, isTrue);
    expect(result.status, RegistrationStatus.serverResponseError);
    expect(result.bodyRead, isFalse);
    expect(result.bodyFailureType, 'HttpException');
    expect(result.fieldErrors, isEmpty);
    expect(requests, 1);
  });

  test('timeout ao ler corpo mantém status recebido e não repete', () async {
    var requests = 0;
    final server = await _server((request) async {
      requests++;
      request.response
        ..statusCode = 500
        ..headers.contentLength = 100;
      final socket = await request.response.detachSocket(writeHeaders: true);
      await Future<void>.delayed(const Duration(milliseconds: 150));
      socket.destroy();
    });
    addTearDown(server.close);

    final result = await _api(
      server,
      timeout: const Duration(milliseconds: 30),
    ).register(nome: 'Ana', email: 'a@b.com', telefone: '1', senha: '12345678');

    expect(result.status, RegistrationStatus.serverResponseError);
    expect(result.statusCode, 500);
    expect(result.hasHttpResponse, isTrue);
    expect(result.bodyRead, isFalse);
    expect(requests, 1);
  });

  test('URL ausente ou inválida não inicia uma conexão', () async {
    final result = await CustomerRegistrationApi(
      config: ApiConfig(baseUrl: ''),
    ).register(nome: 'Ana', email: 'a@b.com', telefone: '1', senha: '12345678');
    expect(result.status, RegistrationStatus.notSent);
    expect(ApiConfig(baseUrl: 'http://example.com').usersUri, isNull);
    expect(
      ApiConfig(baseUrl: 'https://api.example.com/').usersUri?.path,
      '/users',
    );
    expect(ApiConfig(baseUrl: 'https://api.example.com/v1').usersUri, isNull);
  });
}
