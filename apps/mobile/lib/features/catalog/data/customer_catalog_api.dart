import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import '../../../core/config/api_config.dart';

const _maxProductImageBytes = 2 * 1024 * 1024;
final _uuidPattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
  caseSensitive: false,
);

enum CatalogRequestStatus {
  success,
  unauthorized,
  forbidden,
  unavailable,
  notConfigured,
}

class CatalogCategory {
  const CatalogCategory({required this.id, required this.name});
  final String id;
  final String name;
}

class CatalogProduct {
  const CatalogProduct({
    required this.id,
    required this.name,
    required this.price,
    required this.category,
    required this.imageAvailable,
  });
  final String id;
  final String name;
  final String price;
  final CatalogCategory category;
  final bool imageAvailable;
}

class CatalogPage {
  const CatalogPage({
    required this.items,
    required this.page,
    required this.limit,
    required this.hasMore,
  });
  final List<CatalogProduct> items;
  final int page;
  final int limit;
  final bool hasMore;

  static CatalogPage? parse(Object? value) {
    if (value is! Map<String, dynamic> || value.length != 4) return null;
    final rawItems = value['items'];
    final page = value['page'];
    final limit = value['limit'];
    final hasMore = value['hasMore'];
    if (rawItems is! List ||
        page is! int ||
        page < 1 ||
        limit is! int ||
        limit < 1 ||
        hasMore is! bool) {
      return null;
    }
    final items = <CatalogProduct>[];
    for (final raw in rawItems) {
      if (raw is! Map<String, dynamic> || raw.length != 5) return null;
      final id = raw['id'];
      final name = raw['nome'];
      final price = raw['precoAtual'];
      final available = raw['imagemDisponivel'];
      final category = raw['categoria'];
      if (id is! String ||
          !_uuidPattern.hasMatch(id) ||
          name is! String ||
          price is! String ||
          !RegExp(r'^\d+\.\d{2}$').hasMatch(price) ||
          available is! bool ||
          category is! Map<String, dynamic> ||
          category.length != 2 ||
          category['id'] is! String ||
          !_uuidPattern.hasMatch(category['id'] as String) ||
          category['nome'] is! String) {
        return null;
      }
      items.add(
        CatalogProduct(
          id: id,
          name: name,
          price: price,
          imageAvailable: available,
          category: CatalogCategory(
            id: category['id'] as String,
            name: category['nome'] as String,
          ),
        ),
      );
    }
    return CatalogPage(
      items: List.unmodifiable(items),
      page: page,
      limit: limit,
      hasMore: hasMore,
    );
  }
}

class CatalogPageResult {
  const CatalogPageResult(this.status, {this.page});
  final CatalogRequestStatus status;
  final CatalogPage? page;
}

class CatalogImageResult {
  const CatalogImageResult(this.status, {this.bytes});
  final CatalogRequestStatus status;
  final Uint8List? bytes;
}

class CustomerCatalogApi {
  CustomerCatalogApi({
    ApiConfig? config,
    HttpClient Function()? clientFactory,
    this.timeout = const Duration(seconds: 30),
  }) : _config = config ?? ApiConfig(),
       _clientFactory = clientFactory ?? HttpClient.new;

  final ApiConfig _config;
  final HttpClient Function() _clientFactory;
  final Duration timeout;

  Future<CatalogPageResult> fetchPage({
    required String accessToken,
    required int page,
    int limit = 20,
  }) async {
    final uri = _config.catalogPageUri(page, limit);
    if (uri == null) {
      return const CatalogPageResult(CatalogRequestStatus.notConfigured);
    }
    final response = await _get(uri, accessToken);
    if (response.status != CatalogRequestStatus.success) {
      return CatalogPageResult(response.status);
    }
    try {
      final parsed = CatalogPage.parse(jsonDecode(utf8.decode(response.body)));
      return parsed == null
          ? const CatalogPageResult(CatalogRequestStatus.unavailable)
          : CatalogPageResult(CatalogRequestStatus.success, page: parsed);
    } on Object {
      return const CatalogPageResult(CatalogRequestStatus.unavailable);
    }
  }

  Future<CatalogImageResult> fetchImage({
    required String productId,
    required String accessToken,
  }) async {
    final uri = _config.catalogImageUri(productId);
    if (uri == null) {
      return const CatalogImageResult(CatalogRequestStatus.notConfigured);
    }
    final response = await _get(uri, accessToken);
    return CatalogImageResult(
      response.status,
      bytes: response.status == CatalogRequestStatus.success
          ? Uint8List.fromList(response.body)
          : null,
    );
  }

  Future<_HttpResult> _get(Uri uri, String token) async {
    final client = _clientFactory();
    try {
      final request = await client.getUrl(uri).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      final response = await request.close().timeout(timeout);
      if (response.statusCode == HttpStatus.unauthorized) {
        return const _HttpResult(CatalogRequestStatus.unauthorized);
      }
      if (response.statusCode == HttpStatus.forbidden) {
        return const _HttpResult(CatalogRequestStatus.forbidden);
      }
      if (response.statusCode != HttpStatus.ok) {
        return const _HttpResult(CatalogRequestStatus.unavailable);
      }
      final isImage = uri.path.endsWith('/imagem');
      final builder = BytesBuilder(copy: false);
      await for (final chunk in response.timeout(timeout)) {
        if (isImage && builder.length + chunk.length > _maxProductImageBytes) {
          return const _HttpResult(CatalogRequestStatus.unavailable);
        }
        builder.add(chunk);
      }
      final bytes = builder.takeBytes();
      if (bytes.isEmpty) {
        return const _HttpResult(CatalogRequestStatus.unavailable);
      }
      if (isImage && response.headers.contentType?.mimeType != 'image/webp') {
        return const _HttpResult(CatalogRequestStatus.unavailable);
      }
      return _HttpResult(CatalogRequestStatus.success, bytes);
    } on Object {
      return const _HttpResult(CatalogRequestStatus.unavailable);
    } finally {
      client.close(force: true);
    }
  }
}

class _HttpResult {
  const _HttpResult(this.status, [this.body = const <int>[]]);
  final CatalogRequestStatus status;
  final List<int> body;
}
