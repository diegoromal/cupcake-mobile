import 'package:flutter/material.dart';

import '../data/customer_auth_api.dart';
import '../data/session_storage.dart';
import '../session/customer_session.dart';
import 'customer_session_page.dart';

class CourierAccessPage extends StatefulWidget {
  const CourierAccessPage({super.key});

  @override
  State<CourierAccessPage> createState() => _CourierAccessPageState();
}

class _CourierAccessPageState extends State<CourierAccessPage> {
  late final CustomerSession _session = CustomerSession(
    authApi: CustomerAuthApi(profile: SessionProfile.courier),
    storage: SecureSessionStorage(profile: SessionProfile.courier),
  );

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => CustomerSessionPage(session: _session);
}
