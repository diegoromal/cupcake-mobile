import 'package:flutter/material.dart';

import '../../features/auth/presentation/customer_sign_up_page.dart';

abstract final class AppNavigation {
  static Future<void> openCustomerSignUp(BuildContext context) {
    return Navigator.of(context).push<void>(
      MaterialPageRoute<void>(builder: (_) => const CustomerSignUpPage()),
    );
  }

  static void returnToLogin(BuildContext context) {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }
}
