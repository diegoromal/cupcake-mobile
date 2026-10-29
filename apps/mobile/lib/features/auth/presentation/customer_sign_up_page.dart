import 'package:flutter/material.dart';

import '../../../app/navigation/app_navigation.dart';
import '../../../core/design/app_tokens.dart';
import '../data/customer_registration_api.dart';
import 'customer_sign_up_validation.dart';

class CustomerSignUpPage extends StatefulWidget {
  const CustomerSignUpPage({super.key, this.registrationApi});

  final CustomerRegistrationApi? registrationApi;

  @override
  State<CustomerSignUpPage> createState() => _CustomerSignUpPageState();
}

class _CustomerSignUpPageState extends State<CustomerSignUpPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _errorSummaryFocus = FocusNode();
  final _errorSummaryKey = GlobalKey();
  final _visited = <String>{};
  final _serverErrors = <String, String>{};
  late final CustomerRegistrationApi _api =
      widget.registrationApi ?? CustomerRegistrationApi();
  bool _obscurePassword = true;
  bool _submitting = false;
  bool _attemptedSubmit = false;
  String? _statusMessage;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _errorSummaryFocus.dispose();
    super.dispose();
  }

  void _changed(String field) {
    _visited.add(field);
    _serverErrors.remove(field);
    setState(() {});
  }

  String? _error(String field, String? local) =>
      _serverErrors[field] ??
      ((_visited.contains(field) || _attemptedSubmit) ? local : null);

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() => _attemptedSubmit = true);
    if (!_formKey.currentState!.validate()) {
      _showMessage('Confira os campos indicados.', alert: true);
      return;
    }

    setState(() {
      _submitting = true;
      _serverErrors.clear();
      _statusMessage = null;
    });
    FocusScope.of(context).unfocus();
    final result = await _api.register(
      nome: _name.text.trim(),
      email: CustomerSignUpValidation.normalizeEmail(_email.text)!,
      telefone: _phone.text.trim(),
      senha: _password.text,
    );
    if (!mounted) return;
    setState(() => _submitting = false);

    switch (result.status) {
      case RegistrationStatus.created:
        _password.clear();
        AppNavigation.completeSignUp(context);
      case RegistrationStatus.validation:
        setState(() {
          _serverErrors.addAll(result.fieldErrors);
          _attemptedSubmit = true;
        });
        _showMessage(
          result.fieldErrors.isEmpty
              ? 'Confira os dados informados e tente novamente.'
              : 'Confira os campos indicados.',
          alert: true,
        );
      case RegistrationStatus.conflict:
        setState(() => _serverErrors['email'] = 'E-mail já cadastrado.');
        _showMessage('E-mail já cadastrado.', alert: true);
      case RegistrationStatus.indeterminate:
        _showMessage(
          'Não foi possível confirmar se o cadastro foi concluído. Verifique sua conexão e, antes de tentar novamente, confirme se o e-mail já foi cadastrado.',
          alert: true,
        );
      case RegistrationStatus.serverResponseError:
        _showMessage(
          'O servidor respondeu, mas não foi possível confirmar o cadastro. Verifique o resultado antes de tentar novamente.',
          alert: true,
        );
      case RegistrationStatus.notSent:
        _showMessage(
          'Não foi possível iniciar o cadastro. Verifique a configuração de conexão do aplicativo.',
          alert: true,
        );
    }
  }

  void _showMessage(String message, {bool alert = false}) {
    setState(() => _statusMessage = message);
    if (alert) _formKey.currentState?.validate();
    if (alert) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _statusMessage != message) return;
        _errorSummaryFocus.requestFocus();
        final summaryContext = _errorSummaryKey.currentContext;
        if (summaryContext != null) Scrollable.ensureVisible(summaryContext);
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      backgroundColor: AppTokens.background,
      centerTitle: false,
      titleSpacing: AppTokens.spacing12,
      leading: IconButton(
        tooltip: 'Voltar para Entrar',
        onPressed: _submitting
            ? null
            : () => AppNavigation.returnToLogin(context),
        icon: const Icon(Icons.arrow_back),
      ),
      title: Semantics(
        header: true,
        child: Text(
          'Cupcake Mobile',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: AppTokens.primaryStrong,
            fontFamily: 'Georgia',
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    ),
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) => SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppTokens.spacing16,
            AppTokens.spacing8,
            AppTokens.spacing16,
            AppTokens.spacing24,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight:
                  (constraints.maxHeight -
                          AppTokens.spacing8 -
                          AppTokens.spacing24)
                      .clamp(0.0, double.infinity)
                      .toDouble(),
            ),
            child: Align(
              alignment: Alignment.topCenter,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Semantics(
                        header: true,
                        child: Text(
                          'Criar conta',
                          textAlign: TextAlign.start,
                          style: Theme.of(
                            context,
                          ).textTheme.headlineMedium?.copyWith(fontSize: 24),
                        ),
                      ),
                      const SizedBox(height: AppTokens.spacing8),
                      const Text(
                        'Crie sua conta para começar.',
                        textAlign: TextAlign.start,
                      ),
                      const SizedBox(height: AppTokens.spacing24),
                      Card(
                        margin: EdgeInsets.zero,
                        color: AppTokens.surface,
                        surfaceTintColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            AppTokens.radius12,
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(AppTokens.spacing16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Semantics(
                                      header: true,
                                      child: Text(
                                        'Dados de Acesso',
                                        style: Theme.of(
                                          context,
                                        ).textTheme.titleSmall,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: AppTokens.spacing12),
                                  Flexible(
                                    child: Text(
                                      '* Campos obrigatórios',
                                      textAlign: TextAlign.end,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppTokens.spacing16),
                              _field(
                                field: 'nome',
                                controller: _name,
                                label: 'Nome *',
                                textInputAction: TextInputAction.next,
                                validator: (value) => _error(
                                  'nome',
                                  CustomerSignUpValidation.validateName(
                                    value ?? '',
                                  ),
                                ),
                              ),
                              _field(
                                field: 'email',
                                controller: _email,
                                label: 'E-mail *',
                                keyboardType: TextInputType.emailAddress,
                                textInputAction: TextInputAction.next,
                                autocorrect: false,
                                validator: (value) => _error(
                                  'email',
                                  CustomerSignUpValidation.validateEmail(
                                    value ?? '',
                                  ),
                                ),
                              ),
                              _field(
                                field: 'telefone',
                                controller: _phone,
                                label: 'Telefone *',
                                keyboardType: TextInputType.phone,
                                textInputAction: TextInputAction.next,
                                validator: (value) => _error(
                                  'telefone',
                                  CustomerSignUpValidation.validatePhone(
                                    value ?? '',
                                  ),
                                ),
                              ),
                              _field(
                                field: 'senha',
                                controller: _password,
                                label: 'Senha *',
                                obscureText: _obscurePassword,
                                autocorrect: false,
                                enableSuggestions: false,
                                textInputAction: TextInputAction.done,
                                onFieldSubmitted: (_) => _submit(),
                                validator: (value) => _error(
                                  'senha',
                                  CustomerSignUpValidation.validatePassword(
                                    value ?? '',
                                  ),
                                ),
                                suffixIcon: IconButton(
                                  tooltip: _obscurePassword
                                      ? 'Mostrar senha'
                                      : 'Ocultar senha',
                                  onPressed: _submitting
                                      ? null
                                      : () => setState(
                                          () => _obscurePassword =
                                              !_obscurePassword,
                                        ),
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility
                                        : Icons.visibility_off,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: AppTokens.spacing16),
                      _statusMessage != null
                          ? Focus(
                              key: _errorSummaryKey,
                              focusNode: _errorSummaryFocus,
                              onFocusChange: (_) => setState(() {}),
                              child: Semantics(
                                liveRegion: true,
                                focusable: true,
                                focused: _errorSummaryFocus.hasFocus,
                                child: Padding(
                                  padding: const EdgeInsets.only(
                                    bottom: AppTokens.spacing16,
                                  ),
                                  child: Text(
                                    _statusMessage!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: AppTokens.danger,
                                    ),
                                  ),
                                ),
                              ),
                            )
                          : Semantics(
                              liveRegion: true,
                              child: _submitting
                                  ? const Padding(
                                      padding: EdgeInsets.all(
                                        AppTokens.spacing12,
                                      ),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          ),
                                          SizedBox(width: AppTokens.spacing12),
                                          Flexible(
                                            child: Text('Criando conta…'),
                                          ),
                                        ],
                                      ),
                                    )
                                  : const SizedBox.shrink(),
                            ),
                      FilledButton(
                        onPressed: _submitting ? null : _submit,
                        child: const Text('Criar conta'),
                      ),
                      const SizedBox(height: AppTokens.spacing12),
                      TextButton(
                        onPressed: _submitting
                            ? null
                            : () => AppNavigation.returnToLogin(context),
                        child: const Text('Entrar'),
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

  Widget _field({
    required String field,
    required TextEditingController controller,
    required String label,
    required String? Function(String?) validator,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    bool obscureText = false,
    bool autocorrect = true,
    bool enableSuggestions = true,
    Widget? suffixIcon,
    void Function(String)? onFieldSubmitted,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: AppTokens.spacing16),
    child: Semantics(
      isRequired: true,
      child: TextFormField(
        controller: controller,
        enabled: !_submitting,
        decoration: InputDecoration(
          labelText: label,
          errorMaxLines: 3,
          suffixIcon: suffixIcon,
        ),
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        obscureText: obscureText,
        autocorrect: autocorrect,
        enableSuggestions: enableSuggestions,
        validator: validator,
        onChanged: (_) => _changed(field),
        onFieldSubmitted: onFieldSubmitted,
      ),
    ),
  );
}
