import 'dart:math' as math;
import '../models/bus_models.dart';

const double _earthRadiusMeters = 6371000.0;

double _toRadians(double deg) => deg * math.pi / 180.0;
double _toDegrees(double rad) => rad * 180.0 / math.pi;

double haversineMeters(
  double lat1,
  double lng1,
  double lat2,
  double lng2,
) {
  final dLat = _toRadians(lat2 - lat1);
  final dLng = _toRadians(lng2 - lng1);
  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_toRadians(lat1)) *
          math.cos(_toRadians(lat2)) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);
  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return _earthRadiusMeters * c;
}

double _median(List<double> values) {
  if (values.isEmpty) return 0;
  final sorted = [...values]..sort();
  final mid = sorted.length ~/ 2;
  if (sorted.length.isEven) {
    return (sorted[mid - 1] + sorted[mid]) / 2.0;
  }
  return sorted[mid];
}

class _Candidate {
  _Candidate(this.passenger, this.location);
  final Passenger passenger;
  final PassengerLocation location;
}

/// Intelligent multi-passenger GPS aggregation engine (client mirror for offline/local preview):
/// - Accepts strictly `onboard_sharing` passengers with fresh (`<= 45s`) GPS signals.
/// - Excludes waiting passengers at stops from dragging the bus marker.
/// - Filters coarse accuracy (`> 150m`) when higher-precision signals exist.
/// - Guards against stray stationary signals far from a moving onboard cluster.
/// - Performs geographic median + MAD outlier filtering when >= 3 contributors are active.
/// - Computes inverse-variance & exponential-recency weighted centroid + circular heading.
AggregatedBusLocation? aggregateBusLocation(
  String sessionId,
  List<Passenger> passengers, {
  int? nowMs,
  int maxAgeMs = 45000,
  double maxAcceptableAccuracyMeters = 150.0,
}) {
  final now = nowMs ?? DateTime.now().millisecondsSinceEpoch;

  final activeCandidates = <_Candidate>[];
  for (final p in passengers) {
    if (p.passengerStatus != PassengerStatus.onboardSharing) continue;
    final loc = p.location;
    if (loc == null || !loc.isSharing) continue;
    if (!loc.latitude.isFinite || !loc.longitude.isFinite) continue;
    final age = now - loc.timestamp;
    if (age >= -10000 && age <= maxAgeMs) {
      activeCandidates.add(_Candidate(p, loc));
    }
  }

  if (activeCandidates.isEmpty) return null;

  final accurateCandidates = activeCandidates
      .where((c) => (c.location.accuracy <= 0 ? 25 : c.location.accuracy) <=
          maxAcceptableAccuracyMeters)
      .toList();

  var pool = accurateCandidates.isNotEmpty
      ? accurateCandidates
      : activeCandidates;
  final onlyCoarseSignals = accurateCandidates.isEmpty;

  if (pool.length == 1) {
    final single = pool.first.location;
    final acc = math.max(5, (single.accuracy <= 0 ? 15 : single.accuracy).round());
    final label = (onlyCoarseSignals || acc > 80)
        ? ConfidenceLabel.lowConfidence
        : ConfidenceLabel.singleSignal;

    return AggregatedBusLocation(
      id: 'agg_$sessionId',
      sessionId: sessionId,
      latitude: single.latitude,
      longitude: single.longitude,
      accuracy: acc,
      heading: single.heading,
      speed: single.speed,
      activeContributors: 1,
      outliersFiltered: activeCandidates.length - 1,
      confidenceLabel: label,
      isEstimated: false,
      timestamp: single.timestamp,
    );
  }

  // Stationary outlier guard around moving cluster
  final moving = pool
      .where((c) => c.location.speed != null && c.location.speed! > 1.5)
      .toList();
  var stationaryRemoved = 0;

  if (moving.length >= 2) {
    final medLat = _median(moving.map((c) => c.location.latitude).toList());
    final medLng = _median(moving.map((c) => c.location.longitude).toList());
    final filtered = <_Candidate>[];
    for (final c in pool) {
      final spd = c.location.speed;
      if (spd != null && spd < 0.3) {
        final dist = haversineMeters(
          c.location.latitude,
          c.location.longitude,
          medLat,
          medLng,
        );
        if (dist > 120) {
          stationaryRemoved++;
          continue;
        }
      }
      filtered.add(c);
    }
    if (filtered.isNotEmpty) pool = filtered;
  }

  // MAD spatial outlier rejection
  var spatialRemoved = 0;
  if (pool.length >= 3) {
    final medLat = _median(pool.map((c) => c.location.latitude).toList());
    final medLng = _median(pool.map((c) => c.location.longitude).toList());
    final distances = pool
        .map((c) => haversineMeters(
            c.location.latitude, c.location.longitude, medLat, medLng))
        .toList();
    final medDist = _median(distances);
    final absDevs = distances.map((d) => (d - medDist).abs()).toList();
    final mad = _median(absDevs);
    final threshold = math.max(120.0, medDist + 3 * mad);

    final inliers = <_Candidate>[];
    for (var i = 0; i < pool.length; i++) {
      if (distances[i] <= threshold) {
        inliers.add(pool[i]);
      }
    }
    if (inliers.isNotEmpty) {
      spatialRemoved = pool.length - inliers.length;
      pool = inliers;
    }
  } else if (pool.length == 2) {
    final d = haversineMeters(
      pool[0].location.latitude,
      pool[0].location.longitude,
      pool[1].location.latitude,
      pool[1].location.longitude,
    );
    if (d > 600) {
      double score(_Candidate c) {
        final ageSec = math.max(0.0, (now - c.location.timestamp) / 1000.0);
        final acc = math.max(5.0, c.location.accuracy <= 0 ? 25.0 : c.location.accuracy);
        return (1.0 / (acc * acc)) * math.exp(-ageSec / 15.0);
      }

      pool = [score(pool[0]) >= score(pool[1]) ? pool[0] : pool[1]];
      spatialRemoved = 1;
    }
  }

  double weightSum = 0;
  double weightedLat = 0;
  double weightedLng = 0;
  double invVarianceSum = 0;
  int latestTimestamp = 0;

  double headingSin = 0;
  double headingCos = 0;
  double headingWeight = 0;

  double speedSum = 0;
  double speedWeight = 0;

  for (final item in pool) {
    final loc = item.location;
    final clampedAcc = math.max(5.0, loc.accuracy <= 0 ? 20.0 : loc.accuracy);
    final ageMs = math.max(0, now - loc.timestamp);
    final accWeight = 1.0 / (clampedAcc * clampedAcc);
    final recencyWeight = math.exp(-ageMs / 15000.0);
    final w = accWeight * recencyWeight;

    weightSum += w;
    invVarianceSum += accWeight;
    weightedLat += w * loc.latitude;
    weightedLng += w * loc.longitude;
    if (loc.timestamp > latestTimestamp) latestTimestamp = loc.timestamp;

    if (loc.heading != null && loc.heading!.isFinite) {
      final rad = _toRadians(loc.heading!);
      headingSin += w * math.sin(rad);
      headingCos += w * math.cos(rad);
      headingWeight += w;
    }
    if (loc.speed != null && loc.speed!.isFinite) {
      speedSum += w * loc.speed!;
      speedWeight += w;
    }
  }

  final finalLat = weightedLat / weightSum;
  final finalLng = weightedLng / weightSum;

  final meanSpread = pool.fold<double>(
        0.0,
        (sum, item) =>
            sum +
            haversineMeters(
              item.location.latitude,
              item.location.longitude,
              finalLat,
              finalLng,
            ),
      ) /
      pool.length;

  final combinedPrecision = 1.0 / math.sqrt(invVarianceSum);
  final finalAccuracy =
      math.max(5, (combinedPrecision + meanSpread * 0.35).round());

  double? finalHeading;
  if (headingWeight > 0) {
    final deg = _toDegrees(math.atan2(headingSin, headingCos));
    finalHeading = (((deg % 360) + 360) % 360).roundToDouble();
  }

  final finalSpeed = speedWeight > 0
      ? double.parse((speedSum / speedWeight).toStringAsFixed(2))
      : null;

  var confidence = ConfidenceLabel.multiSignal;
  if (pool.length == 1) {
    confidence = (onlyCoarseSignals || finalAccuracy > 80)
        ? ConfidenceLabel.lowConfidence
        : ConfidenceLabel.singleSignal;
  } else if (onlyCoarseSignals || finalAccuracy > 90) {
    confidence = ConfidenceLabel.lowConfidence;
  }

  return AggregatedBusLocation(
    id: 'agg_$sessionId',
    sessionId: sessionId,
    latitude: double.parse(finalLat.toStringAsFixed(7)),
    longitude: double.parse(finalLng.toStringAsFixed(7)),
    accuracy: finalAccuracy,
    heading: finalHeading,
    speed: finalSpeed,
    activeContributors: pool.length,
    outliersFiltered: math.max(
      activeCandidates.length - pool.length,
      stationaryRemoved + spatialRemoved,
    ),
    confidenceLabel: confidence,
    isEstimated: pool.length > 1,
    timestamp: latestTimestamp > 0 ? latestTimestamp : now,
  );
}

String formatDistance(double meters) {
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}

String formatEtaFromDistance(double meters, double? speedMps) {
  final effectiveSpeed =
      (speedMps != null && speedMps > 2.0) ? speedMps : 7.5; // ~27 km/h fallback
  final seconds = (meters / effectiveSpeed).round();
  if (seconds < 60) return '< 1 min';
  final mins = (seconds / 60).round();
  if (mins < 60) return '$mins min';
  final hrs = mins ~/ 60;
  final rem = mins % 60;
  return '${hrs}h ${rem}m';
}
