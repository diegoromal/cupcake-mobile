import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'customer_auth_api.dart';

abstract interface class SessionStorage {
  Future<CustomerTokens?> read();
  Future<void> write(CustomerTokens tokens);
  Future<void> clear();
}

class SecureSessionStorage implements SessionStorage {
  SecureSessionStorage({
    FlutterSecureStorage? storage,
    this.profile = SessionProfile.customer,
  }) : _storage =
           storage ??
           const FlutterSecureStorage(
             iOptions: IOSOptions(
               accessibility: KeychainAccessibility.unlocked,
             ),
           );

  final SessionProfile profile;
  final FlutterSecureStorage _storage;

  String get _key => switch (profile) {
    SessionProfile.customer => 'customer_session',
    SessionProfile.courier => 'courier_session',
  };

  @override
  Future<CustomerTokens?> read() async {
    final value = await _storage.read(key: _key);
    if (value == null) return null;
    try {
      final decoded = jsonDecode(value);
      final tokens = CustomerTokens.fromJson(decoded, profile: profile);
      if (tokens == null) await clear();
      return tokens;
    } on FormatException {
      await clear();
      return null;
    }
  }

  @override
  Future<void> write(CustomerTokens tokens) =>
      _storage.write(key: _key, value: jsonEncode(tokens.toJson()));

  @override
  Future<void> clear() => _storage.delete(key: _key);
}
