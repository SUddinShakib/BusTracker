import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/bus_models.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class PassengerListScreen extends StatefulWidget {
  const PassengerListScreen({super.key});

  @override
  State<PassengerListScreen> createState() => _PassengerListScreenState();
}

class _PassengerListScreenState extends State<PassengerListScreen> {
  PassengerStatus? _filter;

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<BusTrackerController>();
    final snapshot = ctrl.snapshot;
    if (snapshot == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Passengers')),
        body: const Center(child: Text('No active session')),
      );
    }

    final list = _filter == null
        ? snapshot.passengers
        : snapshot.passengers
            .where((p) => p.passengerStatus == _filter)
            .toList();

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => ctrl.navigateTo(AppRouteScreen.tracking),
        ),
        title: Text('${snapshot.session.sessionCode} Riders'),
      ),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                FilterChip(
                  label: Text('All (${snapshot.passengers.length})'),
                  selected: _filter == null,
                  onSelected: (_) => setState(() => _filter = null),
                ),
                const SizedBox(width: 8),
                ...PassengerStatus.values.map(
                  (status) => Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(status.label),
                      selected: _filter == status,
                      onSelected: (_) => setState(() => _filter = status),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, idx) {
                final p = list[idx];
                final isMe = p.id == ctrl.currentPassenger?.id;
                final displayName = isMe
                    ? '${p.displayName} (You)'
                    : (p.shareName
                        ? p.displayName
                        : 'Rider #${p.id.substring(0, 4)}');

                final statusColor = switch (p.passengerStatus) {
                  PassengerStatus.onboardSharing => AppColors.emerald,
                  PassengerStatus.onboardNotSharing => AppColors.cobalt,
                  PassengerStatus.waiting => AppColors.amber,
                  PassengerStatus.reachedDestination => const Color(0xFF64748B),
                  PassengerStatus.disconnected => AppColors.danger,
                };

                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: statusColor.withValues(alpha: 0.16),
                      child: Icon(
                        p.passengerStatus == PassengerStatus.waiting
                            ? Icons.person_pin_circle_rounded
                            : Icons.directions_bus_rounded,
                        color: statusColor,
                      ),
                    ),
                    title: Text(
                      displayName,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      p.passengerStatus.label,
                      style: TextStyle(color: statusColor, fontSize: 12),
                    ),
                    trailing: p.location != null
                        ? Text(
                            '±${p.location!.accuracy.round()}m',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                            ),
                          )
                        : null,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
