import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class LocationPermissionScreen extends StatefulWidget {
  const LocationPermissionScreen({super.key});

  @override
  State<LocationPermissionScreen> createState() =>
      _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends State<LocationPermissionScreen> {
  bool _requesting = false;

  Future<void> _grantAndContinue() async {
    setState(() => _requesting = true);
    final ctrl = context.read<BusTrackerController>();
    await ctrl.requestLocationAccess();
    if (mounted) {
      setState(() => _requesting = false);
      await ctrl.refreshSessions();
      ctrl.navigateTo(AppRouteScreen.joinBus);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<BusTrackerController>();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => ctrl.navigateTo(AppRouteScreen.enterName),
        ),
        title: const Text('Location Access'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppColors.cobalt.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: AppColors.cobalt,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.my_location_rounded,
                        color: Colors.white,
                        size: 32,
                      ),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Why BusBridge needs GPS',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Waiting riders see distance & ETA to their stop. Onboard riders share live bus coordinates with the session—only while sharing is enabled.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13, height: 1.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (ctrl.hasLocationPermission && ctrl.myLocation != null)
                const ListTile(
                  leading: Icon(Icons.check_circle, color: AppColors.emerald),
                  title: Text('GPS Ready'),
                  subtitle: Text('Location permission granted and verified.'),
                ),
              if (ctrl.locationError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    ctrl.locationError!,
                    style: const TextStyle(color: AppColors.amber, fontSize: 13),
                  ),
                ),
              const Spacer(),
              FilledButton.icon(
                onPressed: _requesting ? null : _grantAndContinue,
                icon: const Icon(Icons.gps_fixed_rounded),
                label: Text(
                  _requesting
                      ? 'Checking GPS...'
                      : ctrl.hasLocationPermission
                          ? 'Continue to Routes'
                          : 'Enable Location Access',
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () {
                  ctrl.refreshSessions();
                  ctrl.navigateTo(AppRouteScreen.joinBus);
                },
                style: TextButton.styleFrom(
                  minimumSize: const Size(double.infinity, 44),
                ),
                child: const Text('Skip for now (tap map to set waiting stop)'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
