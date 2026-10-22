import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../../../core/config/api_config.dart';

enum AddressStatus {
  success,
  invalid,
  notFound,
  ambiguous,
  unauthorized,
  forbidden,
  unavailable,
  indeterminate,
  notConfigured,
  configurationUnavailable,
  networkError,
  invalidResponse,
}

enum CoverageSituation { attended, outsideCoverage, locationUnavailable }

class CoverageFreight {
  const CoverageFreight(this.situation, this.freight);
  final CoverageSituation situation;
  final String? freight;

  static CoverageFreight? parse(Object? data) {
    if (data is! Map<String, dynamic> ||
        data.length != 4 ||
        !data.keys.toSet().containsAll({
          'situacao',
          'distanciaKm',
          'raioMaximoKm',
          'frete',
        })) {
      return null;
    }
    final situation = data['situacao'];
    final distance = data['distanciaKm'];
    final radius = data['raioMaximoKm'];
    final freight = data['frete'];
    final threeDecimals = RegExp(r'^\d+\.\d{3}$');
    final twoDecimals = RegExp(r'^\d+\.\d{2}$');
    if (situation == 'ATENDIDO' &&
        distance is String &&
        threeDecimals.hasMatch(distance) &&
        radius is String &&
        threeDecimals.hasMatch(radius) &&
        freight is String &&
        twoDecimals.hasMatch(freight)) {
      return CoverageFreight(CoverageSituation.attended, freight);
    }
    if (situation == 'FORA_DA_COBERTURA' &&
        distance is String &&
        threeDecimals.hasMatch(distance) &&
        radius is String &&
        threeDecimals.hasMatch(radius) &&
        freight == null) {
      return const CoverageFreight(CoverageSituation.outsideCoverage, null);
    }
    if (situation == 'LOCALIZACAO_INDISPONIVEL' &&
        distance == null &&
        radius == null &&
        freight == null) {
      return const CoverageFreight(CoverageSituation.locationUnavailable, null);
    }
    return null;
  }
}

class CustomerAddress {
  const CustomerAddress({
    required this.id,
    required this.street,
    required this.number,
    required this.neighborhood,
    required this.city,
    required this.cep,
    required this.complement,
    required this.reference,
    required this.located,
  });
  final String id, street, number, neighborhood, city, cep;
  final String? complement, reference;
  final bool located;
  static CustomerAddress? parse(Object? data) {
    if (data is! Map<String, dynamic>) return null;
    final id = data['id'],
        street = data['rua'],
        number = data['numero'],
        neighborhood = data['bairro'],
        city = data['cidade'],
        cep = data['cep'];
    final lat = data['latitude'], lon = data['longitude'];
    if (id is! String ||
        street is! String ||
        number is! String ||
        neighborhood is! String ||
        city is! String ||
        cep is! String ||
        !RegExp(r'^\d{8}$').hasMatch(cep) ||
        (data['complemento'] != null && data['complemento'] is! String) ||
        (data['referencia'] != null && data['referencia'] is! String) ||
        (lat != null && lat is! String) ||
        (lon != null && lon is! String) ||
        (lat == null) != (lon == null)) {
      return null;
    }
    return CustomerAddress(
      id: id,
      street: street,
      number: number,
      neighborhood: neighborhood,
      city: city,
      cep: cep,
      complement: data['complemento'] as String?,
      reference: data['referencia'] as String?,
      located: lat != null,
    );
  }
}

class CepData {
  const CepData(this.street, this.neighborhood, this.city, this.uf);
  final String street, neighborhood, city, uf;
  static CepData? parse(Object? data) {
    if (data is! Map<String, dynamic> ||
        data['rua'] is! String ||
        data['bairro'] is! String ||
        data['cidade'] is! String ||
        data['uf'] is! String) {
      return null;
    }
    return CepData(
      data['rua'] as String,
      data['bairro'] as String,
      data['cidade'] as String,
      data['uf'] as String,
    );
  }
}

class AddressResult<T> {
  const AddressResult(this.status, {this.value});
  final AddressStatus status;
  final T? value;
}

