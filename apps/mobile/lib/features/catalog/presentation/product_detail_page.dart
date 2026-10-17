import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/customer_catalog_api.dart';

class ProductDetailPage extends StatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.productId,
    required this.session,
    required this.api,
  });
  final String productId;
  final CustomerSession session;
  final CustomerCatalogApi api;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  int _generation = 0;
  CatalogProductDetail? _product;
  CatalogRequestStatus? _status;
  Future<Uint8List?>? _image;
  MemoryImage? _imageProvider;

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
      if (mounted) {
        setState(() {
          _product = null;
          _image = null;
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
    widget.session.removeListener(_sessionChanged);
    final provider = _imageProvider;
    if (provider != null) unawaited(provider.evict());
    super.dispose();
  }

  Future<void> _load() async {
    final generation = ++_generation;
    final id = widget.productId;
    final previous = _imageProvider;
    _imageProvider = null;
    if (previous != null) unawaited(previous.evict());
    setState(() {
      _product = null;
      _status = null;
      _image = null;
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
      if (result.status == CatalogRequestStatus.success &&
          product != null &&
          product.imageAvailable) {
        _image = _loadImage(id, generation);
      }
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
        Text(
          _formatPrice(product.price),
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: AppTokens.spacing16),
        const Text('Disponível'),
        if (product.description != null && product.description!.isNotEmpty) ...[
          const SizedBox(height: AppTokens.spacing24),
          Text(
            product.description!,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
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
