import 'package:flutter/material.dart';

import '../../../app/navigation/app_navigation.dart';
import '../../../core/design/app_tokens.dart';
import '../data/customer_auth_api.dart';
import '../data/customer_registration_api.dart';
import '../session/customer_session.dart';
import 'customer_sign_up_validation.dart';
import 'auth_brand_mark.dart';
import 'courier_access_page.dart';

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
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isCustomer = widget.session.profile == SessionProfile.customer;
    final compactHints =
        MediaQuery.sizeOf(context).width < 360 &&
        MediaQuery.textScalerOf(context).scale(1) > 1.3;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTokens.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleSpacing: 0,
        leading: IconButton(
          tooltip: 'Voltar',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back),
        ),
        title: Semantics(
          header: true,
          child: Row(
            children: [
              const AuthBrandMark(),
              const SizedBox(width: AppTokens.spacing8),
              Flexible(
                child: Text(
                  'Cupcake Mobile',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: AppTokens.primaryStrong,
                    fontFamily: 'Georgia',
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppTokens.spacing16,
            AppTokens.spacing12,
            AppTokens.spacing16,
            AppTokens.spacing24,
          ),
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        'Entrar',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.headlineMedium?.copyWith(
                          fontSize: 22,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppTokens.spacing8),
                    Text(
                      widget.session.profile == SessionProfile.courier
                          ? 'Entre para acessar suas entregas.'
                          : 'Acesse sua conta para continuar e fazer pedidos no Cupcake Mobile.',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppTokens.textMuted,
                      ),
                    ),
                    const SizedBox(height: AppTokens.spacing16),
                    Card(
                      margin: EdgeInsets.zero,
                      color: AppTokens.surface,
                      surfaceTintColor: Colors.transparent,
                      elevation: 1,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTokens.radius12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(AppTokens.spacing16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _fieldLabel(context, 'E-mail'),
                            Semantics(
                              label: 'E-mail',
                              textField: true,
                              child: TextFormField(
                                controller: _email,
                                enabled: !_loading,
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autocorrect: false,
                                decoration: _fieldDecoration(
                                  hintText: compactHints
                                      ? 'E-mail'
                                      : 'exemplo@email.com',
                                  prefixIcon: Icons.mail_outline,
                                  errorText: _emailError,
                                ),
                                onChanged: (_) {
                                  _emailTouched = true;
                                  _changed();
                                },
                              ),
                            ),
                            const SizedBox(height: AppTokens.spacing12),
                            _fieldLabel(context, 'Senha'),
                            Semantics(
                              label: 'Senha',
                              textField: true,
                              child: TextFormField(
                                controller: _password,
                                enabled: !_loading,
                                obscureText: _obscure,
                                autocorrect: false,
                                enableSuggestions: false,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _submit(),
                                decoration: _fieldDecoration(
                                  hintText: compactHints
                                      ? 'Senha'
                                      : 'Digite sua senha',
                                  prefixIcon: Icons.key_outlined,
                                  errorText: _passwordError,
                                  suffixIcon: IconButton(
                                    tooltip: _obscure
                                        ? 'Mostrar senha'
                                        : 'Ocultar senha',
                                    onPressed: _loading
                                        ? null
                                        : () => setState(
                                            () => _obscure = !_obscure,
                                          ),
                                    icon: Icon(
                                      _obscure
                                          ? Icons.visibility_outlined
                                          : Icons.visibility_off_outlined,
                                    ),
                                  ),
                                ),
                                onChanged: (_) {
                                  _passwordTouched = true;
                                  _changed();
                                },
                              ),
                            ),
                            if (widget.session.sessionExpired) ...[
                              const SizedBox(height: AppTokens.spacing12),
                              Semantics(
                                liveRegion: true,
                                child: const Text(
                                  'Sua sessão foi encerrada. Entre novamente para continuar.',
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ],
                            if (_message case final message?) ...[
                              const SizedBox(height: AppTokens.spacing12),
                              Focus(
                                focusNode: _summaryFocus,
                                child: Semantics(
                                  liveRegion: true,
                                  focusable: true,
                                  child: Text(
                                    message,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: AppTokens.danger,
                                    ),
                                  ),
                                ),
                              ),
                            ] else if (_loading) ...[
                              const SizedBox(height: AppTokens.spacing12),
                              Semantics(
                                liveRegion: true,
                                label: 'Entrando…',
                                child: const Center(
                                  child: CircularProgressIndicator(),
                                ),
                              ),
                            ],
                            const SizedBox(height: AppTokens.spacing16),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                disabledBackgroundColor: AppTokens.disabled,
                                disabledForegroundColor: AppTokens.surface,
                              ),
                              onPressed: _loading || !_formValid
                                  ? null
                                  : _submit,
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Text('Entrar'),
                                  const SizedBox(width: AppTokens.spacing4),
                                  const ExcludeSemantics(
                                    child: Icon(Icons.arrow_forward, size: 18),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (isCustomer) ...[
                      const SizedBox(height: AppTokens.spacing16),
                      Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'Não tem uma conta?',
                            style: theme.textTheme.bodySmall,
                          ),
                          TextButton(
                            style: TextButton.styleFrom(
                              minimumSize: const Size(44, 40),
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppTokens.spacing8,
                                vertical: AppTokens.spacing8,
                              ),
                              foregroundColor: AppTokens.primaryStrong,
                              textStyle: theme.textTheme.bodySmall?.copyWith(
                                fontWeight: FontWeight.w600,
                                decoration: TextDecoration.underline,
                              ),
                            ),
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
                      Center(
                        child: TextButton(
                          style: TextButton.styleFrom(
                            minimumSize: const Size(44, 40),
                            foregroundColor: AppTokens.textMuted,
                            textStyle: theme.textTheme.bodySmall,
                          ),
                          onPressed: _loading
                              ? null
                              : () => Navigator.of(context).push<void>(
                                  MaterialPageRoute<void>(
                                    builder: (_) => const CourierAccessPage(),
                                  ),
                                ),
                          child: const Text('Acesso do entregador'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _fieldLabel(BuildContext context, String label) => Padding(
    padding: const EdgeInsets.only(bottom: AppTokens.spacing4),
    child: Text(
      label,
      style: Theme.of(context).textTheme.labelMedium?.copyWith(
        color: AppTokens.text,
        fontWeight: FontWeight.w600,
      ),
    ),
  );

  InputDecoration _fieldDecoration({
    required String hintText,
    required IconData prefixIcon,
    String? errorText,
    Widget? suffixIcon,
  }) => InputDecoration(
    hintText: hintText,
    errorText: errorText,
    prefixIcon: Icon(prefixIcon, size: 18),
    suffixIcon: suffixIcon,
    contentPadding: const EdgeInsets.symmetric(
      horizontal: AppTokens.spacing12,
      vertical: AppTokens.spacing8,
    ),
  );
}
