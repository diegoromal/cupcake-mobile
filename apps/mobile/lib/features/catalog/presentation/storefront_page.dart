import 'dart:async';
import 'dart:developer' as developer;
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../data/customer_catalog_api.dart';
import 'product_detail_page.dart';

class StorefrontPage extends StatefulWidget {
  const StorefrontPage({super.key, required this.session, required this.api});
  final CustomerSession session;
  final CustomerCatalogApi api;

  @override
  State<StorefrontPage> createState() => _StorefrontPageState();
}

class _StorefrontPageState extends State<StorefrontPage> {
  static const _measurePerformance = bool.fromEnvironment('D29_PERF');
  final _products = <CatalogProduct>[];
  final _seenIds = <String>{};
  List<CatalogCategory> _categories = const [];
  CatalogCategory? _selectedCategory;
  bool _categoriesLoading = true;
  String? _categoriesError;
  int _categoriesGeneration = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _signOutBusy = false;
  bool _hasMore = false;
  int _nextPage = 1;
  String? _error;
  int _requestGeneration = 0;
  Stopwatch? _firstPageWatch;

  @override
  void initState() {
    super.initState();
    _loadCategories();
    _load(reset: true);
  }

  Future<void> _loadCategories() async {
    final generation = ++_categoriesGeneration;
    setState(() {
      _categoriesLoading = true;
      _categoriesError = null;
    });
    CatalogCategoriesResult? result;
    final status = await _withAuthRetry((token) async {
      result = await widget.api.fetchCategories(accessToken: token);
      return result!.status;
    });
    if (!mounted ||
        generation != _categoriesGeneration ||
        !widget.session.isAuthenticated) {
      return;
    }
    setState(() {
      _categoriesLoading = false;
      if (status == CatalogRequestStatus.success &&
          result?.categories != null) {
        _categories = result!.categories!;
        // A seleção pode continuar após a categoria perder elegibilidade.
      } else {
        _categoriesError = status == CatalogRequestStatus.forbidden
            ? 'Sua conta não tem acesso às categorias.'
            : 'Não foi possível carregar as categorias.';
      }
    });
  }

  void _selectCategory(CatalogCategory? category) {
    if (_selectedCategory?.id == category?.id) return;
    setState(() => _selectedCategory = category);
    _load(reset: true);
  }

  Future<void> _refresh() async {
    await Future.wait([_loadCategories(), _load(reset: true)]);
  }

