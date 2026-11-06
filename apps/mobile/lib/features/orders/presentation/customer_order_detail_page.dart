import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../data/customer_orders_api.dart';

/// Shows only order data already returned by the customer orders endpoint.
class CustomerOrderDetailPage extends StatelessWidget {
  const CustomerOrderDetailPage({super.key, required this.order})
    : orderId = null,
      orderNumber = null,
      paymentTotal = null;

  const CustomerOrderDetailPage.forPayment({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.paymentTotal,
  }) : order = null;

  final CustomerOrder? order;
  final String? orderId;
  final String? orderNumber;
  final String? paymentTotal;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Detalhe do pedido')),
    body: ListView(
      padding: const EdgeInsets.all(AppTokens.spacing16),
      children: [
        Text(
          'Pedido ${order?.businessNumber ?? orderNumber}',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: AppTokens.spacing16),
        if (order case final value?) ...[
          _row(context, 'Identificador', value.id),
          _row(context, 'Status', _statusLabel(value.status)),
          _row(context, 'Data', _dateLabel(value.date)),
          _row(
            context,
            'Modalidade',
            value.fulfillment == 'ENTREGA' ? 'Delivery' : 'Retirada',
          ),
          _row(context, 'Total', 'R\$ ${value.total.replaceAll('.', ',')}'),
        ] else ...[
          _row(context, 'Identificador', orderId!),
          _row(context, 'Status', 'Pagamento aprovado'),
          _row(context, 'Total', 'R\$ ${paymentTotal!.replaceAll('.', ',')}'),
        ],
      ],
    ),
  );

  Widget _row(BuildContext context, String label, String value) => Card(
    color: AppTokens.surface,
    child: ListTile(title: Text(label), subtitle: Text(value)),
  );
}

String _dateLabel(DateTime date) {
  final local = date.toLocal();
  return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} às ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
}

String _statusLabel(String status) => switch (status) {
  'PENDENTE_PAGAMENTO' => 'Pendente de pagamento',
  'PAGO' => 'Pago',
  'EM_PREPARO' => 'Em preparo',
  'SAIU_PARA_ENTREGA' => 'Saiu para entrega',
  'ENTREGUE' => 'Entregue',
  'PRONTO_PARA_RETIRADA' => 'Pronto para retirada',
  'RETIRADO' => 'Retirado',
  'EXPIRADO' => 'Expirado',
  'CANCELADO' => 'Cancelado',
  _ => status,
};
