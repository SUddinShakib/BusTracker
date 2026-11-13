import { useCallback, useEffect, useRef, useState } from 'react';

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface GpsReading {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isManual?: boolean;
}

interface UseGeolocationOptions {
  watchActive: boolean;
  minIntervalMs: number;
  onReading?: (reading: GpsReading) => void;
}

export function useGeolocation({
  watchActive,
  minIntervalMs,
  onReading,
}: UseGeolocationOptions) {
  const [permission, setPermission] = useState<GeolocationPermissionState>(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return 'unsupported';
    }
    return 'prompt';
  });
  const [location, setLocation] = useState<GpsReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const lastEmittedAtRef = useRef<number>(0);
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;

  // Query browser permission status if supported
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) return;
    let mounted = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!mounted) return;
        setPermission(status.state as GeolocationPermissionState);
        status.onchange = () => {
          if (mounted) {
            setPermission(status.state as GeolocationPermissionState);
          }
        };
      })
      .catch(() => {
        // Ignore browsers that block permissions.query for geolocation
      });
    return () => {
      mounted = false;
    };
  }, []);

  const requestCurrentPosition = useCallback((): Promise<GpsReading | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setPermission('unsupported');
        setError('Geolocation is not supported on this device.');
        resolve(null);
        return;
      }

      setIsRequesting(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reading: GpsReading = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy || 15),
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            timestamp: pos.timestamp || Date.now(),
            isManual: false,
          };
          setPermission('granted');
          setLocation(reading);
          setIsRequesting(false);
          lastEmittedAtRef.current = Date.now();
          onReadingRef.current?.(reading);
          resolve(reading);
        },
        (err) => {
          setIsRequesting(false);
          if (err.code === err.PERMISSION_DENIED) {
            setPermission('denied');
            setError('Location access was denied. You can still select your stop on the map.');
          } else if (err.code === err.TIMEOUT) {
            setError('GPS signal timed out. Try moving near a window or pick a stop manually.');
          } else {
            setError('Unable to determine GPS position right now.');
          }
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10_000,
          maximumAge: 5_000,
        }
      );
    });
  }, []);

  const setManualLocation = useCallback((lat: number, lng: number) => {
    const reading: GpsReading = {
      latitude: lat,
      longitude: lng,
      accuracy: 25,
      heading: null,
      speed: 0,
      timestamp: Date.now(),
      isManual: true,
    };
    setLocation(reading);
    setError(null);
    lastEmittedAtRef.current = Date.now();
    onReadingRef.current?.(reading);
    return reading;
  }, []);

  // Continuous live GPS watch when active (e.g., Onboard sharing)
  useEffect(() => {
    if (!watchActive || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastEmittedAtRef.current < minIntervalMs - 300) {
          return;
        }
        lastEmittedAtRef.current = now;

        const reading: GpsReading = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 15),
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
          timestamp: now,
          isManual: false,
        };
        setPermission('granted');
        setLocation(reading);
        setError(null);
        onReadingRef.current?.(reading);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission('denied');
          setError('Location permission denied.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: minIntervalMs,
        timeout: 12_000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [watchActive, minIntervalMs]);

  return {
    permission,
    location,
    error,
    isRequesting,
    requestCurrentPosition,
    setManualLocation,
  };
}
