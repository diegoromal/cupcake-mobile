import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/customer_auth_api.dart';
import '../data/session_storage.dart';

enum CustomerSessionState {
  restoring,
  public,
  authenticated,
  restorationUnavailable,
  signedOutStorageError,
}

enum SignInOutcome {
  authenticated,
  invalidCredentials,
  invalidRequest,
  unavailable,
  notConfigured,
  storageFailure,
  stale,
}

class CustomerSession extends ChangeNotifier {
  CustomerSession({
    required this.authApi,
    required this.storage,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final CustomerAuthApi authApi;
  final SessionStorage storage;
  final DateTime Function() _clock;
  CustomerSessionState _state = CustomerSessionState.restoring;
  CustomerTokens? _tokens;
  Future<void>? _restoreInFlight;
  Future<void>? _refreshInFlight;
  int? _refreshGeneration;
  Timer? _accessRefreshTimer;
  Future<void> _storageQueue = Future<void>.value();
  int _generation = 0;
  bool _sessionExpired = false;
  bool _refreshUnavailable = false;
  bool _foreground = true;
  bool _disposed = false;

  CustomerSessionState get state => _state;
  bool get sessionExpired => _sessionExpired;
  bool get refreshUnavailable => _refreshUnavailable;
  bool get isAuthenticated => _state == CustomerSessionState.authenticated;
  String? get accessToken => isAuthenticated ? _tokens?.accessToken : null;

  void setForeground(bool foreground) {
    if (_disposed || _foreground == foreground) return;
    _foreground = foreground;
    _scheduleAccessRefresh();
  }

  void _scheduleAccessRefresh({bool afterRefresh = false}) {
    _accessRefreshTimer?.cancel();
    _accessRefreshTimer = null;
    final tokens = _tokens;
    if (_disposed || !_foreground || !isAuthenticated || tokens == null) return;
    final now = _clock();
    var delay = _refreshUnavailable
        ? tokens.timeUntilAccessExpiryAt(now)
        : tokens.timeUntilAccessRefreshAt(now);
    if (afterRefresh && delay == Duration.zero) {
      // A short-lived response must not start another refresh immediately.
      final untilExpiry = tokens.timeUntilAccessExpiryAt(now);
      delay = untilExpiry > const Duration(seconds: 1)
          ? untilExpiry
          : const Duration(seconds: 1);
    }
    _accessRefreshTimer = Timer(delay, () {
      _accessRefreshTimer = null;
      if (_refreshUnavailable) {
        if (tokens.timeUntilAccessExpiryAt(_clock()) == Duration.zero) {
          _setState(CustomerSessionState.restorationUnavailable);
        } else {
          _scheduleAccessRefresh();
        }
      } else {
        unawaited(refreshIfNeeded());
      }
    });
  }

  Future<void> restore() {
    final inFlight = _restoreInFlight;
    if (inFlight != null) return inFlight;
    final generation = ++_generation;
    _sessionExpired = false;
    _refreshUnavailable = false;
    _setState(CustomerSessionState.restoring);
    final future = _restore(generation);
    _restoreInFlight = future;
    return future.whenComplete(() {
      _restoreInFlight = null;
    });
  }

  Future<void> _restore(int generation) async {
    CustomerTokens? stored;
    try {
      stored = await _withStorageLock(storage.read);
    } on Object {
      if (_isCurrent(generation)) {
        _setState(CustomerSessionState.restorationUnavailable);
      }
      return;
    }
    if (!_isCurrent(generation)) return;
    if (stored == null) {
      _tokens = null;
      _setState(CustomerSessionState.public);
      return;
    }
    _tokens = stored;
    if (!stored.hasRecoverableRefresh) {
      await _endSession(generation);
      return;
    }
    await _refresh(generation, restoring: true);
  }

  Future<SignInOutcome> signIn({
    required String email,
    required String password,
  }) async {
    if (_state == CustomerSessionState.restoring ||
        _state == CustomerSessionState.authenticated) {
      return SignInOutcome.stale;
    }
    final generation = ++_generation;
    final result = await authApi.login(email: email, password: password);
    if (!_isCurrent(generation)) return SignInOutcome.stale;
    switch (result.status) {
      case AuthRequestStatus.success:
        final tokens = result.tokens;
        if (tokens == null) return SignInOutcome.unavailable;
        var persisted = false;
        try {
          persisted = await _withStorageLock(() async {
            await storage.write(tokens);
            if (!_isCurrent(generation)) {
              await storage.clear();
              return false;
            }
            return true;
          });
        } on Object {
          await _clearAfterFailedWrite(generation);
          return SignInOutcome.storageFailure;
        }
        if (!persisted || !_isCurrent(generation)) return SignInOutcome.stale;
        _tokens = tokens;
        _sessionExpired = false;
        _refreshUnavailable = false;
        _setState(CustomerSessionState.authenticated);
        return SignInOutcome.authenticated;
      case AuthRequestStatus.invalidCredentials:
        return SignInOutcome.invalidCredentials;
      case AuthRequestStatus.invalidRequest:
        return SignInOutcome.invalidRequest;
      case AuthRequestStatus.notConfigured:
        return SignInOutcome.notConfigured;
      case AuthRequestStatus.unavailable:
      case AuthRequestStatus.invalidToken:
        return SignInOutcome.unavailable;
    }
  }

  Future<void> refreshIfNeeded() async {
    final tokens = _tokens;
    if (_state != CustomerSessionState.authenticated ||
        tokens == null ||
        _refreshUnavailable ||
        !tokens.accessNeedsRefreshAt(_clock())) {
      return;
    }
    await _refresh(_generation, restoring: false);
  }

  Future<void> retryRefresh() {
    if (!isAuthenticated || !_refreshUnavailable) return Future<void>.value();
    return _refresh(_generation, restoring: false);
  }

  Future<void> _refresh(int generation, {required bool restoring}) {
    final inFlight = _refreshInFlight;
    if (inFlight != null && _refreshGeneration == generation) return inFlight;
    final tokens = _tokens;
    if (tokens == null) return Future<void>.value();
    late final Future<void> shared;
    shared = _performRefresh(tokens, generation, restoring: restoring)
        .whenComplete(() {
          if (identical(_refreshInFlight, shared)) {
            _refreshInFlight = null;
            _refreshGeneration = null;
          }
        });
    _refreshInFlight = shared;
    _refreshGeneration = generation;
    return shared;
  }

  Future<void> _performRefresh(
    CustomerTokens previous,
    int generation, {
    required bool restoring,
  }) async {
    final result = await authApi.refresh(previous.refreshToken);
    if (!_isCurrent(generation)) return;
    if (result.status == AuthRequestStatus.success &&
        result.accessToken != null) {
      final updated = previous.withAccessToken(result.accessToken);
      if (updated == null) {
        await _endSession(generation);
        return;
      }
      try {
        await _withStorageLock(() => storage.write(updated));
      } on Object {
        if (_isCurrent(generation)) {
          _handleTemporaryRefreshFailure(previous, restoring: restoring);
        }
        return;
      }
      if (!_isCurrent(generation)) return;
      _tokens = updated;
      _refreshUnavailable = false;
      _setState(CustomerSessionState.authenticated, afterRefresh: true);
      return;
    }
    if (result.status == AuthRequestStatus.invalidToken ||
        result.status == AuthRequestStatus.invalidRequest) {
      await _endSession(generation);
      return;
    }
    _handleTemporaryRefreshFailure(previous, restoring: restoring);
  }

  void _handleTemporaryRefreshFailure(
    CustomerTokens previous, {
    required bool restoring,
  }) {
    if (restoring ||
        previous.timeUntilAccessExpiryAt(_clock()) == Duration.zero) {
      _setState(CustomerSessionState.restorationUnavailable);
      return;
    }
    _refreshUnavailable = true;
    _setState(CustomerSessionState.authenticated);
  }

  Future<void> retryRestoration() => restore();

  Future<bool> signOut() async {
    final generation = ++_generation;
    _sessionExpired = false;
    _refreshUnavailable = false;
    _tokens = null;
    _setState(CustomerSessionState.signedOutStorageError);
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        await _withStorageLock(storage.clear);
        if (_isCurrent(generation)) _setState(CustomerSessionState.public);
        return true;
      } on Object {
        // Retry once; never keep rendering the authenticated area after logout.
      }
    }
    if (_isCurrent(generation)) {
      _setState(CustomerSessionState.signedOutStorageError);
    }
    return false;
  }

