import 'package:flutter/material.dart';

import '../../../app/navigation/app_navigation.dart';
import '../../../core/design/app_tokens.dart';
import '../data/customer_registration_api.dart';
import '../session/customer_session.dart';
import 'customer_sign_up_validation.dart';

class CustomerLoginPage extends StatefulWidget {
  const CustomerLoginPage({
    super.key,
    required this.session,
    this.registrationApi,
  });

  final CustomerSession session;
  final CustomerRegistrationApi? registrationApi;

  @override
  State<CustomerLoginPage> createState() => _CustomerLoginPageState();
}

class _CustomerLoginPageState extends State<CustomerLoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _summaryFocus = FocusNode();
  bool _loading = false;
  bool _obscure = true;
  bool _emailTouched = false;
  bool _passwordTouched = false;
  String? _message;

  bool get _formValid =>
      CustomerSignUpValidation.normalizeEmail(_email.text) != null &&
      _password.text.isNotEmpty;

  String? get _emailError {
    if (!_emailTouched) return null;
    if (_email.text.trim().isEmpty) return 'Informe seu e-mail.';
    return CustomerSignUpValidation.normalizeEmail(_email.text) == null
        ? 'Informe um e-mail válido.'
        : null;
  }

  String? get _passwordError =>
      _passwordTouched && _password.text.isEmpty ? 'Informe sua senha.' : null;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _summaryFocus.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading || !_formValid) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    FocusScope.of(context).unfocus();
    final outcome = await widget.session.signIn(
      email: _email.text,
      password: _password.text,
    );
    if (!mounted) return;
    setState(() => _loading = false);
    switch (outcome) {
      case SignInOutcome.authenticated:
        _password.clear();
      case SignInOutcome.invalidCredentials:
        _showError('As credenciais informadas não foram aceitas.');
      case SignInOutcome.invalidRequest:
        _showError('Confira o e-mail e a senha informados.');
      case SignInOutcome.unavailable:
        _showError('Não foi possível concluir o login. Tente novamente.');
      case SignInOutcome.notConfigured:
        _showError(
          'Não foi possível conectar. Verifique a configuração do aplicativo.',
        );
      case SignInOutcome.storageFailure:
        _showError(
          'Não foi possível guardar a sessão com segurança. Tente novamente.',
        );
      case SignInOutcome.stale:
        break;
    }
  }

  void _showError(String message) {
    setState(() => _message = message);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _message != message) return;
      _summaryFocus.requestFocus();
      final context = _summaryFocus.context;
      if (context != null) Scrollable.ensureVisible(context);
    });
  }

  void _changed() {
    setState(() {
      _message = null;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacing24),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: (constraints.maxHeight - AppTokens.spacing24 * 2)
                  .clamp(0.0, double.infinity)
                  .toDouble(),
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Form(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Semantics(
                        header: true,
                        child: Text(
                          'Cupcake Mobile',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      const SizedBox(height: AppTokens.spacing32),
                      Semantics(
                        header: true,
                        child: Text(
                          'Entrar',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                      ),
                      const SizedBox(height: AppTokens.spacing12),
                      const Text(
                        'Acesse sua conta para continuar.',
                        textAlign: TextAlign.center,
                      ),
                      if (widget.session.sessionExpired) ...[
                        const SizedBox(height: AppTokens.spacing16),
                        Semantics(
                          liveRegion: true,
                          child: const Text(
                            'Sua sessão foi encerrada. Entre novamente para continuar.',
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppTokens.spacing32),
                      TextFormField(
                        controller: _email,
                        enabled: !_loading,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        decoration: InputDecoration(
                          labelText: 'E-mail',
                          errorText: _emailError,
                        ),
                        onChanged: (_) {
                          _emailTouched = true;
                          _changed();
                        },
                      ),
                      const SizedBox(height: AppTokens.spacing16),
                      TextFormField(
                        controller: _password,
                        enabled: !_loading,
                        obscureText: _obscure,
                        autocorrect: false,
                        enableSuggestions: false,
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          labelText: 'Senha',
                          errorText: _passwordError,
                          suffixIcon: IconButton(
                            tooltip: _obscure
                                ? 'Mostrar senha'
                                : 'Ocultar senha',
                            onPressed: _loading
                                ? null
                                : () => setState(() => _obscure = !_obscure),
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility
                                  : Icons.visibility_off,
                            ),
                          ),
                        ),
                        onChanged: (_) {
                          _passwordTouched = true;
                          _changed();
                        },
                      ),
                      const SizedBox(height: AppTokens.spacing16),
                      if (_message case final message?)
                        Focus(
                          focusNode: _summaryFocus,
                          child: Semantics(
                            liveRegion: true,
                            focusable: true,
                            child: Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppTokens.spacing16,
                              ),
                              child: Text(
                                message,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: AppTokens.danger),
                              ),
                            ),
                          ),
                        )
                      else if (_loading)
                        Semantics(
                          liveRegion: true,
                          label: 'Entrando…',
                          child: Padding(
                            padding: EdgeInsets.all(AppTokens.spacing12),
                            child: Center(child: CircularProgressIndicator()),
                          ),
                        ),
                      FilledButton(
                        onPressed: _loading || !_formValid ? null : _submit,
                        child: const Text('Entrar'),
                      ),
                      const SizedBox(height: AppTokens.spacing12),
                      TextButton(
                        onPressed: _loading
                            ? null
                            : () => AppNavigation.openCustomerSignUp(
                                context,
                                registrationApi: widget.registrationApi,
                              ),
                        child: const Text('Criar conta'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
