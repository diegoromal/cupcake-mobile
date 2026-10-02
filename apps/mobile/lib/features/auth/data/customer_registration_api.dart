import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

enum RegistrationStatus {
  created,
  validation,
  conflict,
  serverResponseError,
  indeterminate,
  notSent,
}

class RegistrationResult {
  const RegistrationResult(
    this.status, {
    this.fieldErrors = const {},
    this.statusCode,
    this.hasHttpResponse = false,
    this.bodyRead = false,
    this.bodyParsed = false,
    this.bodyFailureType,
  });

  final RegistrationStatus status;
  final Map<String, String> fieldErrors;
  final int? statusCode;
  final bool hasHttpResponse;
  final bool bodyRead;
  final bool bodyParsed;
  final String? bodyFailureType;
}

class CustomerRegistrationApi {
  CustomerRegistrationApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<RegistrationResult> register({
    required String nome,
    required String email,
    required String telefone,
    required String senha,
  }) async {
    final uri = _config.usersUri;
    if (uri == null) {
      return const RegistrationResult(RegistrationStatus.notSent);
    }

    final client = _clientFactory();
    int? receivedStatusCode;
    try {
      return await _send(
        client,
        uri,
        onResponse: (statusCode) => receivedStatusCode = statusCode,
        nome: nome,
        email: email,
        telefone: telefone,
        senha: senha,
      ).timeout(timeout);
    } on TimeoutException {
      return _afterFailure(receivedStatusCode);
    } on SocketException {
      return _afterFailure(receivedStatusCode);
    } on HttpException {
      return _afterFailure(receivedStatusCode);
    } on FormatException {
      return _afterFailure(receivedStatusCode);
    } catch (_) {
      return _afterFailure(receivedStatusCode);
    } finally {
      client.close(force: true);
    }
  }

  Future<RegistrationResult> _send(
    HttpClient client,
    Uri uri, {
    required void Function(int statusCode) onResponse,
    required String nome,
    required String email,
    required String telefone,
    required String senha,
  }) async {
    final request = await client.postUrl(uri);
    request.followRedirects = false;
    request.headers.contentType = ContentType.json;
    request.write(
      jsonEncode({
        'nome': nome.trim(),
        'email': email.trim().toLowerCase(),
        'telefone': telefone.trim(),
        'senha': senha,
      }),
    );
    final response = await request.close();
    final statusCode = response.statusCode;
    onResponse(statusCode);
    String body;
    try {
      body = await response.transform(utf8.decoder).join();
    } on HttpException {
      return _mapResponse(
        statusCode,
        '',
        bodyRead: false,
        bodyParsed: false,
        bodyFailureType: 'HttpException',
      );
    } on Object catch (error) {
      return _mapResponse(
        statusCode,
        '',
        bodyRead: false,
        bodyParsed: false,
        bodyFailureType: error.runtimeType.toString(),
      );
    }
    switch (statusCode) {
      case HttpStatus.created:
        final valid = _validCreatedBody(body);
        return RegistrationResult(
          valid ? RegistrationStatus.created : RegistrationStatus.indeterminate,
          statusCode: statusCode,
          hasHttpResponse: true,
          bodyRead: true,
          bodyParsed: valid,
        );
      case HttpStatus.badRequest:
        return RegistrationResult(
          RegistrationStatus.validation,
          fieldErrors: _fieldErrors(body),
          statusCode: statusCode,
          hasHttpResponse: true,
          bodyRead: true,
          bodyParsed: _isJsonObject(body),
        );
      case HttpStatus.conflict:
        return RegistrationResult(
          RegistrationStatus.conflict,
          statusCode: statusCode,
          hasHttpResponse: true,
          bodyRead: true,
          bodyParsed: _isJsonObject(body),
        );
      default:
        return RegistrationResult(
          RegistrationStatus.serverResponseError,
          statusCode: statusCode,
          hasHttpResponse: true,
          bodyRead: true,
          bodyParsed: _isJsonObject(body),
        );
    }
  }

  RegistrationResult _afterFailure(int? statusCode) => statusCode == null
      ? const RegistrationResult(RegistrationStatus.indeterminate)
      : _mapResponse(statusCode, '', bodyRead: false, bodyParsed: false);

  RegistrationResult _mapResponse(
    int statusCode,
    String body, {
    required bool bodyRead,
    required bool bodyParsed,
    String? bodyFailureType,
  }) {
    final status = switch (statusCode) {
      HttpStatus.created => RegistrationStatus.indeterminate,
      HttpStatus.badRequest => RegistrationStatus.validation,
      HttpStatus.conflict => RegistrationStatus.conflict,
      _ => RegistrationStatus.serverResponseError,
    };
    return RegistrationResult(
      status,
      fieldErrors: status == RegistrationStatus.validation && bodyRead
          ? _fieldErrors(body)
          : const {},
      statusCode: statusCode,
      hasHttpResponse: true,
      bodyRead: bodyRead,
      bodyParsed: bodyParsed,
      bodyFailureType: bodyFailureType,
    );
  }

  bool _isJsonObject(String body) {
    try {
      return jsonDecode(body) is Map<String, dynamic>;
    } on FormatException {
      return false;
    }
  }

  bool _validCreatedBody(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return false;
      final id = decoded['id'];
      final uuid =
          id is String &&
          RegExp(
            r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
          ).hasMatch(id);
      return uuid &&
          _nonEmptyString(decoded['nome']) &&
          _nonEmptyString(decoded['email']) &&
          _nonEmptyString(decoded['telefone']) &&
          decoded['perfil'] == 'CLIENTE';
    } on FormatException {
      return false;
    }
  }

  bool _nonEmptyString(Object? value) => value is String && value.isNotEmpty;

  Map<String, String> _fieldErrors(String body) {
    try {
      final decoded = jsonDecode(body);
      final raw = decoded is Map<String, dynamic> ? decoded['message'] : null;
      final messages = raw is List ? raw.whereType<String>() : <String>[];
      final errors = <String, String>{};
      for (final message in messages) {
        final lower = message.toLowerCase();
        if (lower.contains('email') || lower.contains('e-mail')) {
          errors['email'] = 'Informe um e-mail válido.';
        } else if (lower.contains('telefone')) {
          errors['telefone'] = 'Informe seu telefone.';
        } else if (lower.contains('nome')) {
          errors['nome'] = 'Informe seu nome.';
        } else if (lower.contains('senha') || lower.contains('password')) {
          errors['senha'] = 'Verifique sua senha.';
        }
      }
      return errors;
    } on FormatException {
      return const {};
    }
  }
}
