import 'dart:async';
import 'dart:math';
import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/design/app_tokens.dart';
import '../../auth/session/customer_session.dart';
import '../../catalog/data/customer_catalog_api.dart';
import '../../catalog/presentation/product_detail_page.dart';
import '../../catalog/presentation/storefront_page.dart';
import '../../cart/data/customer_cart_api.dart';
import '../data/customer_order_api.dart';
import 'fulfillment_mode.dart';
import 'payment_page.dart';

class OrderReviewPage extends StatefulWidget {
  const OrderReviewPage({
    super.key,
    required this.session,
    required this.mode,
    this.addressId,
    this.orderApi,
    this.catalogApi,
    this.cartApi,
  });
  final CustomerSession session;
  final String mode;
  final String? addressId;
  final CustomerOrderApi? orderApi;
  final CustomerCatalogApi? catalogApi;
  final CustomerCartApi? cartApi;

  @override
  State<OrderReviewPage> createState() => _OrderReviewPageState();
}

class _OrderReviewPageState extends State<OrderReviewPage> {
  late final CustomerOrderApi _api = widget.orderApi ?? CustomerOrderApi();
  late final CustomerCatalogApi _catalogApi =
      widget.catalogApi ?? CustomerCatalogApi();
  late final CustomerCartApi _cartApi = widget.cartApi ?? CustomerCartApi();
  List<CatalogProduct> _suggestions = const [];
  bool _suggestionsLoading = false;
  bool _addingSuggestion = false;
  final Map<String, Future<Uint8List?>> _reviewImages = {};
  Map<String, dynamic>? _review;
  OrderStatus? _status;
  bool _loading = false;
  bool _confirming = false;
  String? _orderId;
  bool _resolvingPreviousIntent = false;
  bool _previousIntentResolved = false;
  int _generation = 0;
  int _selfRefreshDepth = 0;
  late String? _sessionToken = widget.session.accessToken;
  late String _attemptId;
  String get _mode => widget.mode;
  String? get _addressId => widget.addressId;
  bool get _canChangeSelection =>
      !_confirming &&
      _orderId == null &&
      widget.session.pendingOrderConfirmation == null;

  bool _matchesSelection(PendingOrderConfirmation pending) =>
      pending.mode == widget.mode &&
      pending.addressId == widget.addressId &&
      pending.review['modalidade'] == pending.mode &&
      pending.review['enderecoId'] == pending.addressId &&
      pending.review['revisaoId'] is String &&
      (pending.review['revisaoId'] as String).isNotEmpty;

