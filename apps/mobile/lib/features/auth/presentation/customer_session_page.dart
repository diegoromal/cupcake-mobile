import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../data/customer_auth_api.dart';
import '../data/customer_registration_api.dart';
import '../session/customer_session.dart';
import '../../catalog/data/customer_catalog_api.dart';
import '../../catalog/presentation/storefront_page.dart';
import 'customer_login_page.dart';
import '../../courier/presentation/courier_home_page.dart';
import '../../courier/data/courier_orders_api.dart';

class CustomerSessionPage extends StatefulWidget {
  const CustomerSessionPage({
    super.key,
    required this.session,
    this.registrationApi,
    this.catalogApi,
    this.courierOrdersApi,
  });

  final CustomerSession session;
  final CustomerRegistrationApi? registrationApi;
  final CustomerCatalogApi? catalogApi;
  final CourierOrdersApi? courierOrdersApi;

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
      CustomerSessionState.authenticated =>
        widget.session.profile == SessionProfile.courier
            ? CourierHomePage(
                session: widget.session,
                api: widget.courierOrdersApi,
              )
            : StorefrontPage(
                session: widget.session,
                api: widget.catalogApi ?? CustomerCatalogApi(),
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
