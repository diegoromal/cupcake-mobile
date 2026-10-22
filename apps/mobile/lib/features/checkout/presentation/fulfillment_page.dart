import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../address/data/customer_address_api.dart';
import '../../address/presentation/customer_address_page.dart';
import '../../auth/session/customer_session.dart';

enum FulfillmentMode { delivery, pickup }

class FulfillmentPage extends StatefulWidget {
  const FulfillmentPage({super.key, required this.session, this.addressApi});
  final CustomerSession session;
  final CustomerAddressApi? addressApi;

  @override
  State<FulfillmentPage> createState() => _FulfillmentPageState();
}

class _FulfillmentPageState extends State<FulfillmentPage> {
  late final CustomerAddressApi _api =
      widget.addressApi ?? CustomerAddressApi();
  FulfillmentMode? _mode;
  List<CustomerAddress> _addresses = const [];
  String? _selectedId;
  CoverageFreight? _coverage;
  AddressStatus? _listStatus, _coverageStatus;
  bool _loadingAddresses = false, _loadingCoverage = false;
  int _selfRefreshDepth = 0;
  int _generation = 0;
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
        setState(() {
          _addresses = const [];
          _selectedId = null;
          _listStatus = AddressStatus.unauthorized;
          _loadingAddresses = false;
          _coverage = null;
          _coverageStatus = AddressStatus.unauthorized;
          _loadingCoverage = false;
        });
      }
      return;
    }
    final token = widget.session.accessToken;
    if (token == _sessionToken) return;
    _sessionToken = token;
    if (_selfRefreshDepth > 0) return;
    _generation++;
    if (_mode == FulfillmentMode.delivery) unawaited(_loadAddresses());
  }

  void _selectMode(FulfillmentMode mode) {
    if (_mode == mode) return;
    _generation++;
    setState(() {
      _mode = mode;
      _coverage = null;
      _coverageStatus = null;
      _loadingCoverage = false;
      if (mode == FulfillmentMode.pickup) {
        _loadingAddresses = false;
      }
    });
    if (mode == FulfillmentMode.delivery) unawaited(_loadAddresses());
  }

  Future<AddressResult<T>> _request<T>(
    Future<AddressResult<T>> Function(String) action,
    int generation,
  ) async {
    await _refreshSession(() => widget.session.refreshIfNeeded());
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return AddressResult<T>(AddressStatus.unauthorized);
    }
    var token = widget.session.accessToken;
    if (token == null) return AddressResult<T>(AddressStatus.unauthorized);
    var result = await action(token);
    if (result.status == AddressStatus.unauthorized &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await _refreshSession<String?>(
        () => widget.session.refreshAfterUnauthorized(token!),
      );
      if (token != null &&
          mounted &&
          generation == _generation &&
          widget.session.isAuthenticated) {
        result = await action(token);
      }
    }
    return result;
  }

  Future<T> _refreshSession<T>(Future<T> Function() refresh) async {
    _selfRefreshDepth++;
    try {
      return await refresh();
    } finally {
      _selfRefreshDepth--;
      _sessionToken = widget.session.accessToken;
    }
  }

  Future<void> _loadAddresses() async {
    final generation = ++_generation;
    setState(() {
      _loadingAddresses = true;
      _loadingCoverage = false;
      _coverage = null;
      _coverageStatus = null;
      _listStatus = null;
    });
    final result = await _request(_api.list, generation);
    if (!mounted ||
        generation != _generation ||
        _mode != FulfillmentMode.delivery) {
      return;
    }
    setState(() {
      _loadingAddresses = false;
      _listStatus = result.status;
      if (result.status == AddressStatus.success && result.value != null) {
        _addresses = result.value!;
        if (!_addresses.any((address) => address.id == _selectedId)) {
          _selectedId = null;
        }
      } else {
        _addresses = const [];
      }
    });
    if (_selectedId != null && result.status == AddressStatus.success) {
      unawaited(_checkCoverage());
    }
  }

  void _selectAddress(String id) {
    if (_selectedId == id) return;
    _generation++;
    setState(() {
      _selectedId = id;
      _coverage = null;
      _coverageStatus = null;
      _loadingCoverage = false;
    });
    unawaited(_checkCoverage());
  }

  Future<void> _checkCoverage() async {
    final id = _selectedId;
    if (_mode != FulfillmentMode.delivery || id == null) return;
    final generation = ++_generation;
    setState(() {
      _loadingCoverage = true;
      _coverage = null;
      _coverageStatus = null;
    });
    final result = await _request(
      (token) => _api.coverageFreight(token, id),
      generation,
    );
    if (!mounted ||
        generation != _generation ||
        _mode != FulfillmentMode.delivery ||
        _selectedId != id) {
      return;
    }
    if (result.status == AddressStatus.notFound) {
      setState(() {
        _selectedId = null;
        _coverage = null;
        _coverageStatus = null;
        _loadingCoverage = false;
      });
      unawaited(_loadAddresses());
      return;
    }
    setState(() {
      _loadingCoverage = false;
      _coverageStatus = result.status;
      _coverage = result.status == AddressStatus.success ? result.value : null;
    });
  }

  Future<void> _openAddresses() async {
    _generation++;
    setState(() {
      _coverage = null;
      _coverageStatus = null;
      _loadingCoverage = false;
    });
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => CustomerAddressPage(session: widget.session, api: _api),
      ),
    );
    if (mounted && _mode == FulfillmentMode.delivery) await _loadAddresses();
  }

  String _message(AddressStatus status) => switch (status) {
    AddressStatus.unauthorized => 'Sessão expirada. Entre novamente.',
    AddressStatus.forbidden => 'Sua conta não tem acesso à entrega.',
    AddressStatus.configurationUnavailable =>
      'Entrega indisponível no momento. Tente novamente mais tarde.',
    AddressStatus.networkError =>
      'Sem conexão para consultar a entrega. Tente novamente.',
    AddressStatus.invalidResponse =>
      'Não foi possível confirmar a entrega. Tente novamente.',
    _ => 'Não foi possível consultar a entrega. Tente novamente.',
  };

  Widget _notice(String message, {VoidCallback? retry}) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(liveRegion: true, child: Text(message)),
      if (retry != null) ...[
        const SizedBox(height: AppTokens.spacing12),
        OutlinedButton(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(AppTokens.touchTarget),
          ),
          onPressed: retry,
          child: const Text('Tentar novamente'),
        ),
      ],
    ],
  );

  Widget _delivery() {
    if (_loadingAddresses) return _notice('Carregando endereços…');
    if (_listStatus != AddressStatus.success) {
      return _notice(
        _message(_listStatus ?? AddressStatus.unavailable),
        retry:
            _listStatus == AddressStatus.forbidden ||
                _listStatus == AddressStatus.unauthorized
            ? null
            : () => unawaited(_loadAddresses()),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Endereço de entrega',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        if (_addresses.isEmpty) _notice('Nenhum endereço cadastrado.'),
        RadioGroup<String>(
          groupValue: _selectedId,
          onChanged: (id) {
            if (id != null) _selectAddress(id);
          },
          child: Column(
            children: [
              for (final address in _addresses)
                Card(
                  child: Semantics(
                    selected: _selectedId == address.id,
                    child: RadioListTile<String>(
                      value: address.id,
                      title: Text('${address.street}, ${address.number}'),
                      subtitle: Text(
                        '${address.neighborhood} · ${address.city} · ${address.cep}',
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: AppTokens.spacing12,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        OutlinedButton(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(AppTokens.touchTarget),
          ),
          onPressed: () => unawaited(_openAddresses()),
          child: const Text('Meus endereços'),
        ),
        if (_selectedId != null) ...[
          const SizedBox(height: AppTokens.spacing16),
          if (_loadingCoverage)
            _notice('Consultando entrega…')
          else if (_coverageStatus != AddressStatus.success)
            _notice(
              _message(_coverageStatus ?? AddressStatus.unavailable),
              retry:
                  _coverageStatus == AddressStatus.forbidden ||
                      _coverageStatus == AddressStatus.unauthorized
                  ? null
                  : () => unawaited(_checkCoverage()),
            )
          else if (_coverage?.situation == CoverageSituation.attended)
            _notice(
              'Entrega disponível. Frete: ${_formatFreight(_coverage!.freight!)}',
            )
          else if (_coverage?.situation == CoverageSituation.outsideCoverage)
            _notice('Endereço fora da área de entrega.')
          else
            _notice(
              'Localização indisponível para este endereço. Confira em Meus endereços.',
            ),
        ],
      ],
    );
  }

  String _formatFreight(String decimal) {
    final parts = decimal.split('.');
    final whole = parts.first.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => '.',
    );
    return 'R\$ $whole,${parts[1]}';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Forma de recebimento')),
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppTokens.spacing16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Como você quer receber?',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: AppTokens.spacing16),
                RadioGroup<FulfillmentMode>(
                  groupValue: _mode,
                  onChanged: (mode) {
                    if (mode != null) _selectMode(mode);
                  },
                  child: Column(
                    children: [
                      RadioListTile<FulfillmentMode>(
                        title: const Text('Delivery'),
                        value: FulfillmentMode.delivery,
                      ),
                      RadioListTile<FulfillmentMode>(
                        title: const Text('Retirada'),
                        value: FulfillmentMode.pickup,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppTokens.spacing16),
                if (_mode == FulfillmentMode.pickup)
                  _notice('Retirada selecionada. Frete: R\$ 0,00'),
                if (_mode == FulfillmentMode.delivery) _delivery(),
                const SizedBox(height: AppTokens.spacing24),
                const FilledButton(onPressed: null, child: Text('Continuar')),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
