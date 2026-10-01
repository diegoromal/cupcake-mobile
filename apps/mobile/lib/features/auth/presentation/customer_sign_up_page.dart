import 'package:flutter/material.dart';

import '../../../app/navigation/app_navigation.dart';
import '../../../core/design/app_tokens.dart';

class CustomerSignUpPage extends StatelessWidget {
  const CustomerSignUpPage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: AppTokens.background,
      leading: IconButton(
        tooltip: 'Voltar para Entrar',
        onPressed: () => Navigator.of(context).pop(),
        icon: const Icon(Icons.arrow_back),
      ),
    ),
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacing24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: (constraints.maxHeight - AppTokens.spacing24 * 2)
                  .clamp(0.0, double.infinity)
                  .toDouble(),
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        'Criar conta',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                    ),
                    const SizedBox(height: AppTokens.spacing12),
                    const Text(
                      'Crie sua conta para começar.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppTokens.spacing32),
                    FilledButton(
                      onPressed: () => AppNavigation.returnToLogin(context),
                      child: const Text('Entrar'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