  Future<void> retrySignOut() async {
    final generation = ++_generation;
    _refreshUnavailable = false;
    _tokens = null;
    _setState(CustomerSessionState.signedOutStorageError);
    try {
      await _withStorageLock(storage.clear);
      if (_isCurrent(generation)) _setState(CustomerSessionState.public);
    } on Object {
      if (_isCurrent(generation)) {
        _setState(CustomerSessionState.signedOutStorageError);
      }
    }
  }

  Future<void> _endSession(int generation) async {
    _tokens = null;
    _sessionExpired = true;
    _refreshUnavailable = false;
    _setState(CustomerSessionState.signedOutStorageError);
    try {
      await _withStorageLock(storage.clear);
      if (_isCurrent(generation)) {
        _setState(CustomerSessionState.public);
      }
    } on Object {
      if (_isCurrent(generation)) {
        _setState(CustomerSessionState.signedOutStorageError);
      }
    }
  }

  Future<void> _clearAfterFailedWrite(int generation) async {
    _tokens = null;
    _setState(CustomerSessionState.signedOutStorageError);
    try {
      await _withStorageLock(storage.clear);
      if (_isCurrent(generation)) _setState(CustomerSessionState.public);
    } on Object {
      if (_isCurrent(generation)) {
        _setState(CustomerSessionState.signedOutStorageError);
      }
    }
  }

  Future<T> _withStorageLock<T>(Future<T> Function() operation) {
    final result = _storageQueue.then((_) => operation());
    _storageQueue = result.then<void>(
      (_) {},
      onError: (Object _, StackTrace _) {},
    );
    return result;
  }

  bool _isCurrent(int generation) => !_disposed && generation == _generation;

  void _setState(CustomerSessionState state, {bool afterRefresh = false}) {
    if (_disposed) return;
    _state = state;
    _scheduleAccessRefresh(afterRefresh: afterRefresh);
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _accessRefreshTimer?.cancel();
    _accessRefreshTimer = null;
    super.dispose();
  }
}
