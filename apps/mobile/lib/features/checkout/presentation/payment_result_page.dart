import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';

enum PaymentOutcome { approved, declined, unknown }

enum PaymentResultAction { retry, verify }

class PaymentResultPage extends StatelessWidget {
  const PaymentResultPage({
    super.key,
    required this.outcome,
    required this.orderNumber,
    required this.total,
    this.method,
  });

  final PaymentOutcome outcome;
  final String orderNumber;
  final String total;
  final String? method;

  String get _title => switch (outcome) {
    PaymentOutcome.approved => 'Pagamento aprovado',
    PaymentOutcome.declined => 'Pagamento não aprovado',
    PaymentOutcome.unknown => 'Resultado não confirmado',
  };

  String get _message => switch (outcome) {
    PaymentOutcome.approved =>
      'O pagamento foi confirmado e vinculado ao seu pedido.',
    PaymentOutcome.declined =>
      'Pagamento não aprovado. Você pode tentar novamente com este pedido.',
    PaymentOutcome.unknown =>
      'Não foi possível confirmar o resultado. Verifique a mesma tentativa antes de iniciar outro pagamento.',
  };

  String? get _actionLabel => switch (outcome) {
    PaymentOutcome.approved => null,
    PaymentOutcome.declined => 'Tentar novamente',
    PaymentOutcome.unknown => 'Verificar tentativa',
  };

  PaymentResultAction? get _action => switch (outcome) {
    PaymentOutcome.approved => null,
    PaymentOutcome.declined => PaymentResultAction.retry,
    PaymentOutcome.unknown => PaymentResultAction.verify,
  };

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Resultado do pagamento')),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppTokens.spacing16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppTokens.spacing16),
                Icon(
                  switch (outcome) {
                    PaymentOutcome.approved => Icons.check_circle,
                    PaymentOutcome.declined => Icons.cancel_outlined,
                    PaymentOutcome.unknown => Icons.help_outline,
                  },
                  size: 52,
                  color: switch (outcome) {
                    PaymentOutcome.approved => Colors.green.shade800,
                    PaymentOutcome.declined => Theme.of(
                      context,
                    ).colorScheme.error,
                    PaymentOutcome.unknown => AppTokens.textMuted,
                  },
                  semanticLabel: _title,
                ),
                const SizedBox(height: AppTokens.spacing16),
                Semantics(
                  liveRegion: true,
                  header: true,
                  child: Text(
                    _title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: 8),
                Text(_message, textAlign: TextAlign.center),
                const SizedBox(height: AppTokens.spacing24),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(AppTokens.spacing16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Pedido ${_orderNumberLabel(orderNumber)}',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        if (outcome == PaymentOutcome.approved) ...[
                          const SizedBox(height: 4),
                          const Text('Pagamento aprovado'),
                        ],
                        const Divider(height: AppTokens.spacing32),
                        Text('Total: R\$ ${_formatAmount(total)}'),
                        if (method case final value?) ...[
                          const SizedBox(height: 8),
                          Text('Forma de pagamento: $value'),
                        ],
                      ],
                    ),
                  ),
                ),
                if (outcome == PaymentOutcome.approved) ...[
                  const SizedBox(height: AppTokens.spacing16),
                  // A rota de detalhe depende das tarefas posteriores de pedidos (D83/D84).
                  OutlinedButton(
                    onPressed: null,
                    child: const Text('Ver pedido'),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'A consulta do pedido ainda não está disponível.',
                    textAlign: TextAlign.center,
                  ),
                ],
                if (_action case final action?) ...[
                  const SizedBox(height: AppTokens.spacing16),
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(action),
                    child: Text(_actionLabel!),
                  ),
                ],
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () =>
                      Navigator.of(context).popUntil((route) => route.isFirst),
                  child: const Text('Voltar para o início'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

String _orderNumberLabel(String value) =>
    value.startsWith('#') ? value : '#$value';

String _formatAmount(String value) => value.replaceFirst('.', ',');