class CustomerAddressApi {
  CustomerAddressApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 10),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;
  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<AddressResult<List<CustomerAddress>>> list(String token) async {
    final response = await _call(_config.addressesUri, token, 'GET');
    if (response.status != AddressStatus.success) {
      return AddressResult(response.status);
    }
    final data = response.value;
    if (data is! List) return const AddressResult(AddressStatus.unavailable);
    final parsed = data.map(CustomerAddress.parse).toList();
    if (parsed.any((item) => item == null)) {
      return const AddressResult(AddressStatus.unavailable);
    }
    return AddressResult(
      AddressStatus.success,
      value: parsed.cast<CustomerAddress>(),
    );
  }

  Future<AddressResult<CustomerAddress>> create(
    String token,
    Map<String, Object?> body,
  ) async {
    final response = await _call(
      _config.addressesUri,
      token,
      'POST',
      body: body,
      successCode: 201,
    );
    if (response.status != AddressStatus.success) {
      return AddressResult(response.status);
    }
    final address = CustomerAddress.parse(response.value);
    return address == null
        ? const AddressResult(AddressStatus.indeterminate)
        : AddressResult(AddressStatus.success, value: address);
  }

  Future<AddressResult<CepData>> lookupCep(String token, String cep) async {
    final response = await _call(_config.cepUri(cep), token, 'GET');
    if (response.status != AddressStatus.success) {
      return AddressResult(response.status);
    }
    final result = CepData.parse(response.value);
    return result == null
        ? const AddressResult(AddressStatus.unavailable)
        : AddressResult(AddressStatus.success, value: result);
  }

  Future<AddressResult<void>> geocode(String token, String id) async {
    final response = await _call(_config.geocodingUri(id), token, 'POST');
    if (response.status != AddressStatus.success) {
      return AddressResult(response.status);
    }
    final data = response.value;
    if (data is! Map<String, dynamic> ||
        data['latitude'] is! String ||
        data['longitude'] is! String) {
      return const AddressResult(AddressStatus.indeterminate);
    }
    return const AddressResult(AddressStatus.success);
  }

  Future<AddressResult<CoverageFreight>> coverageFreight(
    String token,
    String id,
  ) async {
    final response = await _call(
      _config.coverageFreightUri(id),
      token,
      'GET',
      networkStatus: AddressStatus.networkError,
      invalidResponseStatus: AddressStatus.invalidResponse,
      serverUnavailableStatus: AddressStatus.configurationUnavailable,
    );
    if (response.status != AddressStatus.success) {
      return AddressResult(response.status);
    }
    final value = CoverageFreight.parse(response.value);
    return value == null
        ? const AddressResult(AddressStatus.invalidResponse)
        : AddressResult(AddressStatus.success, value: value);
  }

  Future<AddressResult<Object?>> _call(
    Uri? uri,
    String token,
    String method, {
    Map<String, Object?>? body,
    int successCode = 200,
    AddressStatus networkStatus = AddressStatus.unavailable,
    AddressStatus invalidResponseStatus = AddressStatus.unavailable,
    AddressStatus serverUnavailableStatus = AddressStatus.unavailable,
  }) async {
    if (uri == null) return const AddressResult(AddressStatus.notConfigured);
    final client = _clientFactory();
    int? code;
    try {
      final request =
          await (method == 'POST' ? client.postUrl(uri) : client.getUrl(uri))
              .timeout(timeout);
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response = await request.close().timeout(timeout);
      code = response.statusCode;
      if (code == 401) return const AddressResult(AddressStatus.unauthorized);
      if (code == 403) return const AddressResult(AddressStatus.forbidden);
      if (code == 400 || code == 422) {
        return const AddressResult(AddressStatus.invalid);
      }
      if (code == 404) return const AddressResult(AddressStatus.notFound);
      if (code == 409) return const AddressResult(AddressStatus.ambiguous);
      if (code == 503) return AddressResult(serverUnavailableStatus);
      if (code != successCode) {
        return AddressResult(invalidResponseStatus);
      }
      final text = await utf8.decoder.bind(response.timeout(timeout)).join();
      return AddressResult(AddressStatus.success, value: jsonDecode(text));
    } on FormatException {
      return AddressResult(invalidResponseStatus);
    } on Object {
      return AddressResult(
        method == 'POST' && (code == null || code == successCode)
            ? AddressStatus.indeterminate
            : networkStatus,
      );
    } finally {
      client.close(force: true);
    }
  }
}
