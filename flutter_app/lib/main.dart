import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/enter_name_screen.dart';
import 'screens/join_bus_screen.dart';
import 'screens/location_permission_screen.dart';
import 'screens/passenger_list_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/tracking_workspace_screen.dart';
import 'screens/welcome_screen.dart';
import 'state/bus_tracker_controller.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => BusTrackerController(),
      child: const BusBridgeApp(),
    ),
  );
}

class BusBridgeApp extends StatelessWidget {
  const BusBridgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<BusTrackerController>();

    return MaterialApp(
      title: 'BusBridge',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: controller.themeMode,
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        child: switch (controller.screen) {
          AppRouteScreen.splash => SplashScreen(
              key: const ValueKey('splash'),
              onComplete: controller.completeSplash,
            ),
          AppRouteScreen.welcome => const WelcomeScreen(
              key: ValueKey('welcome'),
            ),
          AppRouteScreen.enterName => const EnterNameScreen(
              key: ValueKey('enterName'),
            ),
          AppRouteScreen.locationPermission => const LocationPermissionScreen(
              key: ValueKey('locationPermission'),
            ),
          AppRouteScreen.joinBus => const JoinBusScreen(
              key: ValueKey('joinBus'),
            ),
          AppRouteScreen.tracking => const TrackingWorkspaceScreen(
              key: ValueKey('tracking'),
            ),
          AppRouteScreen.passengers => const PassengerListScreen(
              key: ValueKey('passengers'),
            ),
          AppRouteScreen.settings => const SettingsScreen(
              key: ValueKey('settings'),
            ),
        },
      ),
    );
  }
}
