import 'dart:async';

import 'package:flutter/material.dart';

import '../../auth/session/customer_session.dart';
import '../data/customer_address_api.dart';

class CustomerAddressPage extends StatefulWidget {
  const CustomerAddressPage({super.key, required this.session, this.api});
  final CustomerSession session;
  final CustomerAddressApi? api;
  @override
  State<CustomerAddressPage> createState() => _CustomerAddressPageState();
}

class _CustomerAddressPageState extends State<CustomerAddressPage> {
  late final CustomerAddressApi _api = widget.api ?? CustomerAddressApi();
  final _form = GlobalKey<FormState>();
  final _messageFocus = FocusNode();
  final _cep = TextEditingController(),
      _street = TextEditingController(),
      _number = TextEditingController(),
      _neighborhood = TextEditingController(),
      _city = TextEditingController(),
      _complement = TextEditingController(),
      _reference = TextEditingController();
  List<CustomerAddress> _addresses = [];
  bool _loading = true, _busy = false, _cepBusy = false;
  String? _message;
  int _generation = 0;

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
    _messageFocus.dispose();
    for (final c in [
      _cep,
      _street,
      _number,
      _neighborhood,
      _city,
      _complement,
      _reference,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _sessionChanged() {
    if (widget.session.isAuthenticated) return;
    _generation++;
    if (mounted) Navigator.of(context).maybePop();
  }

  Future<AddressResult<T>> _request<T>(
    Future<AddressResult<T>> Function(String) action,
  ) async {
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) return AddressResult<T>(AddressStatus.unauthorized);
    var result = await action(token);
    if (result.status == AddressStatus.unauthorized &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token != null) result = await action(token);
    }
    return result;
  }

