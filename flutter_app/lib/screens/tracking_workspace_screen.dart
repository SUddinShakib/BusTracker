import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';
import '../models/bus_models.dart';
import '../services/location_aggregation.dart';
import '../services/realtime_ws_service.dart';
import '../state/bus_tracker_controller.dart';
import '../theme/app_theme.dart';

class TrackingWorkspaceScreen extends StatefulWidget {
  const TrackingWorkspaceScreen({super.key});

  @override
  State<TrackingWorkspaceScreen> createState() =>
      _TrackingWorkspaceScreenState();
}

class _TrackingWorkspaceScreenState extends State<TrackingWorkspaceScreen> {
  GoogleMapController? _mapController;
  bool _followBus = true;
  int _selectedTab = 0; // 0: Live Overview, 1: Waiting, 2: Onboard
  int _lastAnimatedBusTs = 0;

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }

  Future<void> _centerOnBus(AggregatedBusLocation bus) async {
    final controller = _mapController;
    if (controller == null) return;
    await controller.animateCamera(
      CameraUpdate.newLatLngZoom(LatLng(bus.latitude, bus.longitude), 15),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = context.watch<BusTrackerController>();
    final snapshot = ctrl.snapshot;
    final me = ctrl.currentPassenger;
    if (snapshot == null || me == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final session = snapshot.session;
    final bus = snapshot.aggregatedBus;
    final isDark = ctrl.isDarkMode;

    // Auto-follow bus only when a newer aggregated position arrives
    if (_followBus &&
        bus != null &&
        _mapController != null &&
        bus.timestamp != _lastAnimatedBusTs) {
      _lastAnimatedBusTs = bus.timestamp;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _mapController?.animateCamera(
          CameraUpdate.newLatLng(LatLng(bus.latitude, bus.longitude)),
        );
      });
    }

    final myLatLng = ctrl.myLocation != null
        ? LatLng(ctrl.myLocation!.latitude, ctrl.myLocation!.longitude)
        : (me.location != null
            ? LatLng(me.location!.latitude, me.location!.longitude)
            : null);

    // Distance & ETA from bus to waiting passenger
    String distanceLabel = '—';
    String etaLabel = 'Awaiting onboard GPS';
    if (bus != null && myLatLng != null) {
      final meters = haversineMeters(
        bus.latitude,
        bus.longitude,
        myLatLng.latitude,
        myLatLng.longitude,
      );
      distanceLabel = formatDistance(meters);
      etaLabel = formatEtaFromDistance(meters, bus.speed);
    } else if (bus != null) {
      etaLabel = 'Tap map to set stop';
    }

    // Map markers, polylines, circles
    final markers = <Marker>{};
    final circles = <Circle>{};
    final polylines = <Polyline>{};

    if (session.stops.length >= 2) {
      polylines.add(
        Polyline(
          polylineId: const PolylineId('route_corridor'),
          points: session.stops
              .map((s) => LatLng(s.latitude, s.longitude))
              .toList(),
          color: AppColors.cobalt,
          width: 5,
        ),
      );
    }

    for (final stop in session.stops) {
      markers.add(
        Marker(
          markerId: MarkerId('stop_${stop.id}'),
          position: LatLng(stop.latitude, stop.longitude),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueAzure,
          ),
          infoWindow: InfoWindow(
            title: '${stop.order + 1}. ${stop.name}',
            snippet: 'Bus Stop',
          ),
        ),
      );
    }

    for (final p in snapshot.passengers) {
      final loc = p.location;
      if (loc == null) continue;
      final isSelf = p.id == me.id;
      final label = isSelf
          ? '${p.displayName} (You)'
          : (p.shareName ? p.displayName : 'Rider ${p.id.substring(0, 4)}');

      if (p.passengerStatus == PassengerStatus.waiting) {
        markers.add(
          Marker(
            markerId: MarkerId('p_${p.id}'),
            position: LatLng(loc.latitude, loc.longitude),
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueOrange,
            ),
            infoWindow: InfoWindow(
              title: label,
              snippet: 'Waiting for bus',
            ),
          ),
        );
      } else if (p.passengerStatus == PassengerStatus.onboardSharing &&
          loc.isSharing) {
        markers.add(
          Marker(
            markerId: MarkerId('c_${p.id}'),
            position: LatLng(loc.latitude, loc.longitude),
            icon: BitmapDescriptor.defaultMarkerWithHue(
              BitmapDescriptor.hueGreen,
            ),
            alpha: 0.72,
            infoWindow: InfoWindow(
              title: label,
              snippet: 'Onboard GPS (±${loc.accuracy.round()}m)',
            ),
          ),
        );
      }
    }

    if (bus != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('aggregated_bus'),
          position: LatLng(bus.latitude, bus.longitude),
          zIndex: 10,
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueViolet,
          ),
          infoWindow: InfoWindow(
            title: '${session.sessionName} (Shared Bus)',
            snippet:
                '${bus.activeContributors} sharing · ±${bus.accuracy}m accuracy',
          ),
        ),
      );
      circles.add(
        Circle(
          circleId: const CircleId('bus_accuracy_halo'),
          center: LatLng(bus.latitude, bus.longitude),
          radius: bus.accuracy.toDouble().clamp(15, 250),
          fillColor: AppColors.cobalt.withValues(alpha: 0.14),
          strokeColor: AppColors.cobalt.withValues(alpha: 0.5),
          strokeWidth: 1,
        ),
      );
    }

    final initialTarget = bus != null
        ? LatLng(bus.latitude, bus.longitude)
        : (session.stops.isNotEmpty
            ? LatLng(
                session.stops.first.latitude,
                session.stops.first.longitude,
              )
            : const LatLng(37.7749, -122.4194));

    final waitingCount = snapshot.passengers
        .where((p) => p.passengerStatus == PassengerStatus.waiting)
        .length;
    final onboardCount = snapshot.passengers
        .where((p) =>
            p.passengerStatus == PassengerStatus.onboardSharing ||
            p.passengerStatus == PassengerStatus.onboardNotSharing)
        .length;
    final sharingCount = snapshot.passengers
        .where((p) => p.passengerStatus == PassengerStatus.onboardSharing)
        .length;

    return Scaffold(
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: initialTarget,
              zoom: 14.2,
            ),
            onMapCreated: (c) => _mapController = c,
            style: isDark ? AppTheme.darkMapStyle : null,
            trafficEnabled: ctrl.trafficLayerEnabled,
            myLocationEnabled: ctrl.hasLocationPermission,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            markers: markers,
            polylines: polylines,
            circles: circles,
            gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
              Factory<OneSequenceGestureRecognizer>(
                () => EagerGestureRecognizer(),
              ),
            },
            onTap: (latLng) {
              if (me.passengerStatus == PassengerStatus.waiting) {
                ctrl.setManualWaitingPin(latLng.latitude, latLng.longitude);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Updated your waiting stop location.'),
                    duration: Duration(seconds: 2),
                  ),
                );
              }
            },
          ),

          // Top Session Pill Header
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Material(
                    elevation: 3,
                    borderRadius: BorderRadius.circular(18),
                    color: isDark ? AppColors.darkCard : Colors.white,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      child: Row(
                        children: [
                          IconButton(
                            onPressed: () =>
                                ctrl.navigateTo(AppRouteScreen.joinBus),
                            icon: const Icon(Icons.swap_horiz_rounded),
                            tooltip: 'Switch route',
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${session.sessionCode} · ${session.sessionName}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  ctrl.wsState == WsConnectionState.connected
                                      ? '$sharingCount sharing · $waitingCount waiting'
                                      : 'Reconnecting live feed...',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: ctrl.wsState ==
                                            WsConnectionState.connected
                                        ? AppColors.emerald
                                        : AppColors.amber,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            tooltip: 'Passengers',
                            onPressed: () =>
                                ctrl.navigateTo(AppRouteScreen.passengers),
                            icon: const Icon(Icons.groups_rounded),
                          ),
                          IconButton(
                            tooltip: 'Settings',
                            onPressed: () =>
                                ctrl.navigateTo(AppRouteScreen.settings),
                            icon: const Icon(Icons.tune_rounded),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (ctrl.busApproachingAlert) ...[
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.amber,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.notifications_active_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Bus is within 500m of your waiting stop!',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Floating Map Controls
          Positioned(
            right: 14,
            bottom: 340,
            child: Column(
              children: [
                FloatingActionButton.small(
                  heroTag: 'traffic_btn',
                  backgroundColor: isDark ? AppColors.darkCard : Colors.white,
                  foregroundColor: ctrl.trafficLayerEnabled
                      ? AppColors.cobalt
                      : Colors.grey,
                  onPressed: () => ctrl.updateSettings(
                    trafficLayerEnabled: !ctrl.trafficLayerEnabled,
                  ),
                  child: const Icon(Icons.traffic_rounded),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'follow_btn',
                  backgroundColor: isDark ? AppColors.darkCard : Colors.white,
                  foregroundColor:
                      _followBus ? AppColors.cobalt : Colors.grey,
                  onPressed: () {
                    setState(() => _followBus = !_followBus);
                    if (_followBus && bus != null) _centerOnBus(bus);
                  },
                  child: const Icon(Icons.directions_bus_rounded),
                ),
                const SizedBox(height: 8),
                FloatingActionButton.small(
                  heroTag: 'gps_btn',
                  backgroundColor: isDark ? AppColors.darkCard : Colors.white,
                  onPressed: () async {
                    await ctrl.refreshCurrentLocation();
                    if (ctrl.myLocation != null) {
                      await _mapController?.animateCamera(
                        CameraUpdate.newLatLngZoom(
                          LatLng(
                            ctrl.myLocation!.latitude,
                            ctrl.myLocation!.longitude,
                          ),
                          15.5,
                        ),
                      );
                    }
                  },
                  child: const Icon(Icons.my_location_rounded),
                ),
              ],
            ),
          ),

          // Draggable Bottom Control Panel (Map Status + Waiting + Onboard)
          DraggableScrollableSheet(
            initialChildSize: 0.40,
            minChildSize: 0.24,
            maxChildSize: 0.72,
            builder: (context, scrollCtrl) {
              return Container(
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkCard : Colors.white,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(26),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.16),
                      blurRadius: 20,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 28),
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey.withValues(alpha: 0.4),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Segmented Sub-View Switcher (Map Overview | Waiting | Onboard)
                    SegmentedButton<int>(
                      segments: const [
                        ButtonSegment(value: 0, label: Text('Live Status')),
                        ButtonSegment(value: 1, label: Text('Waiting')),
                        ButtonSegment(value: 2, label: Text('Onboard')),
                      ],
                      selected: {_selectedTab},
                      onSelectionChanged: (s) =>
                          setState(() => _selectedTab = s.first),
                    ),
                    const SizedBox(height: 14),

                    // Key Metrics Row
                    Row(
                      children: [
                        _MetricTile(
                          label: 'Distance',
                          value: distanceLabel,
                        ),
                        const SizedBox(width: 8),
                        _MetricTile(
                          label: 'Est. Arrival',
                          value: etaLabel,
                          highlight: bus != null,
                        ),
                        const SizedBox(width: 8),
                        _MetricTile(
                          label: 'Sharers',
                          value: '$sharingCount / $onboardCount',
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Sub-view details
                    if (_selectedTab == 1) ...[
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                "I'm Waiting Here",
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '$waitingCount riders waiting across this route. Tap anywhere on the map to move your waiting stop pin.',
                                style: const TextStyle(fontSize: 12),
                              ),
                              if (me.passengerStatus !=
                                  PassengerStatus.waiting) ...[
                                const SizedBox(height: 10),
                                OutlinedButton(
                                  onPressed: ctrl.returnToWaiting,
                                  child: const Text('Switch Back to Waiting'),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    if (_selectedTab == 2 ||
                        me.passengerStatus == PassengerStatus.onboardSharing ||
                        me.passengerStatus ==
                            PassengerStatus.onboardNotSharing) ...[
                      Card(
                        color: me.passengerStatus ==
                                PassengerStatus.onboardSharing
                            ? AppColors.emerald.withValues(alpha: 0.12)
                            : null,
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    Icons.sensors_rounded,
                                    color: me.passengerStatus ==
                                            PassengerStatus.onboardSharing
                                        ? AppColors.emerald
                                        : AppColors.amber,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    me.passengerStatus.label,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                bus != null
                                    ? 'Confidence: ${bus.confidenceLabel.label} · ${bus.outliersFiltered} outlier(s) filtered · ±${bus.accuracy}m'
                                    : 'Waiting for first valid onboard GPS packet...',
                                style: const TextStyle(fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Primary Action Buttons
                    if (me.passengerStatus == PassengerStatus.waiting ||
                        me.passengerStatus ==
                            PassengerStatus.reachedDestination) ...[
                      FilledButton.icon(
                        onPressed: ctrl.boardBusAndStartSharing,
                        icon: const Icon(Icons.directions_bus_rounded),
                        label: const Text(
                          '🚌 I Got Into the Bus – Start Sharing',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(double.infinity, 56),
                          backgroundColor: AppColors.emerald,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ] else if (me.passengerStatus ==
                        PassengerStatus.onboardSharing) ...[
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: ctrl.pauseSharing,
                              icon: const Icon(Icons.pause_circle_outline),
                              label: const Text('Pause Sharing'),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 52),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: ctrl.markReachedDestination,
                              icon: const Icon(Icons.flag_rounded),
                              label: const Text("I've Reached"),
                              style: FilledButton.styleFrom(
                                minimumSize: const Size(0, 52),
                                backgroundColor: AppColors.navy,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ] else if (me.passengerStatus ==
                        PassengerStatus.onboardNotSharing) ...[
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: ctrl.resumeSharing,
                              icon: const Icon(Icons.play_arrow_rounded),
                              label: const Text('Resume GPS'),
                              style: FilledButton.styleFrom(
                                minimumSize: const Size(0, 52),
                                backgroundColor: AppColors.emerald,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: ctrl.markReachedDestination,
                              icon: const Icon(Icons.flag_rounded),
                              label: const Text("I've Reached"),
                              style: FilledButton.styleFrom(
                                minimumSize: const Size(0, 52),
                                backgroundColor: AppColors.navy,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: highlight
              ? AppColors.cobalt.withValues(alpha: 0.1)
              : (isDark ? AppColors.darkBg : const Color(0xFFF1F5F9)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: highlight ? AppColors.cobalt : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
