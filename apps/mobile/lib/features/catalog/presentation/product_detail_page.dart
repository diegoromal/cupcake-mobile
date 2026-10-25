import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../../cart/data/customer_cart_api.dart';
import '../data/customer_catalog_api.dart';

class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.productId,
    required this.session,
    required this.api,
    this.cartApi,
    this.onOpenCart,
    this.indeterminateCartAttempts,
  });
  final String productId;
  final CustomerSession session;
  final CustomerCatalogApi api;
  final CustomerCartApi? cartApi;
  final VoidCallback? onOpenCart;
  final Set<String>? indeterminateCartAttempts;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  int _generation = 0;
  CatalogProductDetail? _product;
  CatalogRequestStatus? _status;
  Future<Uint8List?>? _image;
  MemoryImage? _imageProvider;
  final Set<String> _selected = {};
  int _priceGeneration = 0;
  String? _unitPrice;
  CatalogRequestStatus? _priceStatus;
  bool _priceLoading = false;
  late final CustomerCartApi _cartApi = widget.cartApi ?? CustomerCartApi();
  int _quantity = 1;
  bool _adding = false;
  CartRequestStatus? _addStatus;
  String? _addMessage;
  final _localIndeterminateAttempts = <String>{};
  Set<String> get _indeterminateAttempts =>
      widget.indeterminateCartAttempts ?? _localIndeterminateAttempts;
  String get _attemptKey {
    final ids = _selected.map((id) => id.toLowerCase()).toList()..sort();
    return jsonEncode([widget.productId.toLowerCase(), _quantity, ids]);
  }

  bool get _currentIndeterminate =>
      _indeterminateAttempts.contains(_attemptKey);

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_sessionChanged);
    _load();
  }

  @override
  void didUpdateWidget(covariant ProductDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.session != widget.session) {
      oldWidget.session.removeListener(_sessionChanged);
      widget.session.addListener(_sessionChanged);
    }
    if (oldWidget.productId != widget.productId ||
        oldWidget.session != widget.session ||
        oldWidget.api != widget.api) {
      _load();
    }
  }

  void _sessionChanged() {
    if (!widget.session.isAuthenticated) {
      _generation++;
      _priceGeneration++;
      if (mounted) {
        setState(() {
          _product = null;
          _image = null;
          _unitPrice = null;
          _adding = false;
        });
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || widget.session.isAuthenticated) return;
          final route = ModalRoute.of(context);
          if (route?.isCurrent ?? false) {
            unawaited(Navigator.of(context).maybePop());
          }
        });
      }
    }
  }

  @override
  void dispose() {
    _generation++;
    _priceGeneration++;
    widget.session.removeListener(_sessionChanged);
    final provider = _imageProvider;
    if (provider != null) unawaited(provider.evict());
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    _priceGeneration++;
    final id = widget.productId;
    final previous = _imageProvider;
    _imageProvider = null;
    if (previous != null) unawaited(previous.evict());
    setState(() {
      _product = null;
      _status = null;
      _image = null;
      _selected.clear();
      _unitPrice = null;
      _priceStatus = null;
      _priceLoading = false;
      _quantity = 1;
      _adding = false;
      _addStatus = null;
      _addMessage = null;
    });
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    CatalogDetailResult result = token == null
        ? const CatalogDetailResult(CatalogRequestStatus.unauthorized)
        : await widget.api.fetchDetail(productId: id, accessToken: token);
    if (result.status == CatalogRequestStatus.unauthorized &&
        token != null &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      result = token == null
          ? const CatalogDetailResult(CatalogRequestStatus.unauthorized)
          : await widget.api.fetchDetail(productId: id, accessToken: token);
    }
    if (!mounted ||
        generation != _generation ||
        id != widget.productId ||
        !widget.session.isAuthenticated) {
      return;
    }
    final product = result.product;
    setState(() {
      _status = result.status;
      _product = product;
      _unitPrice = product?.price;
      if (result.status == CatalogRequestStatus.success &&
          product != null &&
          product.imageAvailable) {
        _image = _loadImage(id, generation);
      }
    });
  }

  void _toggle(CatalogPersonalization option) {
    if (!option.available || _adding) return;
    setState(() {
      if (!_selected.add(option.id)) _selected.remove(option.id);
      _unitPrice = null;
      _priceStatus = null;
      _priceLoading = true;
      _addStatus = null;
      _addMessage = null;
    });
    unawaited(_preview());
  }

  void _changeQuantity(int quantity) {
    if (_adding || quantity < 1 || quantity > 2147483647) return;
    setState(() {
      _quantity = quantity;
      _addStatus = null;
      _addMessage = null;
    });
  }

  Future<void> _addToCart() async {
    if (_currentIndeterminate ||
        _adding ||
        _priceLoading ||
        _unitPrice == null ||
        _product == null ||
        !widget.session.isAuthenticated) {
      return;
    }
    final generation = _generation;
    final attemptKey = _attemptKey;
    final selectedIds = _selected.toList()..sort();
    setState(() {
      _adding = true;
      _addStatus = null;
      _addMessage = null;
    });
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    CartResult result = token == null
        ? const CartResult(CartRequestStatus.unauthorized)
        : await _cartApi.addItem(
            accessToken: token,
            productId: widget.productId,
            quantity: _quantity,
            personalizationIds: selectedIds,
          );
    if (result.status == CartRequestStatus.unauthorized &&
        token != null &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      result = token == null
          ? const CartResult(CartRequestStatus.unauthorized)
          : await _cartApi.addItem(
              accessToken: token,
              productId: widget.productId,
              quantity: _quantity,
              personalizationIds: selectedIds,
            );
    }
    if (!mounted ||
        generation != _generation ||
        !widget.session.isAuthenticated) {
      return;
    }
    setState(() {
      _adding = false;
      _addStatus = result.status;
      _addMessage = result.message;
      if (result.status == CartRequestStatus.unavailable) {
        _indeterminateAttempts.add(attemptKey);
      }
    });
  }

  Future<void> _preview() async {
    final generation = ++_priceGeneration;
    final id = widget.productId;
    final selectedIds = _selected.toList()..sort();
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    CatalogPriceResult result = token == null
        ? const CatalogPriceResult(CatalogRequestStatus.unauthorized)
        : await widget.api.previewPrice(
            productId: id,
            accessToken: token,
            personalizationIds: selectedIds,
          );
    if (result.status == CatalogRequestStatus.unauthorized &&
        token != null &&
        mounted &&
        generation == _priceGeneration &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      result = token == null
          ? const CatalogPriceResult(CatalogRequestStatus.unauthorized)
          : await widget.api.previewPrice(
              productId: id,
              accessToken: token,
              personalizationIds: selectedIds,
            );
    }
    if (!mounted ||
        generation != _priceGeneration ||
        id != widget.productId ||
        !widget.session.isAuthenticated) {
      return;
    }
    if (result.status == CatalogRequestStatus.invalidSelection ||
        result.status == CatalogRequestStatus.notFound) {
      // The catalog may have changed since detail loaded. Drop the old selection.
      unawaited(_load());
      return;
    }
    setState(() {
      _priceLoading = false;
      _priceStatus = result.status;
      _unitPrice = result.status == CatalogRequestStatus.success
          ? result.unitPrice
          : null;
    });
  }

  Future<Uint8List?> _loadImage(String id, int generation) async {
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) return null;
    var result = await widget.api.fetchImage(productId: id, accessToken: token);
    if (result.status == CatalogRequestStatus.unauthorized &&
        mounted &&
        generation == _generation &&
        widget.session.isAuthenticated) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token == null) return null;
      result = await widget.api.fetchImage(productId: id, accessToken: token);
    }
    if (!mounted ||
        generation != _generation ||
        id != widget.productId ||
        !widget.session.isAuthenticated ||
        result.status != CatalogRequestStatus.success) {
      return null;
    }
    return result.bytes;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Detalhes do cupcake')),
    body: SafeArea(child: _content(context)),
  );

  Widget _content(BuildContext context) {
    if (_status == null) {
      return Center(
        child: Semantics(
          label: 'Carregando produto…',
          liveRegion: true,
          child: const CircularProgressIndicator(),
        ),
      );
    }
    if (_status != CatalogRequestStatus.success || _product == null) {
      final unavailable = _status == CatalogRequestStatus.notFound;
      final forbidden = _status == CatalogRequestStatus.forbidden;
      final message = unavailable
          ? 'Produto indisponível'
          : forbidden
          ? 'Sua conta não tem acesso a este produto.'
          : 'Não foi possível carregar o produto. Tente novamente.';
      return Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppTokens.spacing24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                liveRegion: true,
                child: Text(message, textAlign: TextAlign.center),
              ),
              const SizedBox(height: AppTokens.spacing16),
              if (!unavailable)
                FilledButton(
                  onPressed: _load,
                  child: const Text('Tentar novamente'),
                ),
              if (unavailable)
                FilledButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Voltar à vitrine'),
                ),
            ],
          ),
        ),
      );
    }
    final product = _product!;
    return ListView(
      padding: const EdgeInsets.all(AppTokens.spacing16),
      children: [
        SizedBox(
          height: 240,
          child: product.imageAvailable
              ? FutureBuilder<Uint8List?>(
                  future: _image,
                  builder: (context, snapshot) {
                    final bytes = snapshot.data;
                    if (bytes == null) return const _ImageFallback();
                    final provider = _imageProvider ??= MemoryImage(bytes);
                    return Image(
                      image: provider,
                      fit: BoxFit.cover,
                      semanticLabel: 'Imagem de ${product.name}',
                      errorBuilder: (_, _, _) => const _ImageFallback(),
                    );
                  },
                )
              : const _ImageFallback(),
        ),
        const SizedBox(height: AppTokens.spacing24),
        Text(
          product.category.name,
          style: Theme.of(context).textTheme.labelLarge,
        ),
        const SizedBox(height: AppTokens.spacing12),
        Semantics(
          header: true,
          child: Text(
            product.name,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        const SizedBox(height: AppTokens.spacing12),
        const Text('Preço base'),
        Text(_formatPrice(product.price)),
        if (product.description != null && product.description!.isNotEmpty) ...[
          const SizedBox(height: AppTokens.spacing24),
          Text(
            product.description!,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
        const SizedBox(height: AppTokens.spacing16),
        Semantics(
          header: true,
          child: Text(
            'Personalizações',
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
        if (product.personalizations.isEmpty)
          const Text('Nenhuma personalização disponível para este produto.'),
        for (final option in product.personalizations)
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            value: _selected.contains(option.id),
            onChanged: option.available && !_adding
                ? (_) => _toggle(option)
                : null,
            title: Text(option.name),
            subtitle: Text(
              [
                if (option.description != null &&
                    option.description!.isNotEmpty)
                  option.description!,
                option.available
                    ? (_selected.contains(option.id)
                          ? 'Selecionada'
                          : 'Disponível')
                    : 'Indisponível',
                'Ajuste: ${option.adjustment == null ? 'sem ajuste' : _formatSignedPrice(option.adjustment!)}',
              ].join(' · '),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
        const SizedBox(height: AppTokens.spacing12),
        if (_priceLoading)
          Semantics(
            label: 'Calculando preço unitário…',
            liveRegion: true,
            child: LinearProgressIndicator(),
          ),
        if (!_priceLoading && _unitPrice != null)
          Semantics(
            liveRegion: true,
            child: Text(
              'Preço unitário: ${_formatPrice(_unitPrice!)}',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
        if (!_priceLoading &&
            _priceStatus != null &&
            _priceStatus != CatalogRequestStatus.success)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _priceStatus == CatalogRequestStatus.forbidden
                    ? 'Sua conta não tem acesso à prévia de preço.'
                    : _priceStatus == CatalogRequestStatus.negativePrice
                    ? 'Esta combinação resulta em preço negativo. Altere as personalizações.'
                    : 'Não foi possível calcular o preço. Tente novamente.',
              ),
              TextButton(
                onPressed: () {
                  setState(() {
                    _priceLoading = true;
                  });
                  unawaited(_preview());
                },
                child: const Text('Tentar novamente'),
              ),
            ],
          ),
        const SizedBox(height: AppTokens.spacing16),
        const Text('Disponível'),
        const SizedBox(height: AppTokens.spacing16),
        Text('Quantidade', style: Theme.of(context).textTheme.titleMedium),
        Row(
          children: [
            IconButton(
              tooltip: 'Diminuir quantidade',
              onPressed: _adding || _quantity == 1
                  ? null
                  : () => _changeQuantity(_quantity - 1),
              icon: const Icon(Icons.remove),
            ),
            Semantics(
              label: 'Quantidade selecionada: $_quantity',
              liveRegion: true,
              child: Text('$_quantity'),
            ),
            IconButton(
              tooltip: 'Aumentar quantidade',
              onPressed: _adding || _quantity == 2147483647
                  ? null
                  : () => _changeQuantity(_quantity + 1),
              icon: const Icon(Icons.add),
            ),
          ],
        ),
        if (!_priceLoading && _unitPrice != null)
          Semantics(
            liveRegion: true,
            child: Text(
              'Subtotal: ${_formatSubtotal(_unitPrice!, _quantity)}',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
        if ((_currentIndeterminate ? CartRequestStatus.unavailable : _addStatus)
            case final status?) ...[
          const SizedBox(height: 8),
          Semantics(
            liveRegion: true,
            child: Text(switch (status) {
              CartRequestStatus.success => 'Item adicionado ao carrinho.',
              CartRequestStatus.conflict =>
                _addMessage ??
                    'Produto ou quantidade indisponível. Confira sua escolha.',
              CartRequestStatus.notFound =>
                'Produto ou personalização indisponível. Confira sua escolha.',
              CartRequestStatus.unauthorized =>
                'Sessão expirada. Entre novamente.',
              CartRequestStatus.forbidden =>
                'Sua conta não pode adicionar itens ao carrinho.',
              CartRequestStatus.notConfigured =>
                'O carrinho não está configurado neste aplicativo.',
              CartRequestStatus.unavailable =>
                'Não foi possível confirmar a inclusão. O item pode ter sido criado. Confira o carrinho antes de tentar novamente.',
            }),
          ),
          if (status == CartRequestStatus.conflict ||
              status == CartRequestStatus.notFound)
            OutlinedButton(
              onPressed: _load,
              child: const Text('Atualizar produto'),
            ),
          if (status == CartRequestStatus.unavailable &&
              widget.onOpenCart != null)
            OutlinedButton(
              onPressed: widget.onOpenCart,
              child: const Text('Abrir carrinho'),
            ),
        ],
        const SizedBox(height: AppTokens.spacing16),
        FilledButton(
          onPressed:
              _adding ||
                  _currentIndeterminate ||
                  _priceLoading ||
                  _unitPrice == null ||
                  _addStatus == CartRequestStatus.unauthorized ||
                  _addStatus == CartRequestStatus.forbidden
              ? null
              : () => unawaited(_addToCart()),
          child: Text(_adding ? 'Adicionando…' : 'Adicionar ao carrinho'),
        ),
        if (_adding)
          Semantics(liveRegion: true, child: LinearProgressIndicator()),
      ],
    );
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Imagem do produto indisponível',
    child: ColoredBox(
      color: AppTokens.surfaceSoft,
      child: const Center(child: Icon(Icons.cake_outlined, size: 48)),
    ),
  );
}

String _formatPrice(String decimal) {
  final parts = decimal.split('.');
  final whole = parts.first.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => '.',
  );
  return 'R\$ $whole,${parts[1]}';
}

String _formatSubtotal(String unitPrice, int quantity) {
  final parts = unitPrice.split('.');
  final cents =
      (BigInt.parse(parts[0]) * BigInt.from(100) + BigInt.parse(parts[1])) *
      BigInt.from(quantity);
  final decimal =
      '${cents ~/ BigInt.from(100)}.${(cents % BigInt.from(100)).toString().padLeft(2, '0')}';
  return _formatPrice(decimal);
}

String _formatSignedPrice(String decimal) => decimal.startsWith('-')
    ? '-${_formatPrice(decimal.substring(1))}'
    : '+${_formatPrice(decimal)}';