  Future<void> _load({String? successMessage, String? failureMessage}) async {
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _message = null;
    });
    final result = await _request(_api.list);
    if (!mounted || generation != _generation) return;
    setState(() {
      _loading = false;
      if (result.status == AddressStatus.success) {
        _addresses = result.value ?? [];
        _message = successMessage;
      } else {
        _message = failureMessage == null
            ? _failure(result.status)
            : '$failureMessage ${_failure(result.status)}';
      }
    });
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Campo obrigatório.' : null;
  String? _validCep(String? value) =>
      RegExp(r'^\d{5}-?\d{3}$').hasMatch(value?.trim() ?? '')
      ? null
      : 'Informe um CEP com oito dígitos.';

  void _focusMessage() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && _message != null) _messageFocus.requestFocus();
    });
  }

  Future<void> _lookupCep() async {
    if (_cepBusy || _busy) return;
    final cep = _cep.text.trim();
    if (_validCep(cep) != null) {
      setState(() => _message = 'Informe um CEP com oito dígitos.');
      _focusMessage();
      return;
    }
    final normalizedCep = cep.replaceAll('-', '');
    setState(() {
      _cepBusy = true;
      _message = null;
    });
    final result = await _request(
      (token) => _api.lookupCep(token, normalizedCep),
    );
    if (!mounted) return;
    setState(() {
      _cepBusy = false;
      if (_cep.text.trim().replaceAll('-', '') != normalizedCep) return;
      if (result.status == AddressStatus.success && result.value != null) {
        final found = result.value!;
        if (found.street.isNotEmpty) _street.text = found.street;
        if (found.neighborhood.isNotEmpty) {
          _neighborhood.text = found.neighborhood;
        }
        if (found.city.isNotEmpty) _city.text = found.city;
        _message = 'CEP consultado. Confira e complete o endereço.';
      } else {
        _message = result.status == AddressStatus.notFound
            ? 'CEP não encontrado. Preencha o endereço manualmente.'
            : _failure(result.status);
      }
    });
  }

  Future<void> _save() async {
    if (_busy || _cepBusy) return;
    if (!_form.currentState!.validate()) {
      setState(() => _message = 'Corrija os campos indicados.');
      _focusMessage();
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    final body = <String, Object?>{
      'rua': _street.text.trim(),
      'numero': _number.text.trim(),
      'bairro': _neighborhood.text.trim(),
      'cidade': _city.text.trim(),
      'cep': _cep.text.trim(),
      'complemento': _complement.text.trim().isEmpty
          ? null
          : _complement.text.trim(),
      'referencia': _reference.text.trim().isEmpty
          ? null
          : _reference.text.trim(),
    };
    final result = await _request((token) => _api.create(token, body));
    if (!mounted) return;
    if (result.status != AddressStatus.success) {
      setState(() {
        _busy = false;
        _message = _failure(result.status);
      });
    } else {
      for (final c in [
        _cep,
        _street,
        _number,
        _neighborhood,
        _city,
        _complement,
        _reference,
      ]) {
        c.clear();
      }
      await _load(
        successMessage: 'Endereço salvo. Localização pendente.',
        failureMessage:
            'Endereço salvo, mas a lista não foi atualizada. Use Atualizar lista para tentar novamente.',
      );
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _geocode(CustomerAddress address) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    final result = await _request((token) => _api.geocode(token, address.id));
    if (!mounted) return;
    if (result.status != AddressStatus.success) {
      setState(() {
        _busy = false;
        _message = _failure(result.status);
      });
    } else {
      await _load(
        successMessage: 'Localização pronta.',
        failureMessage:
            'Localização salva, mas a lista não foi atualizada. Use Atualizar lista para tentar novamente.',
      );
      if (mounted) setState(() => _busy = false);
    }
  }

  String _failure(AddressStatus status) => switch (status) {
    AddressStatus.invalid => 'Dados inválidos. Confira o endereço.',
    AddressStatus.notFound => 'Endereço não encontrado.',
    AddressStatus.ambiguous =>
      'Localização ambígua. Confira os dados e tente novamente.',
    AddressStatus.unauthorized => 'Sessão expirada. Entre novamente.',
    AddressStatus.forbidden => 'Sua conta não tem acesso a esta operação.',
    AddressStatus.indeterminate =>
      'Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.',
    _ => 'Serviço indisponível. Tente novamente mais tarde.',
  };

  Widget _field(
    String label,
    TextEditingController controller, {
    String? Function(String?)? validator,
    TextInputType? keyboard,
    int? maxLength,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: controller,
      enabled: !_busy,
      keyboardType: keyboard,
      validator: validator,
      maxLength: maxLength,
      decoration: InputDecoration(labelText: label, errorMaxLines: 2),
      textInputAction: TextInputAction.next,
    ),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Meus endereços')),
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_message != null)
                    Focus(
                      focusNode: _messageFocus,
                      child: Semantics(
                        liveRegion: true,
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(_message!),
                        ),
                      ),
                    ),
                  if (_loading)
                    const Center(child: CircularProgressIndicator())
                  else ...[
                    if (_addresses.isEmpty)
                      const Text('Nenhum endereço cadastrado.'),
                    for (final address in _addresses)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${address.street}, ${address.number}',
                                style: Theme.of(context).textTheme.titleMedium,
                              ),
                              Text(
                                '${address.neighborhood} · ${address.city} · ${address.cep}',
                              ),
                              Text(
                                address.located
                                    ? 'Localização pronta'
                                    : 'Localização pendente',
                              ),
                              if (!address.located)
                                TextButton(
                                  style: TextButton.styleFrom(
                                    minimumSize: const Size(48, 48),
                                  ),
                                  onPressed: _busy
                                      ? null
                                      : () => _geocode(address),
                                  child: const Text('Localizar endereço'),
                                ),
                            ],
                          ),
                        ),
                      ),
                    TextButton(
                      style: TextButton.styleFrom(
                        minimumSize: const Size(48, 48),
                      ),
                      onPressed: _busy ? null : _load,
                      child: const Text('Atualizar lista'),
                    ),
                  ],
                  const SizedBox(height: 16),
                  Text(
                    'Cadastrar endereço',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _field(
                          'CEP *',
                          _cep,
                          validator: _validCep,
                          keyboard: TextInputType.number,
                          maxLength: 9,
                        ),
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(48, 48),
                          ),
                          onPressed: _cepBusy || _busy ? null : _lookupCep,
                          child: Text(
                            _cepBusy ? 'Consultando CEP…' : 'Consultar CEP',
                          ),
                        ),
                        _field(
                          'Rua *',
                          _street,
                          validator: _required,
                          maxLength: 200,
                        ),
                        _field(
                          'Número *',
                          _number,
                          validator: _required,
                          maxLength: 30,
                        ),
                        _field(
                          'Bairro *',
                          _neighborhood,
                          validator: _required,
                          maxLength: 120,
                        ),
                        _field(
                          'Cidade *',
                          _city,
                          validator: _required,
                          maxLength: 120,
                        ),
                        _field('Complemento', _complement, maxLength: 200),
                        _field('Referência', _reference, maxLength: 200),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            minimumSize: const Size(48, 48),
                          ),
                          onPressed: _busy || _cepBusy ? null : _save,
                          child: Text(_busy ? 'Salvando…' : 'Salvar endereço'),
                        ),
                      ],
                    ),
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
