import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _nameCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(
      text: context.read<BusTrackerController>().userName,
    );
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<BusTrackerController>();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => ctrl.navigateTo(
            ctrl.snapshot != null
                ? AppRouteScreen.tracking
                : AppRouteScreen.joinBus,
          ),
        ),
        title: const Text('Settings & Privacy'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Commuter Profile',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _nameCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Display Name',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton(
                        onPressed: _saving
                            ? null
                            : () async {
                                if (_nameCtrl.text.trim().length < 2) return;
                                setState(() => _saving = true);
                                await ctrl.saveProfile(_nameCtrl.text.trim());
                                if (mounted) {
                                  setState(() => _saving = false);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Profile name updated.'),
                                    ),
                                  );
                                }
                              },
                        child: Text(_saving ? '...' : 'Save'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  value: ctrl.shareName,
                  onChanged: (v) => ctrl.updateSettings(shareName: v),
                  title: const Text('Display my name to riders'),
                  subtitle: const Text(
                    'Turn off to show as an anonymous commuter ID',
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  title: const Text('GPS Broadcast Cadence'),
                  subtitle: Text(
                    ctrl.updateIntervalMs == 3000
                        ? '3 seconds (High Precision Live)'
                        : '5 seconds (Battery Saver)',
                  ),
                  trailing: SegmentedButton<int>(
                    segments: const [
                      ButtonSegment(value: 3000, label: Text('3s')),
                      ButtonSegment(value: 5000, label: Text('5s')),
                    ],
                    selected: {ctrl.updateIntervalMs},
                    onSelectionChanged: (s) =>
                        ctrl.updateSettings(updateIntervalMs: s.first),
                  ),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  value: ctrl.arrivalAlertsEnabled,
                  onChanged: (v) =>
                      ctrl.updateSettings(arrivalAlertsEnabled: v),
                  title: const Text('Bus Approaching Alert (500m)'),
                  subtitle: const Text(
                    'Highlight when the bus is within 500 meters',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Column(
              children: [
                SwitchListTile(
                  value: ctrl.isDarkMode,
                  onChanged: (_) => ctrl.toggleTheme(),
                  title: const Text('Night Commuter Dark Mode'),
                  subtitle: const Text('Dark UI + night-friendly Google Map'),
                ),
                const Divider(height: 1),
                SwitchListTile(
                  value: ctrl.trafficLayerEnabled,
                  onChanged: (v) =>
                      ctrl.updateSettings(trafficLayerEnabled: v),
                  title: const Text('Real-Time Traffic Layer'),
                  subtitle: const Text('Show live road congestion on map'),
                ),
              ],
            ),
          ),
          if (ctrl.snapshot != null) ...[
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: ctrl.leaveSession,
              icon: const Icon(Icons.logout_rounded, color: AppColors.danger),
              label: const Text(
                'Leave Current Bus Session',
                style: TextStyle(color: AppColors.danger),
              ),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: AppColors.danger),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
