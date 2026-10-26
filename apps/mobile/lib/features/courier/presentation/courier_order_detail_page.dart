import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/courier_orders_api.dart';

class CourierOrderDetailPage extends StatefulWidget {
  const CourierOrderDetailPage({
    super.key,
    required this.orderId,
    required this.initialStatus,
    required this.session,
    required this.api,
  });

  final String orderId;
  final String initialStatus;
  final CustomerSession session;
  final CourierOrdersApi api;

  @override
  State<CourierOrderDetailPage> createState() => _CourierOrderDetailPageState();
}

class _CourierOrderDetailPageState extends State<CourierOrderDetailPage> {
  int _generation = 0;
  bool _loading = true;
  CourierOrdersStatus? _status;
  CourierOrderDetail? _detail;
  late String _deliveryStatus = widget.initialStatus;
  DateTime? _deliveredAt;
  bool _confirming = false;
  bool _checkingStatus = false;
  bool _indeterminate = false;
  bool _confirmationBlocked = false;
  String? _confirmationMessage;

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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    });
  }

  Future<void> _load() async {
    if (!widget.session.isAuthenticated) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _status = null;
      _detail = null;
    });
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    var result = token == null
        ? const CourierOrderDetailResult(CourierOrdersStatus.unauthorized)
        : await widget.api.fetchDetail(
            orderId: widget.orderId,
            accessToken: token,
          );
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
                ? const CourierOrderDetailResult(
                    CourierOrdersStatus.unavailable,
                  )
                : const CourierOrderDetailResult(
                    CourierOrdersStatus.unauthorized,
                  )
          : await widget.api.fetchDetail(
              orderId: widget.orderId,
              accessToken: token,
            );
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
      _detail = result.detail;
    });
  }

  Future<void> _confirmDelivery() async {
    if (!widget.session.isAuthenticated ||
        _confirming ||
        _checkingStatus ||
        _indeterminate ||
        _confirmationBlocked ||
        _deliveryStatus != 'SAIU_PARA_ENTREGA') {
      return;
    }
    final generation = ++_generation;
    setState(() {
      _confirming = true;
      _confirmationMessage = null;
    });
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    var result = token == null
        ? const CourierDeliveryConfirmationResult(
            CourierOrdersStatus.unauthorized,
          )
        : await widget.api.confirmDelivery(
            orderId: widget.orderId,
            accessToken: token,
          );
    var uncertain =
        result.status == CourierOrdersStatus.unavailable && token != null;
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
                ? const CourierDeliveryConfirmationResult(
                    CourierOrdersStatus.unavailable,
                  )
                : const CourierDeliveryConfirmationResult(
                    CourierOrdersStatus.unauthorized,
                  )
          : await widget.api.confirmDelivery(
              orderId: widget.orderId,
              accessToken: token,
            );
      uncertain =
          token != null && result.status == CourierOrdersStatus.unavailable;
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
      _confirming = false;
      if (result.status == CourierOrdersStatus.success) {
        _deliveryStatus = 'ENTREGUE';
        _deliveredAt = result.deliveredAt;
        _confirmationMessage = 'Entrega confirmada.';
      } else if (result.status == CourierOrdersStatus.forbidden ||
          result.status == CourierOrdersStatus.notFound) {
        _confirmationBlocked = true;
        _confirmationMessage = result.status == CourierOrdersStatus.forbidden
            ? 'Acesso negado a esta entrega.'
            : 'Entrega não encontrada.';
      } else if (result.status == CourierOrdersStatus.conflict || uncertain) {
        _indeterminate = true;
        _confirmationMessage = 'Verificando o estado da entrega…';
      } else {
        _confirmationMessage = 'Não foi possível confirmar. Tente novamente.';
      }
    });
    if (result.status == CourierOrdersStatus.conflict || uncertain) {
      await _checkStatus();
    }
  }

  Future<void> _checkStatus() async {
    if (!widget.session.isAuthenticated || _checkingStatus) return;
    final generation = ++_generation;
    setState(() => _checkingStatus = true);
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    var result = token == null
        ? const CourierOrdersResult(CourierOrdersStatus.unauthorized)
        : await widget.api.fetchOrders(accessToken: token);
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
          : await widget.api.fetchOrders(accessToken: token);
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
      _checkingStatus = false;
      if (result.status == CourierOrdersStatus.forbidden) {
        _confirmationBlocked = true;
        _confirmationMessage = 'Acesso negado a esta entrega.';
        return;
      }
      if (result.status != CourierOrdersStatus.success) {
        _confirmationMessage =
            'Resultado incerto. Verifique o estado antes de reenviar.';
        return;
      }
      final matches = (result.orders ?? const <CourierOrder>[]).where(
        (order) => order.id == widget.orderId,
      );
      if (matches.isEmpty) {
        _confirmationBlocked = true;
        _confirmationMessage = 'Entrega não encontrada.';
        return;
      }
      _deliveryStatus = matches.single.status;
      _indeterminate = false;
      _confirmationMessage = _deliveryStatus == 'ENTREGUE'
          ? 'Entrega confirmada.'
          : 'Entrega ainda não confirmada. Você pode tentar novamente.';
    });
  }

  Widget _body() {
    if (_loading) {
      return Center(
        child: Semantics(
          label: 'Carregando detalhe da entrega…',
          liveRegion: true,
          child: const CircularProgressIndicator(),
        ),
      );
    }
    final detail = _detail;
    if (_status != CourierOrdersStatus.success || detail == null) {
      final message = switch (_status) {
        CourierOrdersStatus.forbidden => 'Acesso negado a esta entrega.',
        CourierOrdersStatus.notFound => 'Entrega não encontrada.',
        CourierOrdersStatus.notConfigured =>
          'O detalhe da entrega não está configurado neste aplicativo.',
        _ => 'Não foi possível carregar a entrega. Tente novamente.',
      };
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(
              liveRegion: true,
              child: Text(message, textAlign: TextAlign.center),
            ),
            if (_status == CourierOrdersStatus.unavailable ||
                _status == CourierOrdersStatus.notConfigured) ...[
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
    final address = detail.address;
    final departure = detail.departureAt?.toLocal();
    final localizations = MaterialLocalizations.of(context);
    return ListView(
      children: [
        Text(
          'Pedido ${detail.businessNumber}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: AppTokens.spacing24),
        Text('Cliente', style: Theme.of(context).textTheme.titleMedium),
        Text(detail.customerName),
        Text('Telefone: ${detail.customerPhone}'),
        const SizedBox(height: AppTokens.spacing24),
        Text(
          'Endereço de entrega',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text('${address.street}, ${address.number}'),
        Text('${address.neighborhood} — ${address.city}'),
        Text('CEP: ${address.postalCode}'),
        if (address.complement != null && address.complement!.isNotEmpty)
          Text('Complemento: ${address.complement}'),
        if (address.reference != null && address.reference!.isNotEmpty)
          Text('Referência: ${address.reference}'),
        const SizedBox(height: AppTokens.spacing24),
        Text(
          'Saída para entrega',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        Text(
          departure == null
              ? 'Horário de saída indisponível'
              : '${localizations.formatFullDate(departure)} às ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(departure))}',
        ),
        const SizedBox(height: AppTokens.spacing24),
        Text(
          'Status: ${_deliveryStatus == 'ENTREGUE'
              ? 'Entregue'
              : _deliveryStatus == 'SAIU_PARA_ENTREGA'
              ? 'Saiu para entrega'
              : _deliveryStatus}',
        ),
        if (_deliveredAt != null)
          Text(
            'Confirmada em ${localizations.formatFullDate(_deliveredAt!.toLocal())} às ${localizations.formatTimeOfDay(TimeOfDay.fromDateTime(_deliveredAt!.toLocal()))}',
          ),
        if (_confirmationMessage != null) ...[
          const SizedBox(height: AppTokens.spacing16),
          Semantics(liveRegion: true, child: Text(_confirmationMessage!)),
        ],
        if (_deliveryStatus == 'SAIU_PARA_ENTREGA' &&
            !_confirmationBlocked) ...[
          const SizedBox(height: AppTokens.spacing16),
          if (_indeterminate)
            FilledButton(
              onPressed: _checkingStatus ? null : _checkStatus,
              child: Text(
                _checkingStatus ? 'Verificando…' : 'Verificar estado',
              ),
            )
          else
            FilledButton(
              onPressed: _confirming || _checkingStatus
                  ? null
                  : _confirmDelivery,
              child: Text(_confirming ? 'Confirmando…' : 'Confirmar entrega'),
            ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Detalhe da entrega')),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(AppTokens.spacing16),
            child: _body(),
          ),
        ),
      ),
    ),
  );
}
