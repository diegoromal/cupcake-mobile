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
        headlineSmall: TextStyle(
          color: AppTokens.primaryStrong,
          fontFamily: 'Georgia',
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
        headlineMedium: TextStyle(
          color: AppTokens.primaryStrong,
          fontFamily: 'Georgia',
          fontSize: 22,
          fontWeight: FontWeight.bold,
        ),
        titleLarge: TextStyle(
          color: AppTokens.text,
          fontFamily: 'Georgia',
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
        titleMedium: TextStyle(
          color: AppTokens.text,
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
        titleSmall: TextStyle(
          color: AppTokens.text,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
        bodyLarge: TextStyle(color: AppTokens.text, fontSize: 14),
        bodyMedium: TextStyle(color: AppTokens.textMuted, fontSize: 12),
        bodySmall: TextStyle(color: AppTokens.textMuted, fontSize: 10),
        labelLarge: TextStyle(color: AppTokens.text, fontSize: 12),
        labelMedium: TextStyle(color: AppTokens.text, fontSize: 11),
        labelSmall: TextStyle(color: AppTokens.textMuted, fontSize: 10),
      ),
      appBarTheme: const AppBarTheme(
        centerTitle: false,
        toolbarHeight: 48,
        backgroundColor: AppTokens.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleTextStyle: TextStyle(
          color: AppTokens.primaryStrong,
          fontFamily: 'Georgia',
          fontSize: 14,
          fontWeight: FontWeight.bold,
        ),
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
