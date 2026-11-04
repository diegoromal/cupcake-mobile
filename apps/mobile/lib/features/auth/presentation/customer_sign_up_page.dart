import 'package:flutter/material.dart';

import '../../../app/navigation/app_navigation.dart';
import '../../../core/design/app_tokens.dart';
import '../data/customer_registration_api.dart';
import 'customer_sign_up_validation.dart';
import 'auth_brand_mark.dart';

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
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleSpacing: 0,
      leading: IconButton(
        tooltip: 'Voltar para Entrar',
        onPressed: _submitting
            ? null
            : () => AppNavigation.returnToLogin(context),
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
                'Criar Conta',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
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
                      const SizedBox(height: AppTokens.spacing4),
                      const Text(
                        'Preencha seus dados para criar sua conta e fazer pedidos no Cupcake Mobile.',
                        textAlign: TextAlign.start,
                      ),
                      const SizedBox(height: AppTokens.spacing16),
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
                                label: 'Nome completo *',
                                hint: 'Ex: Ana Carolina Silva',
                                compactHint: 'Seu nome',
                                prefixIcon: Icons.badge_outlined,
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
                                hint: 'exemplo@email.com',
                                compactHint: 'E-mail',
                                prefixIcon: Icons.mail_outline,
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
                                hint: '(11) 98765-4321',
                                compactHint: 'Telefone',
                                prefixIcon: Icons.phone_outlined,
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
                                hint: 'Digite sua senha',
                                compactHint: 'Senha',
                                prefixIcon: Icons.key_outlined,
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
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: Text(
                                'Criar conta',
                                textAlign: TextAlign.center,
                                softWrap: true,
                              ),
                            ),
                            const SizedBox(width: AppTokens.spacing4),
                            const ExcludeSemantics(
                              child: Icon(Icons.arrow_forward, size: 18),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppTokens.spacing8),
                      Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'Já tem uma conta?',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          TextButton(
                            style: TextButton.styleFrom(
                              minimumSize: const Size(44, 40),
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppTokens.spacing8,
                                vertical: AppTokens.spacing8,
                              ),
                              foregroundColor: AppTokens.primaryStrong,
                              textStyle: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(fontWeight: FontWeight.w600),
                            ),
                            onPressed: _submitting
                                ? null
                                : () => AppNavigation.returnToLogin(context),
                            child: const Text('Entrar'),
                          ),
                        ],
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
    required String hint,
    required String compactHint,
    required IconData prefixIcon,
    required String? Function(String?) validator,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    bool obscureText = false,
    bool autocorrect = true,
    bool enableSuggestions = true,
    Widget? suffixIcon,
    void Function(String)? onFieldSubmitted,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: AppTokens.spacing12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: AppTokens.spacing4),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppTokens.text,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Semantics(
          label: label,
          isRequired: true,
          child: TextFormField(
            controller: controller,
            enabled: !_submitting,
            decoration: InputDecoration(
              hintText:
                  MediaQuery.sizeOf(context).width < 360 &&
                      MediaQuery.textScalerOf(context).scale(1) > 1.3
                  ? compactHint
                  : hint,
              prefixIcon: Icon(prefixIcon, size: 18),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppTokens.spacing12,
                vertical: AppTokens.spacing8,
              ),
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
      ],
    ),
  );
}
