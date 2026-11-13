import type {
  AggregatedBusLocation,
  ConfidenceLabel,
  Passenger,
  PassengerLocation,
} from './types.ts';

const EARTH_RADIUS_METERS = 6371000;

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine distance in meters between two geographic coordinates.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface AggregationCandidate {
  passenger: Passenger;
  location: PassengerLocation;
}

export interface AggregationOptions {
  nowMs?: number;
  maxAgeMs?: number;
  maxAcceptableAccuracyMeters?: number;
}

/**
 * Intelligent multi-passenger GPS aggregation engine.
 *
 * 1. Filters strictly to passengers whose status is `onboard_sharing` and `isSharing === true`.
 *    Waiting passengers at stops never contribute to the bus position.
 * 2. Discards stale GPS readings older than `maxAgeMs` (default 45s) so disconnected phones
 *    don't drag the bus marker backward.
 * 3. Rejects coarse readings (> 150m accuracy) whenever higher-precision signals exist.
 * 4. Filters stationary outliers if a moving onboard cluster (> 1.5 m/s) exists and a stray
 *    reading is stationary (< 0.3 m/s) more than 120m away.
 * 5. Performs spatial outlier rejection using geographic median + Median Absolute Deviation (MAD)
 *    when >= 3 contributors are active.
 * 6. Computes an inverse-variance & exponential-recency weighted centroid, plus circular mean
 *    heading and weighted speed.
 */
