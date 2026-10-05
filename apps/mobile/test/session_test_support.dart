import 'dart:async';

import 'package:cupcake_mobile/core/config/api_config.dart';
import 'package:cupcake_mobile/features/auth/data/customer_auth_api.dart';
import 'package:cupcake_mobile/features/auth/data/session_storage.dart';
import 'package:cupcake_mobile/features/auth/session/customer_session.dart';
import 'package:flutter_test/flutter_test.dart';

class MemorySessionStorage implements SessionStorage {
  CustomerTokens? value;
  Object? readFailure;
  Object? writeFailure;
  Object? clearFailure;
  Completer<void>? writeGate;
  int writes = 0;
  int clears = 0;

  @override
  Future<CustomerTokens?> read() async {
    if (readFailure case final failure?) throw failure;
    return value;
  }

  @override
  Future<void> write(CustomerTokens tokens) async {
    writes++;
    if (writeFailure case final failure?) throw failure;
    await writeGate?.future;
    value = tokens;
  }

  @override
  Future<void> clear() async {
    clears++;
    if (clearFailure case final failure?) throw failure;
    value = null;
  }
}

CustomerSession createCustomerSession({
  CustomerAuthApi? authApi,
  MemorySessionStorage? storage,
}) => CustomerSession(
  authApi:
      authApi ??
      CustomerAuthApi(config: ApiConfig(baseUrl: 'https://example.invalid')),
  storage: storage ?? MemorySessionStorage(),
);

Future<void> pumpUntilSessionReady(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 1));
}
