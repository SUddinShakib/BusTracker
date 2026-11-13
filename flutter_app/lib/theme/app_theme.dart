import 'package:flutter/material.dart';

class AppColors {
  static const Color navy = Color(0xFF0F172A);
  static const Color cobalt = Color(0xFF2563EB);
  static const Color emerald = Color(0xFF10B981);
  static const Color amber = Color(0xFFF59E0B);
  static const Color danger = Color(0xFFEF4444);

  static const Color lightBg = Color(0xFFF8FAFC);
  static const Color lightCard = Colors.white;
  static const Color lightBorder = Color(0xFFE2E8F0);

  static const Color darkBg = Color(0xFF020617);
  static const Color darkCard = Color(0xFF0F172A);
  static const Color darkBorder = Color(0xFF1E293B);
}

class AppTheme {
  static ThemeData light() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.lightBg,
      colorScheme: const ColorScheme.light(
        primary: AppColors.cobalt,
        secondary: AppColors.emerald,
        surface: AppColors.lightCard,
        error: AppColors.danger,
      ),
      cardTheme: CardThemeData(
        color: AppColors.lightCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.lightBorder),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.lightCard,
        foregroundColor: AppColors.navy,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.cobalt, width: 2),
        ),
      ),
    );
  }

  static ThemeData dark() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.darkBg,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.cobalt,
        secondary: AppColors.emerald,
        surface: AppColors.darkCard,
        error: AppColors.danger,
      ),
      cardTheme: CardThemeData(
        color: AppColors.darkCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.darkBorder),
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkCard,
        foregroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.darkBg,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.cobalt, width: 2),
        ),
      ),
    );
  }

  static const String darkMapStyle = '''
[
  {"elementType": "geometry", "stylers": [{"color": "#0f172a"}]},
  {"elementType": "labels.text.fill", "stylers": [{"color": "#94a3b8"}]},
  {"elementType": "labels.text.stroke", "stylers": [{"color": "#020617"}]},
  {"featureType": "road", "elementType": "geometry", "stylers": [{"color": "#1e293b"}]},
  {"featureType": "road.highway", "elementType": "geometry", "stylers": [{"color": "#334155"}]},
  {"featureType": "water", "elementType": "geometry", "stylers": [{"color": "#020617"}]},
  {"featureType": "poi", "elementType": "labels", "stylers": [{"visibility": "off"}]}
]
''';
}
