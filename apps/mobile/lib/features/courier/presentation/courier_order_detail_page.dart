import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/courier_orders_api.dart';

class CourierOrderDetailPage extends StatefulWidget {
  const CourierOrderDetailPage({
    super.key,
    required this.orderId,
    required this.session,
    required this.api,
  });

  final String orderId;
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
