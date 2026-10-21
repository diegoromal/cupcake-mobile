import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../../catalog/data/customer_catalog_api.dart';
import '../data/customer_cart_api.dart';

class CartPage extends StatefulWidget {
  const CartPage({
    super.key,
    required this.session,
    required this.cartApi,
    required this.catalogApi,
  });

  final CustomerSession session;
  final CustomerCartApi cartApi;
  final CustomerCatalogApi catalogApi;

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  int _generation = 0;
  CartRequestStatus? _status;
  CustomerCart? _cart;
  final Map<String, Future<Uint8List?>?> _images = {};

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_sessionChanged);
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant CartPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session != widget.session) {
      oldWidget.session.removeListener(_sessionChanged);
      widget.session.addListener(_sessionChanged);
    }
    if (oldWidget.session != widget.session ||
        oldWidget.cartApi != widget.cartApi ||
        oldWidget.catalogApi != widget.catalogApi) {
      unawaited(_load());
    }
  }

  void _sessionChanged() {
    if (widget.session.isAuthenticated) return;
    _generation++;
    _images.clear();
    if (!mounted) return;
    setState(() {
      _cart = null;
      _status = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.session.isAuthenticated) return;
      final route = ModalRoute.of(context);
      if (route?.isCurrent ?? false) {
        unawaited(Navigator.of(context).maybePop());
      }
    });
  }

  @override
  void dispose() {
    _generation++;
    widget.session.removeListener(_sessionChanged);
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    _images.clear();
    setState(() {
      _cart = null;
      _status = null;
    });
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    var result = token == null
        ? const CartResult(CartRequestStatus.unauthorized)
        : await widget.cartApi.fetchCart(accessToken: token);
    if (result.status == CartRequestStatus.unauthorized &&
        token != null &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      result = token == null
          ? const CartResult(CartRequestStatus.unauthorized)
          : await widget.cartApi.fetchCart(accessToken: token);
    }
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    final cart = result.cart;
    setState(() {
      _status = result.status == CartRequestStatus.success && cart != null
          ? CartRequestStatus.success
          : result.status;
      _cart = cart;
      if (_status == CartRequestStatus.success && cart != null) {
        for (final item in cart.items) {
          _images[item.id] = item.imageAvailable
              ? _loadImage(item.productId, generation)
              : null;
        }
      }
    });
  }

  Future<Uint8List?> _loadImage(String productId, int generation) async {
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) return null;
    var result = await widget.catalogApi.fetchImage(
      productId: productId,
      accessToken: token,
    );
    if (result.status == CatalogRequestStatus.unauthorized &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token == null) return null;
      result = await widget.catalogApi.fetchImage(
        productId: productId,
        accessToken: token,
      );
    }
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated ||
        result.status != CatalogRequestStatus.success) {
      return null;
    }
    return result.bytes;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Carrinho')),
    body: SafeArea(child: _content()),
  );

  Widget _content() {
    final cart = _cart;
    if (_status == null) return const _LoadingCart();
    if (_status == CartRequestStatus.forbidden) {
      return const _CartNotice(
        message: 'Sua conta não tem acesso ao carrinho.',
      );
    }
    if (_status != CartRequestStatus.success || cart == null) {
      return _CartNotice(
        message: 'Não foi possível carregar o carrinho. Tente novamente.',
        onRetry: _load,
      );
    }
    if (cart.items.isEmpty) return const _EmptyCart();
    return ListView(
      padding: const EdgeInsets.all(AppTokens.spacing16),
      children: [
        Semantics(
          header: true,
          child: Text(
            'ITENS SELECIONADOS (${cart.items.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: AppTokens.spacing16),
        for (final item in cart.items) ...[
          _CartLine(item: item, image: _images[item.id]),
          const SizedBox(height: AppTokens.spacing12),
        ],
        const _ContinueButton(),
      ],
    );
  }
}

class _LoadingCart extends StatelessWidget {
  const _LoadingCart();

  @override
  Widget build(BuildContext context) => Center(
    child: Semantics(
      label: 'Carregando carrinho…',
      liveRegion: true,
      child: const CircularProgressIndicator(),
    ),
  );
}

class _CartNotice extends StatelessWidget {
  const _CartNotice({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(AppTokens.spacing24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppTokens.danger),
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: AppTokens.spacing16),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(AppTokens.touchTarget),
              ),
              onPressed: onRetry,
              child: const Text(
                'Tentar novamente',
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(AppTokens.spacing24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(
              'Seu carrinho está vazio.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
          ),
          const SizedBox(height: AppTokens.spacing16),
          FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(AppTokens.touchTarget),
            ),
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'Continuar comprando',
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: AppTokens.spacing12),
          const _ContinueButton(),
        ],
      ),
    ),
  );
}

