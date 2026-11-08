import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../orders/presentation/customer_order_detail_page.dart';

enum PaymentOutcome { approved, declined, unknown }

enum PaymentResultAction { retry, verify }

class PaymentResultPage extends StatelessWidget {
  const PaymentResultPage({
    super.key,
    required this.outcome,
    required this.orderNumber,
    this.orderId = '',
    required this.total,
    this.method,
    this.receipt,
  });

  final PaymentOutcome outcome;
  final String orderNumber;
  final String orderId;
  final String total;
  final String? method;
  final Map<String, dynamic>? receipt;

  String get _displayNumber => receipt?['numeroPublico'] is int
      ? '#${receipt!['numeroPublico']}'
      : _orderNumberLabel(orderNumber);

  List<Widget> _receiptDetails() {
    final order = receipt;
    if (outcome != PaymentOutcome.approved || order == null) {
      return [Text('Total: R\$ ${_formatAmount(total)}')];
    }
    final address = order['enderecoEntregaSnapshot'] as Map<String, dynamic>?;
    final items = order['itens'] as List;
    return [
      Text(
        'Recebimento: ${order['modalidade'] == 'ENTREGA' ? 'Delivery' : 'Retirada'}',
      ),
      if (address != null) ...[
        const SizedBox(height: 8),
        Text('Entregar em: ${address['rua']}, ${address['numero']}'),
        Text('${address['bairro']} · ${address['cidade']} · ${address['cep']}'),
      ],
      const Divider(height: AppTokens.spacing32),
      for (final raw in items) ...[
        Text('${raw['quantidade']} × ${raw['nome']}'),
        for (final option in raw['personalizacoes'] as List)
          Text(_personalizationLabel(option as Map<String, dynamic>)),
        Text('Unitário: R\$ ${_formatAmount(raw['precoAplicado'] as String)}'),
        Text(
          'Subtotal: R\$ ${_formatAmount(raw['subtotalAplicado'] as String)}',
        ),
        const SizedBox(height: 8),
      ],
      const Divider(height: AppTokens.spacing32),
      Text('Itens: R\$ ${_formatAmount(order['valorItens'] as String)}'),
      Text('Frete: R\$ ${_formatAmount(order['freteAplicado'] as String)}'),
      Text('Total: R\$ ${_formatAmount(order['total'] as String)}'),
    ];
  }

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
  Widget build(BuildContext context) => PopScope(
    canPop: outcome != PaymentOutcome.approved,
    child: Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: outcome != PaymentOutcome.approved,
        title: const Text('Resultado do pagamento'),
      ),
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
                    color: AppTokens.surface,
                    child: Padding(
                      padding: const EdgeInsets.all(AppTokens.spacing16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Pedido $_displayNumber',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (outcome == PaymentOutcome.approved) ...[
                            const SizedBox(height: 4),
                            const Text('Pagamento aprovado'),
                          ],
                          const Divider(height: AppTokens.spacing32),
                          ..._receiptDetails(),
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
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) => CustomerOrderDetailPage.forPayment(
                            orderId: orderId,
                            orderNumber: orderNumber,
                            paymentTotal: total,
                          ),
                        ),
                      ),
                      child: const Text('Ver meu pedido'),
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
                  if (outcome == PaymentOutcome.approved)
                    OutlinedButton(
                      onPressed: () => Navigator.of(
                        context,
                      ).popUntil((route) => route.isFirst),
                      child: const Text('Voltar ao cardápio'),
                    ),
                ],
              ),
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

String _personalizationLabel(Map<String, dynamic> option) {
  final adjustment = option['ajusteValorAplicado'];
  return '  ${option['nomeAplicado']}${adjustment is String ? ' · R\$ ${_formatAmount(adjustment)}' : ''}';
}
