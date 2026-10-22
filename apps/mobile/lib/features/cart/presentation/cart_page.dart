import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../../address/data/customer_address_api.dart';
import '../../catalog/data/customer_catalog_api.dart';
import '../../checkout/presentation/fulfillment_page.dart';
import '../data/customer_cart_api.dart';

class CartPage extends StatefulWidget {
  const CartPage({
    super.key,
    required this.session,
    required this.cartApi,
    required this.catalogApi,
    this.addressApi,
  });

  final CustomerSession session;
  final CustomerCartApi cartApi;
  final CustomerCatalogApi catalogApi;
  final CustomerAddressApi? addressApi;

  @override
  State<CartPage> createState() => _CartPageState();
}

const _maxQuantity = 2147483647;
const _missingItem = 'Item não encontrado.';
const _unavailableQuantity = 'Quantidade superior à disponibilidade.';
const _quantityFailure = 'Não foi possível atualizar a quantidade.';
const _removeFailure = 'Não foi possível remover o item.';

class _CartPageState extends State<CartPage> {
  int _generation = 0;
  CartRequestStatus? _status;
  CustomerCart? _cart;
  final Map<String, Future<Uint8List?>?> _images = {};
  bool _busy = false;
  String? _busyItemId;
  String? _busyLabel;
  String? _errorItemId;
  String? _errorText;
  String? _detachedMessage;

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
      _clearOperation();
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
      _clearOperation();
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

  void _clearOperation() {
    _busy = false;
    _busyItemId = null;
    _busyLabel = null;
    _errorItemId = null;
    _errorText = null;
    _detachedMessage = null;
  }

  bool get _controlsEnabled =>
      !_busy && _status == CartRequestStatus.success && _cart != null;

  bool get _canContinue =>
      _controlsEnabled &&
      _cart!.items.isNotEmpty &&
      _cart!.items.every((item) => item.available);

