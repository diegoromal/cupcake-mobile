import 'package:flutter/material.dart';

import 'app_tokens.dart';

abstract final class AppTheme {
  static ThemeData get light {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppTokens.primary,
      brightness: Brightness.light,
      surface: AppTokens.surface,
      error: AppTokens.danger,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme.copyWith(
        primary: AppTokens.primary,
        onPrimary: AppTokens.surface,
        surface: AppTokens.surface,
        onSurface: AppTokens.text,
        error: AppTokens.danger,
      ),
      scaffoldBackgroundColor: AppTokens.background,
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          color: AppTokens.primaryStrong,
          fontFamily: 'Georgia',
          fontWeight: FontWeight.bold,
        ),
        bodyLarge: TextStyle(color: AppTokens.text),
        bodyMedium: TextStyle(color: AppTokens.textMuted),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppTokens.surfaceSoft,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppTokens.spacing16,
          vertical: AppTokens.spacing16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius12),
          borderSide: const BorderSide(color: AppTokens.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppTokens.radius12),
          borderSide: const BorderSide(color: AppTokens.border),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(AppTokens.touchTarget),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTokens.radius12),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(AppTokens.touchTarget, AppTokens.touchTarget),
        ),
      ),
    );
  }
}
