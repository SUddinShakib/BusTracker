import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart' as ph;

class GpsSample {
  const GpsSample({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    this.heading,
    this.speed,
    required this.timestamp,
  });

  final double latitude;
  final double longitude;
  final double accuracy;
  final double? heading;
  final double? speed;
  final int timestamp;
}

class LocationService {
  StreamSubscription<Position>? _positionSub;
  int _lastEmitMs = 0;

  Future<bool> hasPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;
    final perm = await Geolocator.checkPermission();
    return perm == LocationPermission.always ||
        perm == LocationPermission.whileInUse;
  }

  Future<bool> requestPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      await Geolocator.openLocationSettings();
      return false;
    }

    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.deniedForever) {
      await ph.openAppSettings();
      return false;
    }
    return perm == LocationPermission.always ||
        perm == LocationPermission.whileInUse;
  }

  Future<GpsSample?> getCurrentPosition() async {
    final ok = await hasPermission();
    if (!ok) return null;
    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );
    return _fromPosition(pos);
  }

  void startWatching({
    required int intervalMs,
    required void Function(GpsSample sample) onSample,
    void Function(String error)? onError,
  }) {
    stopWatching();

    late LocationSettings settings;
    if (!kIsWeb && Platform.isAndroid) {
      settings = AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
        intervalDuration: Duration(milliseconds: intervalMs),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'BusBridge Live Sharing Active',
          notificationText:
              'Sharing live bus GPS with waiting passengers on your route.',
          enableWakeLock: true,
        ),
      );
    } else if (!kIsWeb && Platform.isIOS) {
      settings = AppleSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: 0,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
      );
    } else {
      settings = const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
      );
    }

    _positionSub = Geolocator.getPositionStream(locationSettings: settings).listen(
      (pos) {
        final now = DateTime.now().millisecondsSinceEpoch;
        if (now - _lastEmitMs < (intervalMs - 400)) return;
        _lastEmitMs = now;
        onSample(_fromPosition(pos));
      },
      onError: (err) => onError?.call(err.toString()),
    );
  }

  void stopWatching() {
    _positionSub?.cancel();
    _positionSub = null;
  }

  GpsSample _fromPosition(Position pos) {
    return GpsSample(
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy > 0 ? pos.accuracy : 15.0,
      heading: (pos.heading >= 0 && pos.heading.isFinite) ? pos.heading : null,
      speed: (pos.speed >= 0 && pos.speed.isFinite) ? pos.speed : null,
      timestamp: pos.timestamp.millisecondsSinceEpoch,
    );
  }
}