export function aggregateBusLocation(
  sessionId: string,
  passengers: Passenger[],
  options: AggregationOptions = {}
): AggregatedBusLocation | null {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? 45_000;
  const maxAcceptableAccuracyMeters = options.maxAcceptableAccuracyMeters ?? 150;

  // Step 1 & 2: Only onboard_sharing with fresh, sharing GPS readings
  const activeCandidates: AggregationCandidate[] = passengers
    .filter((p) => {
      if (p.passengerStatus !== 'onboard_sharing') return false;
      if (!p.location || !p.location.isSharing) return false;
      if (
        !Number.isFinite(p.location.latitude) ||
        !Number.isFinite(p.location.longitude)
      ) {
        return false;
      }
      const age = nowMs - p.location.timestamp;
      return age >= -10_000 && age <= maxAgeMs;
    })
    .map((p) => ({
      passenger: p,
      location: p.location!,
    }));

  if (activeCandidates.length === 0) {
    return null;
  }

  // Step 3: Filter coarse accuracy readings if better signals exist
  const accurateCandidates = activeCandidates.filter(
    (c) => (c.location.accuracy || 25) <= maxAcceptableAccuracyMeters
  );
  let pool =
    accurateCandidates.length > 0 ? accurateCandidates : activeCandidates;
  const onlyCoarseSignals = accurateCandidates.length === 0;

  // Single contributor shortcut — preserve exact reading, mark single_signal
  if (pool.length === 1) {
    const single = pool[0].location;
    const accuracy = Math.max(5, Math.round(single.accuracy || 15));
    const confidenceLabel: ConfidenceLabel =
      onlyCoarseSignals || accuracy > 80 ? 'low_confidence' : 'single_signal';

    return {
      id: `agg_${sessionId}`,
      sessionId,
      latitude: single.latitude,
      longitude: single.longitude,
      accuracy,
      heading: single.heading,
      speed: single.speed,
      activeContributors: 1,
      outliersFiltered: activeCandidates.length - 1,
      confidenceLabel,
      isEstimated: false,
      timestamp: single.timestamp,
    };
  }

  // Step 4: Guard against stationary readings far from a moving onboard cluster
  const movingReadings = pool.filter(
    (c) => c.location.speed !== null && c.location.speed > 1.5
  );
  let stationaryOutliersRemoved = 0;

  if (movingReadings.length >= 2) {
    const movingMedLat = median(movingReadings.map((c) => c.location.latitude));
    const movingMedLng = median(
      movingReadings.map((c) => c.location.longitude)
    );

    const filteredMoving = pool.filter((c) => {
      const spd = c.location.speed;
      if (spd !== null && spd < 0.3) {
        const distFromCluster = haversineMeters(
          c.location.latitude,
          c.location.longitude,
          movingMedLat,
          movingMedLng
        );
        if (distFromCluster > 120) {
          stationaryOutliersRemoved += 1;
          return false;
        }
      }
      return true;
    });

    if (filteredMoving.length > 0) {
      pool = filteredMoving;
    }
  }

  // Step 5: Spatial outlier rejection via geographic median & MAD
  let spatialOutliersRemoved = 0;
  if (pool.length >= 3) {
    const medLat = median(pool.map((c) => c.location.latitude));
    const medLng = median(pool.map((c) => c.location.longitude));

    const distances = pool.map((c) =>
      haversineMeters(
        c.location.latitude,
        c.location.longitude,
        medLat,
        medLng
      )
    );
    const medDist = median(distances);
    const absDevs = distances.map((d) => Math.abs(d - medDist));
    const mad = median(absDevs);
    const thresholdMeters = Math.max(120, medDist + 3 * mad);

    const inliers = pool.filter((_, idx) => distances[idx] <= thresholdMeters);
    if (inliers.length >= 1) {
      spatialOutliersRemoved = pool.length - inliers.length;
      pool = inliers;
    }
  } else if (pool.length === 2) {
    // If 2 signals disagree by > 600m, prefer the fresher + more accurate reading
    const d = haversineMeters(
      pool[0].location.latitude,
      pool[0].location.longitude,
      pool[1].location.latitude,
      pool[1].location.longitude
    );
    if (d > 600) {
      const score = (c: AggregationCandidate) => {
        const ageSec = Math.max(0, (nowMs - c.location.timestamp) / 1000);
        const acc = Math.max(5, c.location.accuracy || 25);
        return 1 / (acc * acc) * Math.exp(-ageSec / 15);
      };
      pool = [score(pool[0]) >= score(pool[1]) ? pool[0] : pool[1]];
      spatialOutliersRemoved = 1;
    }
  }

  // Step 6: Inverse-variance & recency weighted centroid
  let weightSum = 0;
  let weightedLat = 0;
  let weightedLng = 0;
  let invVarianceSum = 0;
  let latestTimestamp = 0;

  let headingSinSum = 0;
  let headingCosSum = 0;
  let headingWeightSum = 0;

  let speedWeightedSum = 0;
  let speedWeightSum = 0;

  for (const item of pool) {
    const loc = item.location;
    const clampedAcc = Math.max(5, loc.accuracy || 20);
    const ageMs = Math.max(0, nowMs - loc.timestamp);

    const accWeight = 1 / (clampedAcc * clampedAcc);
    const recencyWeight = Math.exp(-ageMs / 15_000);
    const w = accWeight * recencyWeight;

    weightSum += w;
    invVarianceSum += accWeight;
    weightedLat += w * loc.latitude;
    weightedLng += w * loc.longitude;
    if (loc.timestamp > latestTimestamp) {
      latestTimestamp = loc.timestamp;
    }

    if (loc.heading !== null && Number.isFinite(loc.heading)) {
      const rad = toRadians(loc.heading);
      headingSinSum += w * Math.sin(rad);
      headingCosSum += w * Math.cos(rad);
      headingWeightSum += w;
    }

    if (loc.speed !== null && Number.isFinite(loc.speed)) {
      speedWeightedSum += w * loc.speed;
      speedWeightSum += w;
    }
  }

  const finalLat = weightedLat / weightSum;
  const finalLng = weightedLng / weightSum;

  // Estimate spread penalty from contributor dispersion around centroid
  const meanSpread =
    pool.reduce(
      (sum, item) =>
        sum +
        haversineMeters(
          item.location.latitude,
          item.location.longitude,
          finalLat,
          finalLng
        ),
      0
    ) / pool.length;

  const combinedPrecision = 1 / Math.sqrt(invVarianceSum);
  const finalAccuracy = Math.max(
    5,
    Math.round(combinedPrecision + meanSpread * 0.35)
  );

  let finalHeading: number | null = null;
  if (headingWeightSum > 0) {
    const deg = toDegrees(Math.atan2(headingSinSum, headingCosSum));
    finalHeading = Math.round(((deg % 360) + 360) % 360);
  }

  const finalSpeed =
    speedWeightSum > 0
      ? Number((speedWeightedSum / speedWeightSum).toFixed(2))
      : null;

  const totalOutliersFiltered =
    (activeCandidates.length - pool.length);

  let confidenceLabel: ConfidenceLabel = 'multi_signal';
  if (pool.length === 1) {
    confidenceLabel =
      onlyCoarseSignals || finalAccuracy > 80 ? 'low_confidence' : 'single_signal';
  } else if (onlyCoarseSignals || finalAccuracy > 90) {
    confidenceLabel = 'low_confidence';
  }

  return {
    id: `agg_${sessionId}`,
    sessionId,
    latitude: Number(finalLat.toFixed(7)),
    longitude: Number(finalLng.toFixed(7)),
    accuracy: finalAccuracy,
    heading: finalHeading,
    speed: finalSpeed,
    activeContributors: pool.length,
    outliersFiltered: Math.max(
      totalOutliersFiltered,
      stationaryOutliersRemoved + spatialOutliersRemoved
    ),
    confidenceLabel,
    isEstimated: pool.length > 1,
    timestamp: latestTimestamp || nowMs,
  };
}
