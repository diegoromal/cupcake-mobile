import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/design/app_theme.dart';
import '../features/auth/data/customer_registration_api.dart';
import '../features/auth/presentation/customer_login_page.dart';

class CupcakeApp extends StatelessWidget {
  const CupcakeApp({super.key, this.registrationApi});

  final CustomerRegistrationApi? registrationApi;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Cupcake Mobile',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: CustomerLoginPage(registrationApi: registrationApi),
  );
}
