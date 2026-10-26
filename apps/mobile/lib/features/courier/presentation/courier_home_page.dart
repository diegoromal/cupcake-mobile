import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';

class CourierHomePage extends StatelessWidget {
  const CourierHomePage({super.key, required this.session});

  final CustomerSession session;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Área do entregador'),
      actions: [
        TextButton(onPressed: session.signOut, child: const Text('Sair')),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spacing24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Semantics(
              liveRegion: true,
              child: const Text(
                'Suas entregas atribuídas aparecerão aqui.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
