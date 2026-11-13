import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<BusTrackerController>();
    final isDark = controller.isDarkMode;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'BusBridge',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  OutlinedButton.icon(
                    onPressed: controller.toggleTheme,
                    icon: Icon(
                      isDark ? Icons.wb_sunny_rounded : Icons.nightlight_round,
                      size: 18,
                    ),
                    label: Text(isDark ? 'Day Mode' : 'Night Mode'),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 44),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  Container(
                    height: 200,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.navy, Color(0xFF1E3A8A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.emerald.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Text(
                            'Live Transit · Shared by Riders',
                            style: TextStyle(
                              color: AppColors.emerald,
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const Row(
                          children: [
                            Icon(
                              Icons.directions_bus_filled_rounded,
                              size: 48,
                              color: Colors.white,
                            ),
                            SizedBox(width: 14),
                            Expanded(
                              child: Text(
                                'Real-time bus tracking powered by commuters onboard.',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  height: 1.25,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Know exactly where your bus is',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'When onboard passengers share their live GPS, waiting commuters get filtered bus positions, live traffic overlays, and accurate ETAs.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: isDark
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF475569),
                          height: 1.5,
                        ),
                  ),
                  const SizedBox(height: 24),
                  _FeatureRow(
                    icon: Icons.location_on_rounded,
                    color: AppColors.amber,
                    title: 'Waiting at a stop',
                    subtitle:
                        'See bus distance, estimated arrival time, and other waiting riders.',
                  ),
                  const Divider(height: 24),
                  _FeatureRow(
                    icon: Icons.sensors_rounded,
                    color: AppColors.emerald,
                    title: 'Boarded the bus',
                    subtitle:
                        'Tap once to share your GPS. Multiple signals combine with outlier rejection.',
                  ),
                  const Divider(height: 24),
                  _FeatureRow(
                    icon: Icons.verified_user_rounded,
                    color: AppColors.cobalt,
                    title: 'Privacy by default',
                    subtitle:
                        'No registration required. Pause sharing anytime or tap I’ve Reached.',
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: FilledButton.icon(
                onPressed: () =>
                    controller.navigateTo(AppRouteScreen.enterName),
                icon: const Icon(Icons.arrow_forward_rounded),
                label: const Text('Get Started'),
                style: FilledButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  backgroundColor:
                      isDark ? AppColors.cobalt : AppColors.navy,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 13,
                  color: Theme.of(context).brightness == Brightness.dark
                      ? const Color(0xFF94A3B8)
                      : const Color(0xFF475569),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
