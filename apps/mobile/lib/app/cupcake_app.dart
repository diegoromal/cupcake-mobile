import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/design/app_theme.dart';
import '../features/auth/data/customer_auth_api.dart';
import '../features/auth/data/customer_registration_api.dart';
import '../features/auth/data/session_storage.dart';
import '../features/auth/presentation/customer_session_page.dart';
import '../features/auth/session/customer_session.dart';

class CupcakeApp extends StatefulWidget {
  const CupcakeApp({
    super.key,
    this.registrationApi,
    this.authApi,
    this.sessionStorage,
    this.session,
  });

  final CustomerRegistrationApi? registrationApi;
  final CustomerAuthApi? authApi;
  final SessionStorage? sessionStorage;
  final CustomerSession? session;

  @override
  State<CupcakeApp> createState() => _CupcakeAppState();
}

class _CupcakeAppState extends State<CupcakeApp> {
  late final CustomerSession _session =
      widget.session ??
      CustomerSession(
        authApi: widget.authApi ?? CustomerAuthApi(),
        storage: widget.sessionStorage ?? SecureSessionStorage(),
      );

  @override
  void dispose() {
    if (widget.session == null) _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Cupcake Mobile',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: CustomerSessionPage(
      session: _session,
      registrationApi: widget.registrationApi,
    ),
  );
}