class _ContinueButton extends StatelessWidget {
  const _ContinueButton();

  @override
  Widget build(BuildContext context) => const FilledButton(
    style: ButtonStyle(
      minimumSize: WidgetStatePropertyAll(
        Size.fromHeight(AppTokens.touchTarget),
      ),
    ),
    onPressed: null,
    child: Text('Continuar', textAlign: TextAlign.center),
  );
}

class _CartLine extends StatelessWidget {
  const _CartLine({required this.item, required this.image});
  final CartItem item;
  final Future<Uint8List?>? image;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    semanticContainer: false,
    child: Padding(
      padding: const EdgeInsets.all(AppTokens.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 112,
            width: double.infinity,
            child: _CartImage(future: image, name: item.name),
          ),
          const SizedBox(height: AppTokens.spacing12),
          Text(item.name, style: Theme.of(context).textTheme.titleMedium),
          for (final option in item.personalizations) ...[
            const SizedBox(height: AppTokens.spacing12),
            Text(option.name, style: Theme.of(context).textTheme.bodyLarge),
          ],
          const SizedBox(height: AppTokens.spacing12),
          Wrap(
            spacing: AppTokens.spacing12,
            runSpacing: AppTokens.spacing12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const _DisabledCartAction(
                label: 'Diminuir quantidade',
                icon: Icons.remove,
              ),
              Semantics(
                label: 'Quantidade ${item.quantity}',
                child: ExcludeSemantics(child: Text('${item.quantity}')),
              ),
              const _DisabledCartAction(
                label: 'Aumentar quantidade',
                icon: Icons.add,
              ),
              const _DisabledCartAction(
                label: 'Remover item',
                icon: Icons.delete_outline,
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class _DisabledCartAction extends StatelessWidget {
  const _DisabledCartAction({required this.label, required this.icon});
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: false,
    label: label,
    child: ExcludeSemantics(
      child: IconButton(
        onPressed: null,
        constraints: const BoxConstraints(
          minWidth: AppTokens.touchTarget,
          minHeight: AppTokens.touchTarget,
        ),
        icon: Icon(icon),
      ),
    ),
  );
}

class _CartImage extends StatefulWidget {
  const _CartImage({required this.future, required this.name});
  final Future<Uint8List?>? future;
  final String name;

  @override
  State<_CartImage> createState() => _CartImageState();
}

class _CartImageState extends State<_CartImage> {
  MemoryImage? _provider;

  @override
  void didUpdateWidget(covariant _CartImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.future != widget.future) {
      final provider = _provider;
      _provider = null;
      if (provider != null) unawaited(provider.evict());
    }
  }

  @override
  void dispose() {
    final provider = _provider;
    if (provider != null) unawaited(provider.evict());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final future = widget.future;
    if (future == null) return const _ImageFallback();
    return FutureBuilder<Uint8List?>(
      future: future,
      builder: (context, snapshot) {
        final bytes = snapshot.data;
        if (bytes == null) return const _ImageFallback();
        final provider = _provider ??= MemoryImage(bytes);
        return Image(
          image: provider,
          fit: BoxFit.cover,
          semanticLabel: 'Imagem de ${widget.name}',
          errorBuilder: (_, _, _) => const _ImageFallback(),
        );
      },
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Imagem do produto indisponível',
    child: const ColoredBox(
      color: AppTokens.surfaceSoft,
      child: Center(child: Icon(Icons.cake_outlined, size: 48)),
    ),
  );
}
