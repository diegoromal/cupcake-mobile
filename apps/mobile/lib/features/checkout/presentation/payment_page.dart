import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/customer_payment_api.dart';
import 'payment_result_page.dart';

class PaymentPage extends StatefulWidget {
  const PaymentPage({
    super.key,
    required this.session,
    required this.orderId,
    required this.orderNumber,
    required this.total,
    this.paymentApi,
  });

  final CustomerSession session;
  final String orderId;
  final String orderNumber;
  final String total;
  final CustomerPaymentApi? paymentApi;

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage> {
  late final CustomerPaymentApi _api =
      widget.paymentApi ?? CustomerPaymentApi();
  String? _method;
  String? _attemptId;
  String? _result;
  PaymentStatus? _status;
  bool _processing = false;
  bool _uncertain = false;
  int _generation = 0;
  int _sessionRefreshDepth = 0;
  late String? _sessionToken = widget.session.accessToken;

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_sessionChanged);
  }

  @override
  void dispose() {
    _generation++;
    widget.session.removeListener(_sessionChanged);
    super.dispose();
  }

  void _sessionChanged() {
    if (!widget.session.isAuthenticated) {
      _generation++;
      if (mounted) {
        final requestMayHaveStarted = _processing && _attemptId != null;
        setState(() {
          _processing = false;
          _uncertain = requestMayHaveStarted;
          _status = PaymentStatus.unauthorized;
        });
      }
      return;
    }
    final token = widget.session.accessToken;
    if (token == _sessionToken) return;
    _sessionToken = token;
    if (_sessionRefreshDepth == 0 && _processing && mounted) {
      _generation++;
      setState(() {
        _processing = false;
        _uncertain = _attemptId != null;
        _status = PaymentStatus.timeout;
      });
    }
  }

  Future<PaymentResult> _request(
    Future<PaymentResult> Function(String token) action,
    int generation,
  ) async {
    _sessionRefreshDepth++;
    try {
      await widget.session.refreshIfNeeded();
    } finally {
      _sessionRefreshDepth--;
      _sessionToken = widget.session.accessToken;
    }
    if (!mounted || generation != _generation) {
      return const PaymentResult(PaymentStatus.unauthorized);
    }
    var token = widget.session.accessToken;
    if (token == null) return const PaymentResult(PaymentStatus.unauthorized);
    var result = await action(token);
    if (result.status == PaymentStatus.unauthorized &&
        mounted &&
        generation == _generation) {
      _sessionRefreshDepth++;
      try {
        token = await widget.session.refreshAfterUnauthorized(token);
      } finally {
        _sessionRefreshDepth--;
        _sessionToken = widget.session.accessToken;
      }
      if (token == null || !mounted || generation != _generation) {
        return const PaymentResult(PaymentStatus.unauthorized);
      }
      result = await action(token);
    }
    return result;
  }

  Future<void> _submit() async {
    final method = _method;
    if (_processing || method == null || _uncertain) return;
    final attemptId = _attemptId ?? _newUuid();
    final generation = ++_generation;
    setState(() {
      _processing = true;
      _attemptId = attemptId;
      _status = null;
    });
    final response = _checkTotal(
      await _request(
        (token) => _api.start(token, widget.orderId, method, attemptId),
        generation,
      ),
    );
    if (!mounted || generation != _generation) return;
    setState(() {
      _processing = false;
      _status = response.status;
      _result = response.status == PaymentStatus.success
          ? response.value!['resultado'] as String
          : null;
      _uncertain = _couldHaveStarted(response.status) || _result == 'PENDENTE';
    });
    await _showResult(response);
  }

  Future<void> _verify() async {
    final method = _method;
    final attemptId = _attemptId;
    if (_processing || method == null || attemptId == null) return;
    final generation = ++_generation;
    setState(() {
      _processing = true;
      _status = null;
    });
    final response = _checkTotal(
      await _request(
        (token) => _api.verify(token, widget.orderId, method, attemptId),
        generation,
      ),
    );
    if (!mounted || generation != _generation) return;
    setState(() {
      _processing = false;
      _status = response.status;
      _result = response.status == PaymentStatus.success
          ? response.value!['resultado'] as String
          : null;
      _uncertain = _couldHaveStarted(response.status) || _result == 'PENDENTE';
    });
    await _showResult(response);
  }

  PaymentResult _checkTotal(PaymentResult response) {
    if (response.status == PaymentStatus.success &&
        response.value?['valorAplicavel'] != widget.total) {
      return const PaymentResult(PaymentStatus.invalidResponse);
    }
    return response;
  }

  Future<void> _showResult(PaymentResult response) async {
    final outcome = switch (response.status) {
      PaymentStatus.success when response.value?['resultado'] == 'APROVADO' =>
        PaymentOutcome.approved,
      PaymentStatus.success when response.value?['resultado'] == 'RECUSADO' =>
        PaymentOutcome.declined,
      PaymentStatus.success when response.value?['resultado'] == 'PENDENTE' =>
        PaymentOutcome.unknown,
      _ when _uncertain => PaymentOutcome.unknown,
      _ => null,
    };
    if (outcome == null) return;
    final confirmedMethod = switch (response.value?['forma']) {
      'PIX' => 'Pix',
      'CARTAO' => 'Cartão',
      _ => null,
    };
    final action = await Navigator.of(context).push<PaymentResultAction>(
      MaterialPageRoute<PaymentResultAction>(
        builder: (_) => PaymentResultPage(
          outcome: outcome,
          orderNumber: widget.orderNumber,
          total: response.value?['valorAplicavel'] as String? ?? widget.total,
          method: outcome == PaymentOutcome.unknown ? null : confirmedMethod,
        ),
      ),
    );
    if (!mounted) return;
    if (action == PaymentResultAction.retry) {
      setState(() {
        _result = null;
        _attemptId = null;
        _method = null;
        _status = null;
        _uncertain = false;
      });
    } else if (action == PaymentResultAction.verify) {
      await _verify();
    }
  }

  bool _couldHaveStarted(PaymentStatus status) => switch (status) {
    PaymentStatus.timeout ||
    PaymentStatus.networkError ||
    PaymentStatus.invalidResponse ||
    PaymentStatus.unavailable => true,
    _ => false,
  };

  void _selectMethod(String? method) {
    if (_locked) return;
    setState(() {
      _method = method;
      _attemptId = null;
      _result = null;
      _status = null;
    });
  }

  bool get _locked =>
      _processing ||
      _uncertain ||
      _result == 'APROVADO' ||
      _status == PaymentStatus.unauthorized ||
      _status == PaymentStatus.forbidden ||
      _status == PaymentStatus.notFound ||
      _status == PaymentStatus.conflict;

  String _errorMessage(PaymentStatus status) => switch (status) {
    PaymentStatus.unauthorized => 'Sessão expirada. Entre novamente.',
    PaymentStatus.forbidden => 'Sua conta não pode pagar este pedido.',
    PaymentStatus.notFound => 'Pedido não encontrado.',
    PaymentStatus.conflict =>
      'Este pedido não está mais disponível para pagamento.',
    PaymentStatus.unavailable =>
      'Não foi possível confirmar o resultado. Verifique a tentativa antes de pagar novamente.',
    PaymentStatus.timeout =>
      'A resposta demorou. Verifique esta tentativa antes de pagar novamente.',
    PaymentStatus.invalidResponse || PaymentStatus.networkError =>
      'Não foi possível confirmar o resultado. Verifique esta tentativa antes de pagar novamente.',
    PaymentStatus.success => '',
  };

  Widget _resultMessage() {
    if (_result == 'APROVADO') {
      return Semantics(
        liveRegion: true,
        child: Text(
          'Pagamento confirmado para o pedido ${widget.orderNumber}.',
          style: Theme.of(context).textTheme.titleMedium,
        ),
      );
    }
    if (_result == 'RECUSADO') {
      return Semantics(
        liveRegion: true,
        child: const Text(
          'O pagamento não foi aprovado. Você pode tentar novamente com este pedido.',
        ),
      );
    }
    if (_result == 'PENDENTE') {
      return Semantics(
        liveRegion: true,
        child: const Text(
          'O resultado ainda não foi confirmado. Verifique esta tentativa.',
        ),
      );
    }
    final status = _status;
    if (status == null || status == PaymentStatus.success) {
      return const SizedBox.shrink();
    }
    return Semantics(liveRegion: true, child: Text(_errorMessage(status)));
  }

  String get _totalLabel => 'R\$ ${widget.total.replaceFirst('.', ',')}';

  Widget _primaryAction() {
    if (_uncertain || _result == 'PENDENTE') {
      return OutlinedButton(
        onPressed: _processing ? null : () => unawaited(_verify()),
        child: Text(_processing ? 'Verificando…' : 'Verificar tentativa'),
      );
    }
    if (_result == 'RECUSADO') {
      return FilledButton(
        onPressed: _processing
            ? null
            : () {
                setState(() {
                  _result = null;
                  _attemptId = null;
                  _method = null;
                  _status = null;
                });
              },
        child: const Text('Tentar novamente'),
      );
    }
    if (_result == 'APROVADO') return const SizedBox.shrink();
    return FilledButton(
      onPressed: _method == null || _locked ? null : () => unawaited(_submit()),
      child: Text(_processing ? 'Processando…' : 'Pagar agora'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final locked = _locked;
    return Scaffold(
      appBar: AppBar(title: const Text('Pagamento')),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppTokens.spacing16,
            8,
            AppTokens.spacing16,
            AppTokens.spacing12,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                spacing: 12,
                runSpacing: 4,
                children: [
                  Text('Pedido ${widget.orderNumber}'),
                  Text('Total: $_totalLabel'),
                ],
              ),
              const SizedBox(height: 8),
              _primaryAction(),
            ],
          ),
        ),
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
                  Card(
                    color: AppTokens.surface,
                    child: Padding(
                      padding: const EdgeInsets.all(AppTokens.spacing16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Pedido ${widget.orderNumber}',
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _result == 'APROVADO'
                                ? 'Pagamento aprovado'
                                : 'Aguardando pagamento',
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Total a pagar: $_totalLabel',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppTokens.spacing24),
                  Text(
                    'Forma de pagamento',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  RadioGroup<String>(
                    groupValue: _method,
                    onChanged: (value) {
                      if (!locked) _selectMethod(value);
                    },
                    child: Card(
                      color: AppTokens.surface,
                      child: Column(
                        children: [
                          RadioListTile<String>(
                            value: 'pix',
                            enabled: !locked,
                            title: const Text('Pix'),
                          ),
                          const Divider(height: 1),
                          RadioListTile<String>(
                            value: 'cartao',
                            enabled: !locked,
                            title: const Text('Cartão'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppTokens.spacing16),
                  if (_method == null)
                    const Text(
                      'Escolha uma forma de pagamento para continuar.',
                    ),
                  if (_method != null && _result == null && !_uncertain)
                    Text(
                      _method == 'pix'
                          ? 'Pagamento via Pix.'
                          : 'Pagamento via Cartão.',
                    ),
                  if (_processing) ...[
                    const SizedBox(height: 12),
                    Semantics(
                      liveRegion: true,
                      child: Text('Processando pagamento…'),
                    ),
                    const LinearProgressIndicator(),
                  ],
                  if (_status != null && !_processing) ...[
                    const SizedBox(height: 12),
                    _resultMessage(),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

String _newUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