  void _openFulfillment() {
    if (!_canContinue) return;
    Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        builder: (_) => FulfillmentPage(
          session: widget.session,
          addressApi: widget.addressApi,
        ),
      ),
    );
  }

  Future<void> _changeQuantity(CartItem item, int quantity) {
    if (quantity < 1 || quantity > _maxQuantity) return Future<void>.value();
    return _mutate(item: item, removing: false, quantity: quantity);
  }

  Future<void> _mutate({
    required CartItem item,
    required bool removing,
    int? quantity,
  }) async {
    if (_busy) return;
    final generation = _generation;
    setState(() {
      _busy = true;
      _busyItemId = item.id;
      _busyLabel = removing ? 'Removendo item…' : 'Atualizando quantidade…';
      _errorItemId = null;
      _errorText = null;
      _detachedMessage = null;
    });
    final result = await _authorized(
      generation,
      (token) => removing
          ? widget.cartApi.removeItem(accessToken: token, itemId: item.id)
          : widget.cartApi.updateQuantity(
              accessToken: token,
              itemId: item.id,
              quantity: quantity ?? item.quantity,
            ),
    );
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    if (result.status == CartRequestStatus.forbidden) {
      setState(() {
        _clearOperation();
        _status = CartRequestStatus.forbidden;
        _cart = null;
        _images.clear();
      });
      return;
    }
    if (result.status == CartRequestStatus.notFound) {
      setState(() {
        _busyLabel = null;
        _errorItemId = item.id;
        _errorText = _missingItem;
      });
      await _syncAfterNotFound(generation, item.id);
      return;
    }
    if (result.status == CartRequestStatus.success) {
      if (removing) {
        await _syncAfterDelete(generation);
        return;
      }
      setState(() {
        _clearOperation();
        if (result.cart != null) {
          _replaceCart(result.cart!, generation);
        } else {
          _errorItemId = item.id;
          _errorText = _quantityFailure;
        }
      });
      return;
    }
    setState(() {
      _clearOperation();
      _errorItemId = item.id;
      _errorText = result.status == CartRequestStatus.conflict
          ? (result.message ?? _unavailableQuantity)
          : (removing ? _removeFailure : _quantityFailure);
    });
  }

  Future<CartResult> _authorized(
    int generation,
    Future<CartResult> Function(String token) send,
  ) async {
    await widget.session.refreshIfNeeded();
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return const CartResult(CartRequestStatus.unauthorized);
    }
    final token = widget.session.accessToken;
    if (token == null) return const CartResult(CartRequestStatus.unauthorized);
    final result = await send(token);
    if (result.status != CartRequestStatus.unauthorized ||
        !mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return result;
    }
    final refreshed = await widget.session.refreshAfterUnauthorized(token);
    if (refreshed == null ||
        !mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return result;
    }
    return send(refreshed);
  }

  Future<void> _syncAfterNotFound(int generation, String itemId) async {
    await widget.session.refreshIfNeeded();
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
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
      if (token != null &&
          mounted &&
          generation == _generation &&
          widget.session.isAuthenticated) {
        result = await widget.cartApi.fetchCart(accessToken: token);
      }
    }
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    setState(() {
      _busy = false;
      _busyItemId = null;
      _busyLabel = null;
      if (result.status == CartRequestStatus.forbidden) {
        _status = CartRequestStatus.forbidden;
        _cart = null;
        _images.clear();
        _errorItemId = null;
        _errorText = null;
        _detachedMessage = null;
        return;
      }
      if (result.status == CartRequestStatus.success && result.cart != null) {
        final cart = result.cart!;
        _replaceCart(cart, generation);
        if (cart.items.every((line) => line.id != itemId)) {
          _detachedMessage = _missingItem;
          _errorItemId = null;
          _errorText = null;
        }
        return;
      }
      _errorItemId = itemId;
      _errorText = _missingItem;
    });
  }

  void _replaceCart(CustomerCart cart, int generation) {
    final images = <String, Future<Uint8List?>?>{};
    for (final line in cart.items) {
      if (_images.containsKey(line.id)) {
        images[line.id] = _images[line.id];
      } else {
        images[line.id] = line.imageAvailable
            ? _loadImage(line.productId, generation)
            : null;
      }
    }
    _images
      ..clear()
      ..addAll(images);
    _cart = cart;
    _status = CartRequestStatus.success;
  }

  Future<void> _syncAfterDelete(int generation) async {
    final result = await _readCart(generation);
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    setState(() {
      _clearOperation();
      if (result.status == CartRequestStatus.forbidden) {
        _status = CartRequestStatus.forbidden;
        _cart = null;
        _images.clear();
        return;
      }
      if (result.status == CartRequestStatus.success && result.cart != null) {
        _replaceCart(result.cart!, generation);
        return;
      }
      _status = CartRequestStatus.unavailable;
      _cart = null;
      _images.clear();
    });
  }

  Future<CartResult> _readCart(int generation) async {
    await widget.session.refreshIfNeeded();
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return const CartResult(CartRequestStatus.unauthorized);
    }
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
      if (token != null &&
          mounted &&
          generation == _generation &&
          widget.session.isAuthenticated) {
        result = await widget.cartApi.fetchCart(accessToken: token);
      }
    }
    return result;
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
    if (cart.items.isEmpty) return _EmptyCart(notice: _detachedMessage);
    return ListView(
      padding: const EdgeInsets.all(AppTokens.spacing16),
      children: [
        if (_detachedMessage != null) ...[
          Semantics(
            liveRegion: true,
            child: Text(
              _detachedMessage!,
              style: const TextStyle(color: AppTokens.danger),
            ),
          ),
          const SizedBox(height: AppTokens.spacing12),
        ],
        Semantics(
          header: true,
          child: Text(
            'ITENS SELECIONADOS (${cart.items.length})',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        const SizedBox(height: AppTokens.spacing16),
        for (final item in cart.items) ...[
          _CartLine(
            item: item,
            image: _images[item.id],
            busyLabel: _busyItemId == item.id ? _busyLabel : null,
            error: _errorItemId == item.id ? _errorText : null,
            onDecrease: _controlsEnabled && item.quantity > 1
                ? () => unawaited(_changeQuantity(item, item.quantity - 1))
                : null,
            onIncrease: _controlsEnabled && item.quantity < _maxQuantity
                ? () => unawaited(_changeQuantity(item, item.quantity + 1))
                : null,
            onRemove: _controlsEnabled
                ? () => unawaited(_mutate(item: item, removing: true))
                : null,
          ),
          const SizedBox(height: AppTokens.spacing12),
        ],
        Text('Subtotal: ${_formatPrice(cart.subtotal)}'),
        const SizedBox(height: AppTokens.spacing12),
        Text('Total: ${_formatPrice(cart.total)}'),
        const SizedBox(height: AppTokens.spacing16),
        _ContinueButton(onPressed: _canContinue ? _openFulfillment : null),
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
  const _EmptyCart({this.notice});
  final String? notice;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(AppTokens.spacing24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (notice != null) ...[
            Semantics(
              liveRegion: true,
              child: Text(
                notice!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppTokens.danger),
              ),
            ),
            const SizedBox(height: AppTokens.spacing16),
          ],
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
  const _ContinueButton({this.onPressed});
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => FilledButton(
    style: const ButtonStyle(
      minimumSize: WidgetStatePropertyAll(
        Size.fromHeight(AppTokens.touchTarget),
      ),
    ),
    onPressed: onPressed,
    child: const Text('Continuar', textAlign: TextAlign.center),
  );
}

class _CartLine extends StatelessWidget {
  const _CartLine({
    required this.item,
    required this.image,
    required this.busyLabel,
    required this.error,
    required this.onDecrease,
    required this.onIncrease,
    required this.onRemove,
  });
  final CartItem item;
  final Future<Uint8List?>? image;
  final String? busyLabel;
  final String? error;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;
  final VoidCallback? onRemove;

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
          if (item.unitPrice != null) ...[
            const SizedBox(height: AppTokens.spacing12),
            Text('Preço unitário: ${_formatPrice(item.unitPrice!)}'),
          ],
          if (item.subtotal != null) ...[
            const SizedBox(height: AppTokens.spacing12),
            Text('Subtotal do item: ${_formatPrice(item.subtotal!)}'),
          ],
          if (item.reason != null) ...[
            const SizedBox(height: AppTokens.spacing12),
            Text(item.reason!, style: const TextStyle(color: AppTokens.danger)),
          ],
          const SizedBox(height: AppTokens.spacing12),
          Wrap(
            spacing: AppTokens.spacing12,
            runSpacing: AppTokens.spacing12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _CartAction(
                label: 'Diminuir quantidade',
                icon: Icons.remove,
                onPressed: onDecrease,
              ),
              Semantics(
                label: 'Quantidade ${item.quantity}',
                child: ExcludeSemantics(child: Text('${item.quantity}')),
              ),
              _CartAction(
                label: 'Aumentar quantidade',
                icon: Icons.add,
                onPressed: onIncrease,
              ),
              _CartAction(
                label: 'Remover item',
                icon: Icons.delete_outline,
                onPressed: onRemove,
              ),
            ],
          ),
          if (busyLabel != null) ...[
            const SizedBox(height: AppTokens.spacing12),
            Semantics(liveRegion: true, child: Text(busyLabel!)),
          ],
          if (error != null) ...[
            const SizedBox(height: AppTokens.spacing12),
            Semantics(
              liveRegion: true,
              child: Text(
                error!,
                style: const TextStyle(color: AppTokens.danger),
              ),
            ),
          ],
        ],
      ),
    ),
  );
}

class _CartAction extends StatelessWidget {
  const _CartAction({
    required this.label,
    required this.icon,
    required this.onPressed,
  });
  final String label;
  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    enabled: onPressed != null,
    label: label,
    child: ExcludeSemantics(
      child: IconButton(
        onPressed: onPressed,
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

String _formatPrice(String decimal) {
  final parts = decimal.split('.');
  final whole = parts.first.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return 'R\$ $whole,${parts[1]}';
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
