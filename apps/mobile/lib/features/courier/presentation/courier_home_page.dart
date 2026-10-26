import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/courier_orders_api.dart';
import 'courier_order_detail_page.dart';

class CourierHomePage extends StatefulWidget {
  const CourierHomePage({super.key, required this.session, this.api});

  final CustomerSession session;
  final CourierOrdersApi? api;

  @override
  State<CourierHomePage> createState() => _CourierHomePageState();
}

class _CourierHomePageState extends State<CourierHomePage> {
  late final CourierOrdersApi _api = widget.api ?? CourierOrdersApi();
  int _generation = 0;
  bool _loading = true;
  CourierOrdersStatus? _status;
  List<CourierOrder> _orders = const [];

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_sessionChanged);
    unawaited(_load());
  }

  @override
  void dispose() {
    _generation++;
    widget.session.removeListener(_sessionChanged);
    super.dispose();
  }

  void _sessionChanged() {
    if (widget.session.isAuthenticated) return;
    _generation++;
    if (mounted) {
      setState(() {
        _orders = const [];
        _status = CourierOrdersStatus.unauthorized;
        _loading = false;
      });
    }
  }

  Future<void> _load() async {
    if (!widget.session.isAuthenticated) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _status = null;
      _orders = const [];
    });
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    var result = token == null
        ? const CourierOrdersResult(CourierOrdersStatus.unauthorized)
        : await _api.fetchOrders(accessToken: token);
    if (result.status == CourierOrdersStatus.unauthorized &&
        token != null &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (!mounted ||
          generation != _generation ||
          !widget.session.isAuthenticated) {
        return;
      }
      result = token == null
          ? widget.session.refreshUnavailable
                ? const CourierOrdersResult(CourierOrdersStatus.unavailable)
                : const CourierOrdersResult(CourierOrdersStatus.unauthorized)
          : await _api.fetchOrders(accessToken: token);
    }
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    if (result.status == CourierOrdersStatus.unauthorized) {
      await widget.session.signOut();
      return;
    }
    setState(() {
      _loading = false;
      _status = result.status;
      _orders = result.status == CourierOrdersStatus.success
          ? result.orders ?? const []
          : const [];
    });
  }

  Widget _content() {
    if (_loading) {
      return Center(
        child: Semantics(
          label: 'Carregando entregas…',
          liveRegion: true,
          child: const CircularProgressIndicator(),
        ),
      );
    }
    if (_status != CourierOrdersStatus.success) {
      final message = switch (_status) {
        CourierOrdersStatus.unauthorized => 'Sessão expirada. Entre novamente.',
        CourierOrdersStatus.forbidden =>
          'Sua conta não tem acesso às entregas.',
        CourierOrdersStatus.notConfigured =>
          'As entregas não estão configuradas neste aplicativo.',
        _ => 'Não foi possível carregar suas entregas. Tente novamente.',
      };
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(
              liveRegion: true,
              child: Text(message, textAlign: TextAlign.center),
            ),
            if (_status != CourierOrdersStatus.forbidden &&
                _status != CourierOrdersStatus.unauthorized) ...[
              const SizedBox(height: AppTokens.spacing16),
              FilledButton(
                onPressed: _load,
                child: const Text('Tentar novamente'),
              ),
            ],
          ],
        ),
      );
    }
    if (_orders.isEmpty) {
      return Center(
        child: Semantics(
          liveRegion: true,
          child: const Text('Nenhuma entrega atribuída no momento.'),
        ),
      );
    }
    return ListView.builder(
      itemCount: _orders.length,
      itemBuilder: (context, index) {
        final order = _orders[index];
        return Card(
          child: ListTile(
            title: Text('Pedido ${order.businessNumber}'),
            subtitle: Text('Status: ${_statusLabel(order.status)}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => CourierOrderDetailPage(
                  orderId: order.id,
                  session: widget.session,
                  api: _api,
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Área do entregador'),
      actions: [
        IconButton(
          tooltip: 'Atualizar entregas',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
        TextButton(
          onPressed: widget.session.signOut,
          child: const Text('Sair'),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(AppTokens.spacing16),
            child: _content(),
          ),
        ),
      ),
    ),
  );
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
