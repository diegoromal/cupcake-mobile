import 'package:flutter/material.dart';

import '../../features/auth/data/customer_registration_api.dart';
import '../../features/auth/presentation/customer_sign_up_page.dart';

abstract final class AppNavigation {
  static Future<void> openCustomerSignUp(
    BuildContext context, {
    CustomerRegistrationApi? registrationApi,
  }) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => CustomerSignUpPage(registrationApi: registrationApi),
      ),
    );
    if (created == true && context.mounted) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Semantics(
              liveRegion: true,
              label: 'Cadastro confirmado. Entre para continuar.',
              child: Text('Cadastro confirmado. Entre para continuar.'),
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
    }
  }

  static void returnToLogin(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  static void completeSignUp(BuildContext context) {
    Navigator.of(context).pop(true);
  }
}
