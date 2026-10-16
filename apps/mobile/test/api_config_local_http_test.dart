import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('HTTP LAN exige autorização e continua restrito ao IP do ambiente', () {
    const authorized = bool.fromEnvironment('ALLOW_LOCAL_HTTP_API');
    final lan = ApiConfig(baseUrl: 'http://172.25.0.17:3000');
    expect(lan.usersUri?.path, authorized ? '/users' : null);
    expect(ApiConfig(baseUrl: 'http://example.com').usersUri, isNull);
    expect(ApiConfig(baseUrl: 'http://192.168.1.10:3000').usersUri, isNull);
    expect(ApiConfig(baseUrl: 'http://api.local:3000').usersUri, isNull);
    expect(
      ApiConfig(baseUrl: 'https://api.example.com').usersUri?.path,
      '/users',
    );
  });
}
