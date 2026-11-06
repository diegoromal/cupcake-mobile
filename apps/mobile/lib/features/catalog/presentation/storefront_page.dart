import 'dart:async';
import 'dart:developer' as developer;
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../address/presentation/customer_address_page.dart';
import '../../auth/session/customer_session.dart';
import '../../cart/data/customer_cart_api.dart';
import '../../cart/presentation/cart_page.dart';
import '../../checkout/presentation/fulfillment_page.dart';
import '../../orders/presentation/customer_orders_page.dart';
import '../data/customer_catalog_api.dart';
import 'product_detail_page.dart';
import 'customer_bottom_navigation.dart';

class StorefrontPage extends StatefulWidget {
  const StorefrontPage({
    super.key,
    required this.session,
    required this.api,
    this.cartApi,
  });
  final CustomerSession session;
  final CustomerCatalogApi api;
  final CustomerCartApi? cartApi;

  @override
  State<StorefrontPage> createState() => _StorefrontPageState();
}

class _StorefrontPageState extends State<StorefrontPage> {
  static const _measurePerformance = bool.fromEnvironment('D29_PERF');
  final _products = <CatalogProduct>[];
  final _seenIds = <String>{};
  final _indeterminateCartAttempts = <String>{};
  final _scrollController = ScrollController();
  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();
  final _fulfillmentModeSelection = ValueNotifier<FulfillmentMode?>(
    FulfillmentMode.delivery,
  );
  final _searchAreaKey = GlobalKey();
  final _productsSectionKey = GlobalKey();
  final _imageFutures = <String, Future<Uint8List?>>{};
  List<CatalogCategory> _categories = const [];
  CatalogCategory? _selectedCategory;
  bool _categoriesLoading = true;
  String? _categoriesError;
  int _categoriesGeneration = 0;
  bool _loading = true;
  bool _loadingMore = false;
  bool _signOutBusy = false;
  int _selectedNavigationIndex = 0;
  FulfillmentMode get _fulfillmentMode =>
      _fulfillmentModeSelection.value ?? FulfillmentMode.delivery;
  String _searchQuery = '';
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

  Future<Uint8List?> _imageFor(String productId) =>
      _imageFutures.putIfAbsent(productId, () => _loadImage(productId));

