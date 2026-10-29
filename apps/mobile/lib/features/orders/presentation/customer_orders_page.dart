import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/customer_orders_api.dart';

class CustomerOrdersPage extends StatefulWidget {
  const CustomerOrdersPage({super.key, required this.session, this.api});

  final CustomerSession session;
  final CustomerOrdersApi? api;

  @override
  State<CustomerOrdersPage> createState() => _CustomerOrdersPageState();
}

class _CustomerOrdersPageState extends State<CustomerOrdersPage>
    with WidgetsBindingObserver {
  static const _refreshInterval = Duration(seconds: 30);
  late final CustomerOrdersApi _api = widget.api ?? CustomerOrdersApi();
  Timer? _timer;
  int _generation = 0;
  bool _loading = true;
  bool _requestInProgress = false;
  bool _refreshPending = false;
  CustomerOrdersStatus? _status;
  List<CustomerOrder> _orders = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.session.addListener(_sessionChanged);
    _syncTimer();
    unawaited(_load());
  }

  @override
  void dispose() {
    _generation++;
    _timer?.cancel();
    widget.session.removeListener(_sessionChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _syncTimer();
      unawaited(_load());
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _syncTimer() {
    _timer?.cancel();
    _timer = null;
    final lifecycleState = WidgetsBinding.instance.lifecycleState;
    if (!widget.session.isAuthenticated ||
        lifecycleState == AppLifecycleState.inactive ||
        lifecycleState == AppLifecycleState.paused ||
        lifecycleState == AppLifecycleState.hidden ||
        lifecycleState == AppLifecycleState.detached) {
      return;
    }
    _timer = Timer.periodic(_refreshInterval, (_) => unawaited(_load()));
  }

  void _sessionChanged() {
    if (widget.session.isAuthenticated) {
      _syncTimer();
      return;
    }
    _generation++;
    _timer?.cancel();
    _timer = null;
    if (mounted) {
      setState(() {
        _orders = const [];
        _status = CustomerOrdersStatus.unauthorized;
        _loading = false;
      });
    }
  }

  Future<void> _load() async {
    if (!widget.session.isAuthenticated) return;
    if (_requestInProgress) {
      _refreshPending = true;
      return;
    }
    final generation = ++_generation;
    _requestInProgress = true;
    if (mounted) {
      setState(() {
        _loading = _orders.isEmpty;
        if (_orders.isEmpty) _status = null;
      });
    }
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    var result = token == null
        ? const CustomerOrdersResult(CustomerOrdersStatus.unauthorized)
        : await _api.fetchOrders(accessToken: token);
    if (result.status == CustomerOrdersStatus.unauthorized &&
        token != null &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (!mounted ||
          generation != _generation ||
          !widget.session.isAuthenticated) {
        _finishRequest();
        return;
      }
      result = token == null
          ? widget.session.refreshUnavailable
                ? const CustomerOrdersResult(CustomerOrdersStatus.unavailable)
                : const CustomerOrdersResult(CustomerOrdersStatus.unauthorized)
          : await _api.fetchOrders(accessToken: token);
    }
    _finishRequest();
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    if (result.status == CustomerOrdersStatus.unauthorized) {
      await widget.session.signOut();
      return;
    }
    setState(() {
      _loading = false;
      _status = result.status;
      if (result.status == CustomerOrdersStatus.success) {
        _orders = result.orders ?? const [];
      }
    });
  }

  void _finishRequest() {
    _requestInProgress = false;
    if (!_refreshPending || !widget.session.isAuthenticated || !mounted) return;
    _refreshPending = false;
    scheduleMicrotask(() => unawaited(_load()));
  }

  Widget _content() {
    if (_loading) {
      return Center(
        child: Semantics(
          label: 'Carregando pedidos…',
          liveRegion: true,
          child: CircularProgressIndicator(),
        ),
      );
    }
    if (_status != CustomerOrdersStatus.success && _orders.isEmpty) {
      final message = switch (_status) {
        CustomerOrdersStatus.unauthorized =>
          'Sessão expirada. Entre novamente.',
        CustomerOrdersStatus.forbidden =>
          'Sua conta não tem acesso aos pedidos.',
        CustomerOrdersStatus.notConfigured =>
          'Os pedidos não estão configurados neste aplicativo.',
        _ => 'Não foi possível carregar seus pedidos. Tente novamente.',
      };
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: 300,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Semantics(
                    liveRegion: true,
                    child: Text(message, textAlign: TextAlign.center),
                  ),
                  if (_status != CustomerOrdersStatus.unauthorized &&
                      _status != CustomerOrdersStatus.forbidden) ...[
                    const SizedBox(height: AppTokens.spacing16),
                    FilledButton(
                      onPressed: _load,
                      child: const Text('Tentar novamente'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      );
    }
    if (_orders.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: 300,
            child: Center(
              child: Semantics(
                liveRegion: true,
                child: Text('Você ainda não tem pedidos.'),
              ),
            ),
          ),
        ],
      );
    }
    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: _orders.length,
      itemBuilder: (context, index) {
        final order = _orders[index];
        return Card(
          color: AppTokens.surface,
          child: ListTile(
            title: Text('Pedido ${order.businessNumber}'),
            subtitle: Text(
              '${_dateLabel(order.date)} · ${order.fulfillment == 'ENTREGA' ? 'Entrega' : 'Retirada'}\nStatus: ${_statusLabel(order.status)}',
            ),
            isThreeLine: true,
            trailing: Text('R\$ ${order.total.replaceAll('.', ',')}'),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Meus Pedidos'),
      actions: [
        IconButton(
          tooltip: 'Atualizar pedidos',
          onPressed: _requestInProgress ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: RefreshIndicator(
            onRefresh: _load,
            child: Padding(
              padding: const EdgeInsets.all(AppTokens.spacing16),
              child: _content(),
            ),
          ),
        ),
      ),
    ),
  );
}

String _dateLabel(DateTime date) {
  final local = date.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$day/$month/${local.year} às $hour:$minute';
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