  Future<CatalogRequestStatus> _withAuthRetry(
    Future<CatalogRequestStatus> Function(String token) request,
  ) async {
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) return CatalogRequestStatus.unauthorized;
    var status = await request(token);
    if (status == CatalogRequestStatus.unauthorized) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token == null) return CatalogRequestStatus.unauthorized;
      status = await request(token);
    }
    return status;
  }

  Future<void> _load({required bool reset}) async {
    if (!widget.session.isAuthenticated || (!reset && _loadingMore)) return;
    final generation = ++_requestGeneration;
    final categoryId = _selectedCategory?.id;
    if (reset && _measurePerformance) {
      _firstPageWatch = Stopwatch()..start();
      developer.log('D29_PERF start generation=$generation', name: 'D29');
    }
    setState(() {
      if (reset) {
        _loading = true;
        _products.clear();
        _seenIds.clear();
        _nextPage = 1;
        _hasMore = false;
      } else {
        _loadingMore = true;
      }
      _error = null;
    });
    final pageNumber = reset ? 1 : _nextPage;
    CatalogPageResult? result;
    final status = await _withAuthRetry((token) async {
      result = await widget.api.fetchPage(
        accessToken: token,
        page: pageNumber,
        categoryId: categoryId,
      );
      return result!.status;
    });
    if (reset && _measurePerformance && generation == _requestGeneration) {
      developer.log(
        'D29_PERF page_result generation=$generation elapsed_ms=${_firstPageWatch?.elapsedMilliseconds} status=$status items=${result?.page?.items.length ?? 0} images_available=${result?.page?.items.where((item) => item.imageAvailable).length ?? 0}',
        name: 'D29',
      );
    }
    if (!mounted ||
        generation != _requestGeneration ||
        !widget.session.isAuthenticated) {
      return;
    }
    final loadedPage = result?.page;
    setState(() {
      _loading = false;
      _loadingMore = false;
      if (status == CatalogRequestStatus.success && loadedPage != null) {
        for (final product in loadedPage.items) {
          if (_seenIds.add(product.id)) _products.add(product);
        }
        _hasMore = loadedPage.hasMore;
        _nextPage = loadedPage.page + 1;
      } else {
        _error = switch (status) {
          CatalogRequestStatus.forbidden =>
            'Sua conta não tem acesso à vitrine.',
          CatalogRequestStatus.notConfigured =>
            'A vitrine não está configurada neste aplicativo.',
          _ =>
            _selectedCategory == null
                ? 'Não foi possível carregar os produtos. Tente novamente.'
                : 'Não foi possível carregar os produtos de ${_selectedCategory!.name}. Tente novamente.',
        };
      }
    });
    if (reset && _measurePerformance && _products.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || generation != _requestGeneration) return;
        developer.log(
          'D29_PERF first_useful_frame generation=$generation elapsed_ms=${_firstPageWatch?.elapsedMilliseconds} visible_data=product_name_price',
          name: 'D29',
        );
      });
    }
  }

  Future<Uint8List?> _loadImage(String productId) async {
    final watch = _firstPageWatch;
    final imageStart = watch?.elapsedMilliseconds;
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) return null;
    var image = await widget.api.fetchImage(
      productId: productId,
      accessToken: token,
    );
    if (image.status == CatalogRequestStatus.unauthorized) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token == null) return null;
      image = await widget.api.fetchImage(
        productId: productId,
        accessToken: token,
      );
    }
    final bytes =
        image.status == CatalogRequestStatus.success &&
            widget.session.isAuthenticated
        ? image.bytes
        : null;
    if (_measurePerformance && watch != null && imageStart != null) {
      developer.log(
        'D29_PERF image_bytes elapsed_ms=${watch.elapsedMilliseconds} duration_ms=${watch.elapsedMilliseconds - imageStart} bytes=${bytes?.length ?? 0} status=${image.status}',
        name: 'D29',
      );
    }
    return bytes;
  }

  Future<void> _signOut() async {
    if (_signOutBusy) return;
    setState(() => _signOutBusy = true);
    await widget.session.signOut();
    if (mounted && widget.session.isAuthenticated) {
      setState(() => _signOutBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Vitrine'),
      automaticallyImplyLeading: false,
      actions: [
        TextButton(
          onPressed: _loading ? null : _refresh,
          child: const Text('Atualizar'),
        ),
        TextButton(
          onPressed: _signOutBusy ? null : _signOut,
          child: const Text('Sair'),
        ),
      ],
    ),
    body: SafeArea(
      child: Column(
        children: [
          if (widget.session.refreshUnavailable)
            MaterialBanner(
              content: const Text(
                'Não foi possível atualizar sua sessão agora.',
              ),
              actions: [
                TextButton(
                  onPressed: widget.session.retryRefresh,
                  child: const Text('Tentar novamente'),
                ),
              ],
            ),
          _categorySelector(),
          Expanded(
            child: _loading
                ? _StatusState(
                    label: _selectedCategory == null
                        ? 'Carregando produtos…'
                        : 'Carregando produtos de ${_selectedCategory!.name}…',
                    loading: true,
                  )
                : _error != null && _products.isEmpty
                ? _StatusState(
                    label: _error!,
                    actionLabel: 'Tentar carregar novamente',
                    onAction: () => _load(reset: true),
                    error: true,
                  )
                : _products.isEmpty
                ? _StatusState(
                    label: _selectedCategory == null
                        ? 'Não há produtos disponíveis no momento.'
                        : 'Não há produtos disponíveis em ${_selectedCategory!.name}.',
                    actionLabel: 'Atualizar',
                    onAction: _refresh,
                  )
                : _productList(),
          ),
        ],
      ),
    ),
  );

  Widget _categorySelector() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (_categoriesLoading)
        const Padding(
          padding: EdgeInsets.all(AppTokens.spacing12),
          child: Text('Carregando categorias…'),
        ),
      if (_categoriesError != null)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppTokens.spacing16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_categoriesError!),
              TextButton(
                onPressed: _loadCategories,
                child: const Text('Tentar categorias novamente'),
              ),
            ],
          ),
        ),
      SizedBox(
        height: 56,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppTokens.spacing16),
          children: [
            _categoryChip(null, 'Todas'),
            for (final category in _categories)
              _categoryChip(category, category.name),
            if (_selectedCategory != null &&
                !_categories.any((c) => c.id == _selectedCategory!.id))
              _categoryChip(_selectedCategory, _selectedCategory!.name),
          ],
        ),
      ),
    ],
  );

  Widget _categoryChip(CatalogCategory? category, String label) => Padding(
    padding: const EdgeInsets.only(right: AppTokens.spacing12),
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
      child: ChoiceChip(
        label: Text(label),
        selected: _selectedCategory?.id == category?.id,
        onSelected: (_) => _selectCategory(category),
        showCheckmark: true,
        materialTapTargetSize: MaterialTapTargetSize.padded,
      ),
    ),
  );

  Widget _productList() {
    final entries = <_CatalogEntry>[];
    String? previousCategory;
    for (final product in _products) {
      if (product.category.id != previousCategory) {
        entries.add(_CatalogEntry.heading(product.category.name));
        previousCategory = product.category.id;
      }
      entries.add(_CatalogEntry.product(product));
    }
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(
          AppTokens.spacing16,
          AppTokens.spacing16,
          AppTokens.spacing16,
          AppTokens.spacing24,
        ),
        itemCount: entries.length + 1,
        itemBuilder: (context, index) {
          if (index == entries.length) {
            if (_error != null) {
              return _StatusState(
                label: _error!,
                actionLabel: 'Tentar carregar novamente',
                onAction: () => _load(reset: false),
                error: true,
              );
            }
            if (_loadingMore) {
              return const _StatusState(
                label: 'Carregando mais produtos…',
                loading: true,
              );
            }
            if (_hasMore) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spacing16),
                  child: OutlinedButton.icon(
                    onPressed: () => _load(reset: false),
                    icon: const Icon(Icons.expand_more),
                    label: const Text('Carregar mais produtos'),
                  ),
                ),
              );
            }
            return Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.all(AppTokens.spacing16),
                child: const Center(
                  child: Text('Fim dos produtos disponíveis.'),
                ),
              ),
            );
          }
          final entry = entries[index];
          if (entry.product == null) {
            return Padding(
              padding: const EdgeInsets.only(
                top: AppTokens.spacing16,
                bottom: AppTokens.spacing12,
              ),
              child: Semantics(
                header: true,
                child: Text(
                  entry.heading!,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
            );
          }
          return Padding(
            padding: const EdgeInsets.only(bottom: AppTokens.spacing12),
            child: _ProductCard(
              product: entry.product!,
              loadImage: _loadImage,
              onTap: () => Navigator.push<void>(
                context,
                MaterialPageRoute(
                  builder: (_) => ProductDetailPage(
                    productId: entry.product!.id,
                    session: widget.session,
                    api: widget.api,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _CatalogEntry {
  const _CatalogEntry.heading(this.heading) : product = null;
  const _CatalogEntry.product(this.product) : heading = null;
  final String? heading;
  final CatalogProduct? product;
}

class _ProductCard extends StatefulWidget {
  const _ProductCard({
    required this.product,
    required this.loadImage,
    required this.onTap,
  });
  final CatalogProduct product;
  final Future<Uint8List?> Function(String) loadImage;
  final VoidCallback onTap;

  @override
  State<_ProductCard> createState() => _ProductCardState();
}

class _ProductCardState extends State<_ProductCard> {
  Future<Uint8List?>? _image;
  MemoryImage? _imageProvider;

  @override
  void initState() {
    super.initState();
    if (widget.product.imageAvailable) {
      _image = widget.loadImage(widget.product.id);
    }
  }

  @override
  void didUpdateWidget(covariant _ProductCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.id != widget.product.id ||
        oldWidget.product.imageAvailable != widget.product.imageAvailable) {
      _image = widget.product.imageAvailable
          ? widget.loadImage(widget.product.id)
          : null;
      final previous = _imageProvider;
      _imageProvider = null;
      if (previous != null) unawaited(previous.evict());
    }
  }

  @override
  void dispose() {
    final provider = _imageProvider;
    if (provider != null) unawaited(provider.evict());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: widget.onTap,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final horizontal = constraints.maxWidth >= 400;
          final image = SizedBox(
            width: horizontal ? 112 : double.infinity,
            height: horizontal ? 112 : 168,
            child: widget.product.imageAvailable
                ? FutureBuilder<Uint8List?>(
                    future: _image,
                    builder: (context, snapshot) {
                      final bytes = snapshot.data;
                      if (bytes == null) return const _ImageFallback();
                      final provider = _imageProvider ??= MemoryImage(bytes);
                      return Image(
                        image: provider,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const _ImageFallback(),
                      );
                    },
                  )
                : const _ImageFallback(),
          );
          final details = Padding(
            padding: const EdgeInsets.all(AppTokens.spacing16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  widget.product.name,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppTokens.spacing12),
                Text(
                  _formatPrice(widget.product.price),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppTokens.primaryStrong,
                  ),
                ),
              ],
            ),
          );
          return horizontal
              ? Row(
                  children: [
                    image,
                    Expanded(child: details),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [image, details],
                );
        },
      ),
    ),
  );
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Imagem do produto indisponível',
    child: ColoredBox(
      color: AppTokens.surfaceSoft,
      child: const Center(
        child: Icon(Icons.cake_outlined, size: 42, color: AppTokens.primary),
      ),
    ),
  );
}

class _StatusState extends StatelessWidget {
  const _StatusState({
    required this.label,
    this.loading = false,
    this.error = false,
    this.actionLabel,
    this.onAction,
  });
  final String label;
  final bool loading;
  final bool error;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(AppTokens.spacing24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Semantics(
            liveRegion: true,
            label: label,
            child: loading
                ? const CircularProgressIndicator()
                : Text(
                    label,
                    textAlign: TextAlign.center,
                    style: error
                        ? const TextStyle(color: AppTokens.danger)
                        : null,
                  ),
          ),
          if (actionLabel != null) ...[
            const SizedBox(height: AppTokens.spacing16),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
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
