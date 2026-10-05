import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../data/customer_registration_api.dart';
import '../session/customer_session.dart';
import 'customer_login_page.dart';

class CustomerSessionPage extends StatefulWidget {
  const CustomerSessionPage({
    super.key,
    required this.session,
    this.registrationApi,
  });

  final CustomerSession session;
  final CustomerRegistrationApi? registrationApi;

  @override
  State<CustomerSessionPage> createState() => _CustomerSessionPageState();
}

class _CustomerSessionPageState extends State<CustomerSessionPage>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.session.setForeground(
      WidgetsBinding.instance.lifecycleState != AppLifecycleState.paused &&
          WidgetsBinding.instance.lifecycleState !=
              AppLifecycleState.detached &&
          WidgetsBinding.instance.lifecycleState != AppLifecycleState.hidden,
    );
    unawaited(widget.session.restore());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.session.setForeground(false);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      widget.session.setForeground(true);
      unawaited(widget.session.refreshIfNeeded());
    } else {
      widget.session.setForeground(false);
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.session,
    builder: (context, _) => switch (widget.session.state) {
      CustomerSessionState.restoring => const _RestoringSessionPage(),
      CustomerSessionState.public => CustomerLoginPage(
        session: widget.session,
        registrationApi: widget.registrationApi,
      ),
      CustomerSessionState.authenticated => _AuthenticatedPage(
        session: widget.session,
      ),
      CustomerSessionState.restorationUnavailable => _SessionRecoveryPage(
        session: widget.session,
        message:
            'Não foi possível restaurar sua sessão. Verifique a conexão e tente novamente.',
      ),
      CustomerSessionState.signedOutStorageError => _SessionRecoveryPage(
        session: widget.session,
        message:
            'Não foi possível remover a sessão salva. Tente novamente antes de continuar.',
        retrySignOut: true,
      ),
    },
  );
}

class _RestoringSessionPage extends StatelessWidget {
  const _RestoringSessionPage();

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: Semantics(
          liveRegion: true,
          label: 'Restaurando sessão…',
          child: CircularProgressIndicator(),
        ),
      ),
    ),
  );
}

class _SessionRecoveryPage extends StatefulWidget {
  const _SessionRecoveryPage({
    required this.session,
    required this.message,
    this.retrySignOut = false,
  });

  final CustomerSession session;
  final String message;
  final bool retrySignOut;

  @override
  State<_SessionRecoveryPage> createState() => _SessionRecoveryPageState();
}

class _SessionRecoveryPageState extends State<_SessionRecoveryPage> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    await action();
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacing24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(
                  liveRegion: true,
                  child: Text(widget.message, textAlign: TextAlign.center),
                ),
                const SizedBox(height: AppTokens.spacing24),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () => _run(
                          widget.retrySignOut
                              ? widget.session.retrySignOut
                              : widget.session.retryRestoration,
                        ),
                  child: Text(
                    widget.retrySignOut
                        ? 'Tentar sair novamente'
                        : 'Tentar novamente',
                  ),
                ),
                if (!widget.retrySignOut) ...[
                  const SizedBox(height: AppTokens.spacing12),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() async {
                            await widget.session.signOut();
                          }),
                    child: const Text('Sair'),
                  ),
                ],
                if (_busy)
                  const Padding(
                    padding: EdgeInsets.all(AppTokens.spacing16),
                    child: Center(child: CircularProgressIndicator()),
                  ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _AuthenticatedPage extends StatefulWidget {
  const _AuthenticatedPage({required this.session});

  final CustomerSession session;

  @override
  State<_AuthenticatedPage> createState() => _AuthenticatedPageState();
}

class _AuthenticatedPageState extends State<_AuthenticatedPage> {
  bool _busy = false;

  Future<void> _retryRefresh() async {
    if (_busy) return;
    setState(() => _busy = true);
    await widget.session.retryRefresh();
    if (mounted && widget.session.isAuthenticated) {
      setState(() => _busy = false);
    }
  }

  Future<void> _signOut() async {
    if (_busy) return;
    setState(() => _busy = true);
    await widget.session.signOut();
    if (mounted && widget.session.isAuthenticated) {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Cupcake Mobile'),
      automaticallyImplyLeading: false,
      actions: [
        TextButton(
          onPressed: _busy ? null : _signOut,
          child: const Text('Sair'),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppTokens.spacing24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                header: true,
                child: Text(
                  'Sessão do cliente',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              const SizedBox(height: AppTokens.spacing12),
              const Text(
                'Você entrou na sua conta.',
                textAlign: TextAlign.center,
              ),
              if (widget.session.refreshUnavailable) ...[
                const SizedBox(height: AppTokens.spacing16),
                const Text('Não foi possível atualizar sua sessão agora.'),
                TextButton(
                  onPressed: _busy ? null : _retryRefresh,
                  child: const Text('Tentar novamente'),
                ),
              ],
              if (_busy) ...[
                const SizedBox(height: AppTokens.spacing16),
                Semantics(
                  liveRegion: true,
                  label: 'Encerrando sessão…',
                  child: CircularProgressIndicator(),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}