  Future<Uint8List?> _loadReviewImage(String productId) async {
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) return null;
    var result = await _catalogApi.fetchImage(
      productId: productId,
      accessToken: token,
    );
    if (result.status == CatalogRequestStatus.unauthorized) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token == null) return null;
      result = await _catalogApi.fetchImage(
        productId: productId,
        accessToken: token,
      );
    }
    return widget.session.isAuthenticated &&
            result.status == CatalogRequestStatus.success
        ? result.bytes
        : null;
  }

  @override
  void initState() {
    super.initState();
    widget.session.addListener(_sessionChanged);
    final pending = widget.session.pendingOrderConfirmation;
    if (pending != null) {
      _attemptId = pending.attemptId;
      _resolvingPreviousIntent = !_matchesSelection(pending);
      if (!_resolvingPreviousIntent) {
        _review = pending.review;
      }
    } else {
      _attemptId = _newUuid();
      unawaited(_load());
    }
  }

  Future<void> _loadSuggestions() async {
    if (_suggestionsLoading) return;
    _suggestionsLoading = true;
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) {
      _suggestionsLoading = false;
      return;
    }
    var currentToken = token;
    final existing = ((_review?['itens'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map((item) => item['produtoId'])
        .whereType<String>()
        .toSet();
    final eligible = <CatalogProduct>[];
    var pageNumber = 1;
    var hasMore = true;
    while (hasMore && eligible.length < 3 && mounted) {
      var result = await _catalogApi.fetchPage(
        accessToken: currentToken,
        page: pageNumber,
      );
      if (result.status == CatalogRequestStatus.unauthorized && mounted) {
        final refreshedToken = await widget.session.refreshAfterUnauthorized(
          currentToken,
        );
        if (refreshedToken == null) break;
        currentToken = refreshedToken;
        result = await _catalogApi.fetchPage(
          accessToken: currentToken,
          page: pageNumber,
        );
      }
      final page = result.page;
      if (result.status != CatalogRequestStatus.success || page == null) {
        break;
      }
      for (final product in page.items) {
        if (!existing.contains(product.id)) eligible.add(product);
        if (eligible.length == 3) break;
      }
      hasMore = page.hasMore;
      pageNumber++;
    }
    if (!mounted) return;
    setState(() {
      _suggestionsLoading = false;
      _suggestions = eligible;
    });
  }

  Future<void> _addSuggestion(CatalogProduct product) async {
    if (_addingSuggestion || _confirming || !_canChangeSelection) return;
    setState(() => _addingSuggestion = true);
    await widget.session.refreshIfNeeded();
    var token = widget.session.accessToken;
    if (token == null) {
      if (mounted) setState(() => _addingSuggestion = false);
      return;
    }
    var detail = await _catalogApi.fetchDetail(
      productId: product.id,
      accessToken: token,
    );
    if (detail.status == CatalogRequestStatus.unauthorized && mounted) {
      token = await widget.session.refreshAfterUnauthorized(token);
      if (token != null) {
        detail = await _catalogApi.fetchDetail(
          productId: product.id,
          accessToken: token,
        );
      }
    }
    if (!mounted) return;
    final item = detail.product;
    if (detail.status != CatalogRequestStatus.success || item == null) {
      setState(() => _addingSuggestion = false);
      return;
    }
    if (item.personalizations.isNotEmpty) {
      setState(() => _addingSuggestion = false);
      await Navigator.of(context).push<void>(
        MaterialPageRoute<void>(
          builder: (_) => ProductDetailPage(
            productId: product.id,
            session: widget.session,
            api: _catalogApi,
            cartApi: _cartApi,
            onAddedToCart: () async {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              }
            },
          ),
        ),
      );
      if (mounted) {
        await _load();
        await _loadSuggestions();
      }
      return;
    }
    final addToken = token;
    if (addToken == null) {
      setState(() => _addingSuggestion = false);
      return;
    }
    var addResult = await _cartApi.addItem(
      accessToken: addToken,
      productId: product.id,
      quantity: 1,
      personalizationIds: const [],
    );
    if (addResult.status == CartRequestStatus.unauthorized && mounted) {
      final refreshedToken = await widget.session.refreshAfterUnauthorized(
        addToken,
      );
      if (refreshedToken != null) {
        addResult = await _cartApi.addItem(
          accessToken: refreshedToken,
          productId: product.id,
          quantity: 1,
          personalizationIds: const [],
        );
      }
    }
    if (!mounted) return;
    setState(() => _addingSuggestion = false);
    if (addResult.status == CartRequestStatus.success) {
      await _load();
      await _loadSuggestions();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível adicionar o produto.')),
      );
    }
  }

  @override
  void dispose() {
    _generation++;
    widget.session.removeListener(_sessionChanged);
    super.dispose();
  }

  void _sessionChanged() {
    if (widget.session.isAuthenticated) {
      final token = widget.session.accessToken;
      if (token == _sessionToken) return;
      _sessionToken = token;
      if (_selfRefreshDepth > 0) return;
      _generation++;
      if (_confirming) {
        setState(() {
          _confirming = false;
          _status = OrderStatus.timeout;
        });
      } else if (_orderId == null) {
        _loading = false;
        unawaited(_load());
      }
      return;
    }
    _generation++;
    if (mounted) {
      setState(() {
        _review = null;
        _status = OrderStatus.unauthorized;
        _loading = false;
        _confirming = false;
      });
    }
  }

  Future<OrderResult> _request(
    Future<OrderResult> Function(String) action,
    int generation,
  ) async {
    await _refreshSession(() => widget.session.refreshIfNeeded());
    if (!mounted || generation != _generation) {
      return const OrderResult(OrderStatus.unauthorized);
    }
    var token = widget.session.accessToken;
    if (token == null) return const OrderResult(OrderStatus.unauthorized);
    var result = await action(token);
    if (result.status == OrderStatus.unauthorized &&
        mounted &&
        generation == _generation) {
      token = await _refreshSession<String?>(
        () => widget.session.refreshAfterUnauthorized(token!),
      );
      if (token == null || !mounted || generation != _generation) {
        return const OrderResult(OrderStatus.unauthorized);
      }
      result = await action(token);
    }
    return result;
  }

  Future<T> _refreshSession<T>(Future<T> Function() action) async {
    _selfRefreshDepth++;
    try {
      return await action();
    } finally {
      _selfRefreshDepth--;
      _sessionToken = widget.session.accessToken;
    }
  }

  Future<void> _load() async {
    if (_loading || _confirming || _orderId != null) return;
    if (_resolvingPreviousIntent) return;
    // A rejected revision cannot be resumed. An indeterminate confirmation can.
    if (_status == OrderStatus.conflict) {
      widget.session.clearOrderConfirmation();
    }
    final pending = widget.session.pendingOrderConfirmation;
    if (pending != null && _matchesSelection(pending)) {
      setState(() {
        _review = pending.review;
        _attemptId = pending.attemptId;
      });
      return;
    }
    if (pending != null) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _status = null;
    });
    final result = await _request(
      (token) => _api.review(token, _mode, _addressId),
      generation,
    );
    if (!mounted || generation != _generation) return;
    setState(() {
      _loading = false;
      _status = result.status;
      _review = result.status == OrderStatus.success ? result.value : null;
      if (_review != null) _attemptId = _newUuid();
    });
    if (_review != null) unawaited(_loadSuggestions());
  }

  Future<void> _confirm() async {
    final pending = widget.session.pendingOrderConfirmation;
    final review = _resolvingPreviousIntent ? pending?.review : _review;
    if (_confirming || _loading || review == null || _orderId != null) return;
    if (_resolvingPreviousIntent &&
        (pending == null || _previousIntentResolved)) {
      return;
    }
    final generation = _generation;
    if (!_resolvingPreviousIntent) {
      widget.session.rememberOrderConfirmation(
        PendingOrderConfirmation(
          attemptId: _attemptId,
          mode: _mode,
          addressId: _addressId,
          review: Map<String, dynamic>.from(review),
        ),
      );
    }
    final confirmation = widget.session.pendingOrderConfirmation!;
    setState(() {
      _confirming = true;
      _status = null;
    });
    final result = await _request(
      (token) => _api.confirm(
        token,
        confirmation.mode,
        confirmation.addressId,
        confirmation.attemptId,
        confirmation.review['revisaoId'] as String,
      ),
      generation,
    );
    if (!mounted || generation != _generation) return;
    final rejected =
        result.status == OrderStatus.conflict ||
        result.status == OrderStatus.forbidden ||
        result.status == OrderStatus.notFound ||
        result.status == OrderStatus.unauthorized;
    if (result.status == OrderStatus.success || rejected) {
      widget.session.clearOrderConfirmation();
    }
    setState(() {
      _confirming = false;
      _status = result.status;
      if (_resolvingPreviousIntent &&
          (result.status == OrderStatus.success || rejected)) {
        _previousIntentResolved = true;
      }
      if (rejected) _attemptId = _newUuid();
      if (result.status == OrderStatus.success) {
        _orderId = result.value!['id'] as String;
      }
    });
    if (result.status == OrderStatus.success && !_resolvingPreviousIntent) {
      final order = result.value!;
      if (order['id'] is String &&
          order['identificadorNegocio'] is String &&
          order['total'] is String) {
        unawaited(
          Navigator.of(context).push<void>(
            MaterialPageRoute<void>(
              builder: (_) => PaymentPage(
                session: widget.session,
                orderId: order['id'] as String,
                orderNumber: order['identificadorNegocio'] as String,
                total: order['total'] as String,
              ),
            ),
          ),
        );
      }
    }
  }

  String _message(OrderStatus status) => switch (status) {
    OrderStatus.unauthorized => 'Sessão expirada. Entre novamente.',
    OrderStatus.forbidden => 'Sua conta não pode confirmar este pedido.',
    OrderStatus.notFound =>
      'Carrinho ou endereço não encontrado. Volte e confira os dados.',
    OrderStatus.conflict =>
      'A revisão mudou ou há itens indisponíveis. Atualize a revisão.',
    OrderStatus.unavailable => 'Serviço indisponível. Tente novamente.',
    OrderStatus.timeout => 'A resposta demorou. Tente novamente com segurança.',
    OrderStatus.invalidResponse => 'Resposta inválida. Tente novamente.',
    OrderStatus.networkError => 'Sem conexão. Tente novamente.',
    OrderStatus.success => '',
  };

  Widget _content() {
    if (_resolvingPreviousIntent) {
      final pending = widget.session.pendingOrderConfirmation;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Confirmação anterior pendente',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 16),
          Semantics(
            liveRegion: true,
            child: Text(
              _previousIntentResolved
                  ? _orderId != null
                        ? 'Pedido anterior confirmado. Número: $_orderId'
                        : 'A confirmação anterior foi rejeitada. Confira sua escolha e solicite uma nova revisão.'
                  : 'Sua escolha atual foi preservada. Resolva a confirmação anterior de ${pending?.mode == 'ENTREGA' ? 'Delivery' : 'Retirada'} antes de iniciar um novo pedido.',
            ),
          ),
          if (_status != null && !_previousIntentResolved) ...[
            const SizedBox(height: 12),
            Semantics(liveRegion: true, child: Text(_message(_status!))),
          ],
          const SizedBox(height: 24),
          if (_previousIntentResolved)
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Voltar à forma de recebimento'),
            )
          else
            FilledButton(
              onPressed: _confirming ? null : () => unawaited(_confirm()),
              child: Text(
                _confirming
                    ? 'Resolvendo confirmação…'
                    : 'Resolver confirmação anterior',
              ),
            ),
        ],
      );
    }
    if (_loading) {
      return Semantics(liveRegion: true, child: Text('Carregando revisão…'));
    }
    final review = _review;
    if (review == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            liveRegion: true,
            child: Text(_message(_status ?? OrderStatus.unavailable)),
          ),
          const SizedBox(height: 12),
          if (_status != OrderStatus.unauthorized &&
              _status != OrderStatus.forbidden)
            OutlinedButton(
              onPressed: () => unawaited(_load()),
              child: const Text('Tentar novamente'),
            ),
        ],
      );
    }
    final address = review['enderecoEntregaSnapshot'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          color: AppTokens.surface,
          child: Padding(
            padding: const EdgeInsets.all(AppTokens.spacing12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: AppTokens.spacing8,
                  runSpacing: AppTokens.spacing4,
                  children: [
                    Text(
                      'MODALIDADE',
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    Wrap(
                      alignment: WrapAlignment.spaceBetween,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: AppTokens.spacing8,
                      children: [
                        Text(
                          _mode == 'ENTREGA' ? 'Delivery' : 'Retirada',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(color: AppTokens.primaryStrong),
                        ),
                        TextButton(
                          onPressed: _canChangeSelection
                              ? () => Navigator.of(context).pop()
                              : null,
                          child: const Text('Alterar'),
                        ),
                      ],
                    ),
                  ],
                ),
                if (address is Map<String, dynamic>) ...[
                  const Divider(height: AppTokens.spacing12),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        color: AppTokens.primary,
                      ),
                      const SizedBox(width: AppTokens.spacing8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${address['rua']}, ${address['numero']}',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Text(
                              '${address['bairro']} · ${address['cidade']} · ${address['cep']}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            if (address['complemento'] is String &&
                                (address['complemento'] as String).isNotEmpty)
                              Text(address['complemento'] as String),
                            if (address['referencia'] is String &&
                                (address['referencia'] as String).isNotEmpty)
                              Text(address['referencia'] as String),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppTokens.spacing8),
                  Text(
                    'Frete calculado: ${_formatCurrency(review['freteAplicado'] as String)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTokens.primaryStrong,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: AppTokens.spacing8),
        for (final raw in review['itens'] as List) ...[
          Builder(
            builder: (_) {
              final item = raw as Map<String, dynamic>;
              final productId = item['produtoId'] as String;
              final image = _reviewImages.putIfAbsent(
                productId,
                () => _loadReviewImage(productId),
              );
              return Card(
                color: AppTokens.surface,
                child: Padding(
                  padding: const EdgeInsets.all(AppTokens.spacing12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 60,
                        height: 60,
                        child: FutureBuilder<Uint8List?>(
                          future: image,
                          builder: (context, snapshot) {
                            final bytes = snapshot.data;
                            if (bytes == null) {
                              return Container(
                                decoration: BoxDecoration(
                                  color: AppTokens.surfaceSoft,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.cake_outlined,
                                  color: AppTokens.primary,
                                ),
                              );
                            }
                            return ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.memory(bytes, fit: BoxFit.cover),
                            );
                          },
                        ),
                      ),
                      const SizedBox(width: AppTokens.spacing8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['nome'] as String,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Text(
                              '${item['quantidade']} × ${_formatCurrency(item['precoAplicado'] as String)}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            for (final rawOption
                                in item['personalizacoes'] as List)
                              Text(
                                _optionLabel(rawOption as Map<String, dynamic>),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            Text(
                              'Subtotal: ${_formatCurrency(item['subtotalAplicado'] as String)}',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
        Card(
          color: AppTokens.surface,
          child: Padding(
            padding: const EdgeInsets.all(AppTokens.spacing12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Resumo dos valores',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: AppTokens.spacing8),
                Text(
                  'Itens: ${_formatCurrency(review['valorItens'] as String)}',
                ),
                const SizedBox(height: AppTokens.spacing8),
                Text(
                  'Frete: ${_formatCurrency(review['freteAplicado'] as String)}',
                ),
                const Divider(height: AppTokens.spacing24),
                Text(
                  'Total final: ${_formatCurrency(review['total'] as String)}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppTokens.primaryStrong,
                    fontFamily: 'Georgia',
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppTokens.spacing8),
        Card(
          color: AppTokens.surface,
          child: Padding(
            padding: const EdgeInsets.all(AppTokens.spacing12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Quer adicionar mais alguma coisa?',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                if (_suggestions.isEmpty && !_suggestionsLoading)
                  Text(
                    'Continue comprando pelo cardápio completo.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                if (_suggestionsLoading && _suggestions.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: LinearProgressIndicator(),
                  ),
                if (_suggestions.isNotEmpty) ...[
                  const SizedBox(height: AppTokens.spacing8),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final largeText =
                          MediaQuery.textScalerOf(context).scale(16) > 18;
                      if (constraints.maxWidth >= 320 && !largeText) {
                        return GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _suggestions.length,
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: AppTokens.spacing8,
                                mainAxisSpacing: AppTokens.spacing8,
                                mainAxisExtent: 156,
                              ),
                          itemBuilder: (context, index) => _suggestionCard(
                            _suggestions[index],
                            compact: true,
                          ),
                        );
                      }
                      return Column(
                        children: [
                          for (final product in _suggestions)
                            Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppTokens.spacing8,
                              ),
                              child: _suggestionCard(product, compact: false),
                            ),
                        ],
                      );
                    },
                  ),
                ],
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton(
                    onPressed: _addingSuggestion
                        ? null
                        : () {
                            Navigator.of(context).push<void>(
                              MaterialPageRoute<void>(
                                builder: (_) => StorefrontPage(
                                  session: widget.session,
                                  api: _catalogApi,
                                  cartApi: _cartApi,
                                  initialFulfillmentMode: _mode == 'ENTREGA'
                                      ? FulfillmentMode.delivery
                                      : FulfillmentMode.pickup,
                                  initialAddressId: _addressId,
                                ),
                              ),
                            );
                          },
                    child: const Text('Ver cardápio completo →'),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_status != null && _status != OrderStatus.success) ...[
          const SizedBox(height: 16),
          Semantics(liveRegion: true, child: Text(_message(_status!))),
          if (_status == OrderStatus.conflict)
            OutlinedButton(
              onPressed: () => unawaited(_load()),
              child: const Text('Atualizar revisão'),
            ),
        ],
        if (_orderId != null) ...[
          const SizedBox(height: 16),
          Semantics(
            liveRegion: true,
            child: Text('Pedido confirmado. Número: $_orderId'),
          ),
        ],
      ],
    );
  }

  String _optionLabel(Map<String, dynamic> option) {
    final name = option['nomeAplicado'] as String;
    final adjustment = option['ajusteValorAplicado'];
    if (adjustment is! String) return name;
    return '$name · ${_formatCurrency(adjustment)}';
  }

  String _formatAmount(String value) {
    final parts = value.split('.');
    final whole = parts.first.replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => '.',
    );
    return parts.length > 1 ? '$whole,${parts[1]}' : whole;
  }

  String _formatCurrency(String value) => 'R\$ ${_formatAmount(value)}';

  Widget _suggestionCard(CatalogProduct product, {required bool compact}) {
    final image = ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: compact ? double.infinity : 56,
        height: compact ? 48 : 56,
        child: product.imageAvailable
            ? FutureBuilder<Uint8List?>(
                future: _reviewImages.putIfAbsent(
                  'suggestion:${product.id}',
                  () => _loadReviewImage(product.id),
                ),
                builder: (context, snapshot) => snapshot.data == null
                    ? const ColoredBox(
                        color: AppTokens.surfaceSoft,
                        child: Icon(Icons.cake_outlined),
                      )
                    : Image.memory(
                        snapshot.data!,
                        fit: BoxFit.cover,
                        semanticLabel: 'Imagem de ${product.name}',
                      ),
              )
            : const ColoredBox(
                color: AppTokens.surfaceSoft,
                child: Icon(Icons.cake_outlined),
              ),
      ),
    );
    final details = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: compact
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        Text(
          product.name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          textAlign: compact ? TextAlign.center : TextAlign.start,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        Text(
          _formatCurrency(product.price),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppTokens.primaryStrong,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
    final add = IconButton.filledTonal(
      tooltip: 'Adicionar ${product.name} ao pedido',
      constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
      onPressed: _addingSuggestion
          ? null
          : () => unawaited(_addSuggestion(product)),
      icon: const Icon(Icons.add),
    );
    return Card(
      margin: EdgeInsets.zero,
      color: AppTokens.surfaceSoft,
      child: Padding(
        padding: const EdgeInsets.all(AppTokens.spacing8),
        child: compact
            ? Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [image, details, add],
              )
            : Row(
                children: [
                  image,
                  const SizedBox(width: AppTokens.spacing8),
                  Expanded(child: details),
                  add,
                ],
              ),
      ),
    );
  }

  Widget _confirmationButtonContent(String total) {
    final totalLabel = 'R\$ ${_formatAmount(total)}';
    final actionLabel = _confirming
        ? 'Processando pedido…'
        : 'Confirmar pedido';
    final textStyle =
        Theme.of(context).textTheme.labelLarge ??
        DefaultTextStyle.of(context).style;
    final textScaler = MediaQuery.textScalerOf(context);
    final textDirection = Directionality.of(context);

    double textWidth(String text) {
      final painter = TextPainter(
        text: TextSpan(text: text, style: textStyle),
        textDirection: textDirection,
        textScaler: textScaler,
        maxLines: 1,
      )..layout();
      final width = painter.width;
      painter.dispose();
      return width;
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final fitsHorizontally =
            constraints.hasBoundedWidth &&
            textWidth(totalLabel) +
                    textWidth(actionLabel) +
                    AppTokens.spacing12 <=
                constraints.maxWidth;
        if (fitsHorizontally) {
          return Row(
            children: [Text(totalLabel), const Spacer(), Text(actionLabel)],
          );
        }
        return SizedBox(
          width: constraints.maxWidth,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: Text(totalLabel),
              ),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Text(actionLabel, textAlign: TextAlign.end),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Revisar Pedido')),
    bottomNavigationBar: _review != null && _orderId == null
        ? SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppTokens.spacing16,
                AppTokens.spacing8,
                AppTokens.spacing16,
                AppTokens.spacing12,
              ),
              child: FilledButton(
                onPressed:
                    _confirming || _loading || _status == OrderStatus.conflict
                    ? null
                    : () => unawaited(_confirm()),
                child: _confirmationButtonContent(_review!['total'] as String),
              ),
            ),
          )
        : null,
    body: SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppTokens.spacing16),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: _content(),
          ),
        ),
      ),
    ),
  );
}

String _newUuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