  void _openCart() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => CartPage(
          session: widget.session,
          cartApi: widget.cartApi ?? CustomerCartApi(),
          catalogApi: widget.api,
          initialFulfillmentMode: _fulfillmentMode,
          modeSelection: _fulfillmentModeSelection,
        ),
      ),
    );
  }

  void _unfocusSearchOutside(PointerDownEvent event) {
    if (!_searchFocusNode.hasFocus) return;
    final renderObject = _searchAreaKey.currentContext?.findRenderObject();
    if (renderObject is RenderBox) {
      final searchRect =
          renderObject.localToGlobal(Offset.zero) & renderObject.size;
      if (searchRect.contains(event.position)) return;
    }
    _searchFocusNode.unfocus();
  }

  Future<void> _openCartFromDetail() async {
    await Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => CartPage(
          session: widget.session,
          cartApi: widget.cartApi ?? CustomerCartApi(),
          catalogApi: widget.api,
          initialFulfillmentMode: _fulfillmentMode,
          modeSelection: _fulfillmentModeSelection,
        ),
      ),
    );
  }

  void _openAddresses() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => CustomerAddressPage(session: widget.session),
      ),
    );
  }

  void _openOrders() {
    Navigator.push<void>(
      context,
      MaterialPageRoute<void>(
        builder: (_) => CustomerOrdersPage(
          session: widget.session,
          onNavigationSelected: (index) {
            Navigator.pop(context);
            if (index == 3) {
              _showProfileMenu();
            } else if (index == 1) {
              _openCart();
            } else {
              _navigateTo(index);
            }
          },
        ),
      ),
    );
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
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _searchFocusNode.dispose();
    _fulfillmentModeSelection.dispose();
    super.dispose();
  }

  void _navigateTo(int index) {
    if (index == 1) {
      _openCart();
      return;
    }
    if (index == 2) {
      _openOrders();
      return;
    }
    if (index == 3) {
      _showProfileMenu();
      return;
    }
    setState(() => _selectedNavigationIndex = index);
    if (index == 0) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    }
  }

  void _showProfileMenu() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppTokens.surface,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.location_on_outlined),
              title: const Text('Meus endereços'),
              onTap: () {
                Navigator.pop(context);
                _openAddresses();
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout),
              title: Text(_signOutBusy ? 'Saindo…' : 'Sair'),
              enabled: !_signOutBusy,
              onTap: () {
                Navigator.pop(context);
                unawaited(_signOut());
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        toolbarHeight: 52,
        titleSpacing: AppTokens.spacing16,
        centerTitle: false,
        backgroundColor: const Color(0xFFFFFAF8),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            ClipOval(
              child: Image.asset(
                'assets/cupcake-brand.png',
                width: 28,
                height: 28,
                fit: BoxFit.cover,
                semanticLabel: 'Cupcake Mobile',
              ),
            ),
            const SizedBox(width: AppTokens.spacing8),
            const Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  'Cupcake Mobile',
                  maxLines: 1,
                  style: TextStyle(
                    color: AppTokens.primaryStrong,
                    fontFamily: 'Georgia',
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      body: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: _unfocusSearchOutside,
        child: SafeArea(
          top: false,
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
              Expanded(child: _storefrontContent()),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Listener(
          behavior: HitTestBehavior.translucent,
          onPointerDown: _unfocusSearchOutside,
          child: CustomerBottomNavigation(
            selectedIndex: _selectedNavigationIndex,
            onSelected: _navigateTo,
          ),
        ),
      ),
    );
  }

  Widget _storefrontContent() => LayoutBuilder(
    builder: (context, constraints) {
      final columns = constraints.maxWidth >= 360 ? 2 : 1;
      final visibleProducts = _products.where((product) {
        if (_searchQuery.isEmpty) return true;
        final searchable = '${product.name} ${product.category.name}'
            .toLowerCase();
        return searchable.contains(_searchQuery);
      }).toList();
      return RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          controller: _scrollController,
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.only(bottom: AppTokens.spacing16),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        'Olá!',
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTokens.primaryStrong,
                        ),
                      ),
                    ),
                  ),
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: AppTokens.surfaceSoft,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.coffee_outlined,
                      color: AppTokens.primary,
                      size: 20,
                    ),
                  ),
                ],
              ),
            ),
            _fulfillmentDecoration(),
            _searchDecoration(),
            if (visibleProducts.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                child: _featuredProduct(visibleProducts.first),
              ),
            _categorySelector(),
            Padding(
              key: _productsSectionKey,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        'Destaques Artesanais',
                        style: const TextStyle(
                          fontFamily: 'Georgia',
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppTokens.text,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_loading && visibleProducts.isEmpty && _searchQuery.isEmpty)
              const Padding(
                padding: EdgeInsets.all(32),
                child: _StatusState(
                  label: 'Carregando produtos…',
                  loading: true,
                ),
              )
            else if (_error != null &&
                visibleProducts.isEmpty &&
                _searchQuery.isEmpty)
              _StatusState(
                label: _error!,
                actionLabel: 'Tentar carregar novamente',
                onAction: () => _load(reset: true),
                error: true,
              )
            else if (visibleProducts.isEmpty)
              _StatusState(
                label: _searchQuery.isNotEmpty
                    ? 'Nenhum produto carregado corresponde a “${_searchController.text.trim()}”.'
                    : _selectedCategory == null
                    ? 'Não há produtos disponíveis no momento.'
                    : 'Não há produtos disponíveis em ${_selectedCategory!.name}.',
                actionLabel: 'Atualizar',
                onAction: _refresh,
              )
            else
              for (
                var rowStart = 0;
                rowStart < visibleProducts.length;
                rowStart += columns
              )
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    0,
                    16,
                    rowStart + columns < visibleProducts.length ? 8 : 0,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (
                        var index = rowStart;
                        index <
                            math.min(
                              rowStart + columns,
                              visibleProducts.length,
                            );
                        index++
                      ) ...[
                        if (index > rowStart) const SizedBox(width: 8),
                        Expanded(
                          child: _buildProductCard(visibleProducts[index]),
                        ),
                      ],
                      if (math.min(rowStart + columns, visibleProducts.length) -
                              rowStart <
                          columns)
                        const Expanded(child: SizedBox.shrink()),
                    ],
                  ),
                ),
            if (_error != null && _products.isNotEmpty)
              _StatusState(
                label: _error!,
                actionLabel: 'Tentar carregar novamente',
                onAction: () => _load(reset: false),
                error: true,
              )
            else if (_loadingMore)
              const _StatusState(
                label: 'Carregando mais produtos…',
                loading: true,
              )
            else if (_hasMore)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: OutlinedButton.icon(
                    onPressed: () => _load(reset: false),
                    icon: const Icon(Icons.expand_more),
                    label: const Text('Carregar mais produtos'),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );

  Widget _fulfillmentDecoration() {
    final labelSize = MediaQuery.textScalerOf(context).scale(14);
    final controlHeight = math.max(52.0, labelSize * 3 + 26);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: SizedBox(
        height: controlHeight,
        child: Row(
          children: [
            _fulfillmentOption(
              FulfillmentMode.delivery,
              'Delivery',
              Icons.delivery_dining,
            ),
            const SizedBox(width: 8),
            _fulfillmentOption(
              FulfillmentMode.pickup,
              'Retirada',
              Icons.storefront_outlined,
            ),
          ],
        ),
      ),
    );
  }

  Widget _fulfillmentOption(FulfillmentMode mode, String label, IconData icon) {
    final selected = _fulfillmentMode == mode;
    final color = selected ? AppTokens.primaryStrong : AppTokens.text;
    final labelSize = MediaQuery.textScalerOf(context).scale(14);
    final vertical = labelSize >= 14;
    return Expanded(
      child: Semantics(
        button: true,
        selected: selected,
        label: label,
        child: Material(
          color: selected ? AppTokens.primaryStrong : AppTokens.surfaceSoft,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => setState(() => _fulfillmentModeSelection.value = mode),
            child: SizedBox(
              height: math.max(AppTokens.touchTarget, labelSize * 3 + 26),
              child: vertical
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          icon,
                          size: 20,
                          color: selected ? Colors.white : color,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          label,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: selected ? Colors.white : color,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          icon,
                          size: 20,
                          color: selected ? Colors.white : color,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          label,
                          style: Theme.of(context).textTheme.labelLarge
                              ?.copyWith(
                                color: selected ? Colors.white : color,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _searchDecoration() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    child: SizedBox(
      key: _searchAreaKey,
      height: 52,
      child: TextField(
        controller: _searchController,
        focusNode: _searchFocusNode,
        textInputAction: TextInputAction.search,
        onSubmitted: (_) => _searchFocusNode.unfocus(),
        onChanged: (value) =>
            setState(() => _searchQuery = value.trim().toLowerCase()),
        decoration: InputDecoration(
          prefixIcon: const Icon(Icons.search),
          hintText: 'Buscar produtos',
          suffixIcon: _searchQuery.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Limpar busca',
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                    FocusScope.of(context).unfocus();
                  },
                  icon: const Icon(Icons.close),
                ),
        ),
      ),
    ),
  );

  Widget _featuredProduct(CatalogProduct product) => ClipRRect(
    borderRadius: BorderRadius.circular(14),
    child: Material(
      color: AppTokens.primaryStrong,
      child: InkWell(
        onTap: () => _openProduct(product),
        child: SizedBox(
          height: 220,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (product.imageAvailable)
                FutureBuilder<Uint8List?>(
                  future: _imageFor(product.id),
                  builder: (context, snapshot) => snapshot.data == null
                      ? const _ImageFallback()
                      : Image.memory(snapshot.data!, fit: BoxFit.cover),
                )
              else
                const _ImageFallback(),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Color(0x10000000), Color(0xD92B160F)],
                    stops: [0.25, 1],
                  ),
                ),
              ),
              Positioned(
                left: 14,
                right: 14,
                bottom: 12,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            product.category.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFFFD6C2),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            product.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontFamily: 'Georgia',
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            _formatPrice(product.price),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFFFFB996),
                              fontFamily: 'Georgia',
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Widget _categorySelector() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
        child: Row(
          children: [
            Expanded(
              child: Semantics(
                header: true,
                child: const Text(
                  'Categorias',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTokens.text,
                  ),
                ),
              ),
            ),
            if (_categories.isNotEmpty)
              FittedBox(
                fit: BoxFit.scaleDown,
                child: TextButton(
                  onPressed: () => _selectCategory(null),
                  style: TextButton.styleFrom(
                    minimumSize: const Size(48, 48),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                  ),
                  child: const Text(
                    'Ver todas',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTokens.primaryStrong,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
      if (_categoriesLoading && _categories.isEmpty)
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 6),
          child: Text('Carregando categorias…'),
        ),
      if (_categoriesError != null)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
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
        height: 52,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
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
      constraints: const BoxConstraints(minHeight: 48, minWidth: 48),
      child: ChoiceChip(
        label: Text(label),
        selected: _selectedCategory?.id == category?.id,
        onSelected: (_) => _selectCategory(category),
        showCheckmark: false,
        labelStyle: TextStyle(
          color: _selectedCategory?.id == category?.id
              ? Colors.white
              : AppTokens.text,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        side: BorderSide.none,
        shape: const StadiumBorder(),
        backgroundColor: AppTokens.surfaceSoft,
        selectedColor: AppTokens.primaryStrong,
        visualDensity: VisualDensity.compact,
        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    ),
  );

  Widget _buildProductCard(CatalogProduct product) => _ProductCard(
    key: ValueKey(product.id),
    product: product,
    loadImage: _loadImage,
    onTap: () => _openProduct(product),
  );

  void _openProduct(CatalogProduct product) => Navigator.push<void>(
    context,
    MaterialPageRoute(
      builder: (_) => ProductDetailPage(
        productId: product.id,
        session: widget.session,
        api: widget.api,
        cartApi: widget.cartApi,
        onOpenCart: _openCartFromDetail,
        indeterminateCartAttempts: _indeterminateCartAttempts,
      ),
    ),
  );
}

class _ProductCard extends StatefulWidget {
  const _ProductCard({
    super.key,
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
    color: AppTokens.surface,
    margin: EdgeInsets.zero,
    clipBehavior: Clip.antiAlias,
    elevation: 0.5,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(12),
      side: const BorderSide(color: Color(0xFFF4E6E0), width: 0.6),
    ),
    child: InkWell(
      onTap: widget.onTap,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final image = SizedBox(
            width: double.infinity,
            height: 112,
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
            padding: const EdgeInsets.fromLTRB(8, 9, 8, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.product.category.name.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTokens.primary,
                    fontSize: 12,
                    letterSpacing: 0.25,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  widget.product.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppTokens.text,
                    fontFamily: 'Georgia',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 7),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _formatPrice(widget.product.price),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppTokens.primaryStrong,
                          fontFamily: 'Georgia',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFE3D9),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.arrow_forward,
                        size: 15,
                        color: AppTokens.primary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
          return Column(
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
