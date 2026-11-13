import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapView,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Bus,
  Compass,
  Layers,
  LocateFixed,
  Minus,
  Moon,
  Plus,
  Sun,
  Users,
} from 'lucide-react';
import type {
  AggregatedBusLocation,
  BusSession,
  Passenger,
  RouteStop,
} from '../shared/types.ts';
import { haversineMeters } from '../shared/locationAggregation.ts';

export interface RouteEtaInfo {
  distanceMeters: number;
  durationMillis: number;
  source: 'routes_api' | 'speed_estimate';
  updatedAt: number;
}

interface LiveBusMapProps {
  session: BusSession;
  passengers: Passenger[];
  aggregatedBus: AggregatedBusLocation | null;
  currentPassengerId: string | null;
  userLocation: { lat: number; lng: number } | null;
  theme: 'light' | 'dark';
  trafficEnabled: boolean;
  onToggleTraffic: () => void;
  onToggleTheme: () => void;
  onSelectWaitingPin?: (lat: number, lng: number) => void;
  onEtaUpdated?: (eta: RouteEtaInfo | null) => void;
  allowMapPinSelection?: boolean;
}

const DEFAULT_CENTER = { lat: 37.7855, lng: -122.4214 };

function AccuracyHalo({
  center,
  radiusMeters,
  color,
}: {
  center: { lat: number; lng: number } | null;
  radiusMeters: number;
  color: string;
}) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || !center) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        map,
        center,
        radius: Math.min(250, Math.max(18, radiusMeters)),
        fillColor: color,
        fillOpacity: 0.14,
        strokeColor: color,
        strokeOpacity: 0.45,
        strokeWeight: 1.5,
        clickable: false,
        zIndex: 1,
      });
    } else {
      circleRef.current.setCenter(center);
      circleRef.current.setRadius(Math.min(250, Math.max(18, radiusMeters)));
      circleRef.current.setOptions({ fillColor: color, strokeColor: color });
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, center?.lat, center?.lng, radiusMeters, color]);

  return null;
}

function TrafficOverlay({ enabled }: { enabled: boolean }) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const layerRef = useRef<google.maps.TrafficLayer | null>(null);

  useEffect(() => {
    if (!map || !mapsLib) return;

    if (!layerRef.current) {
      layerRef.current = new mapsLib.TrafficLayer();
    }

    layerRef.current.setMap(enabled ? map : null);

    return () => {
      layerRef.current?.setMap(null);
    };
  }, [map, mapsLib, enabled]);

  return null;
}

function RoutePathLayer({
  stops,
  theme,
}: {
  stops: RouteStop[];
  theme: 'light' | 'dark';
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || stops.length < 2) return;

    let cancelled = false;
    const clearPolylines = () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };

    const drawFallbackPolyline = () => {
      clearPolylines();
      const line = new google.maps.Polyline({
        path: stops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
        geodesic: true,
        strokeColor: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
        strokeOpacity: 0.85,
        strokeWeight: 5,
        map,
      });
      polylinesRef.current = [line];
    };

    if (routesLib && 'Route' in routesLib) {
      const origin = { lat: stops[0].latitude, lng: stops[0].longitude };
      const destination = {
        lat: stops[stops.length - 1].latitude,
        lng: stops[stops.length - 1].longitude,
      };
      const intermediates = stops.slice(1, -1).map((s) => ({
        location: { lat: s.latitude, lng: s.longitude },
      }));

      const request = {
        origin,
        destination,
        intermediates: intermediates.length > 0 ? intermediates : undefined,
        travelMode: 'DRIVING',
        fields: ['path', 'viewport'],
      };

      (routesLib.Route as unknown as {
        computeRoutes: (req: unknown) => Promise<{
          routes?: Array<{
            createPolylines: () => google.maps.Polyline[];
            viewport?: google.maps.LatLngBounds;
          }>;
        }>;
      })
        .computeRoutes(request)
        .then(({ routes }) => {
          if (cancelled) return;
          if (!routes || routes.length === 0) {
            drawFallbackPolyline();
            return;
          }
          clearPolylines();
          const primaryRoute = routes[0];
          const created = primaryRoute.createPolylines();
          created.forEach((p) => {
            p.setOptions({
              strokeColor: theme === 'dark' ? '#60a5fa' : '#1d4ed8',
              strokeOpacity: 0.85,
              strokeWeight: 5,
            });
            p.setMap(map);
          });
          polylinesRef.current = created;
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const msg = String(err);
          if (
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('OVER_QUERY_LIMIT') ||
            msg.includes('429')
          ) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          drawFallbackPolyline();
        });
    } else {
      drawFallbackPolyline();
    }

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [map, routesLib, stops, theme]);

  return null;
}

function LiveEtaCalculator({
  aggregatedBus,
  userLocation,
  onEtaUpdated,
}: {
  aggregatedBus: AggregatedBusLocation | null;
  userLocation: { lat: number; lng: number } | null;
  onEtaUpdated?: (eta: RouteEtaInfo | null) => void;
}) {
  const routesLib = useMapsLibrary('routes');
  const lastQueryRef = useRef<{
    time: number;
    busLat: number;
    busLng: number;
    userLat: number;
    userLng: number;
  } | null>(null);

  useEffect(() => {
    if (!onEtaUpdated) return;
    if (!aggregatedBus || !userLocation) {
      onEtaUpdated(null);
      return;
    }

    const now = Date.now();
    const directDistance = haversineMeters(
      aggregatedBus.latitude,
      aggregatedBus.longitude,
      userLocation.lat,
      userLocation.lng
    );

    // If bus is already within 45m
    if (directDistance <= 45) {
      onEtaUpdated({
        distanceMeters: Math.round(directDistance),
        durationMillis: 0,
        source: 'speed_estimate',
        updatedAt: now,
      });
      return;
    }

    const prev = lastQueryRef.current;
    const movedSinceLastQuery = prev
      ? haversineMeters(prev.busLat, prev.busLng, aggregatedBus.latitude, aggregatedBus.longitude) +
        haversineMeters(prev.userLat, prev.userLng, userLocation.lat, userLocation.lng)
      : Infinity;

    if (prev && now - prev.time < 15_000 && movedSinceLastQuery < 80) {
      return;
    }

    lastQueryRef.current = {
      time: now,
      busLat: aggregatedBus.latitude,
      busLng: aggregatedBus.longitude,
      userLat: userLocation.lat,
      userLng: userLocation.lng,
    };

    if (routesLib && 'Route' in routesLib) {
      (routesLib.Route as unknown as {
        computeRoutes: (req: unknown) => Promise<{
          routes?: Array<{ distanceMeters?: number; durationMillis?: number }>;
        }>;
      })
        .computeRoutes({
          origin: { lat: aggregatedBus.latitude, lng: aggregatedBus.longitude },
          destination: { lat: userLocation.lat, lng: userLocation.lng },
          travelMode: 'DRIVING',
          routingPreference: 'TRAFFIC_AWARE',
          fields: ['distanceMeters', 'durationMillis'],
        })
        .then(({ routes }) => {
          const r = routes?.[0];
          if (r && typeof r.distanceMeters === 'number' && typeof r.durationMillis === 'number') {
            onEtaUpdated({
              distanceMeters: r.distanceMeters,
              durationMillis: r.durationMillis,
              source: 'routes_api',
              updatedAt: Date.now(),
            });
          }
        })
        .catch((err: unknown) => {
          const msg = String(err);
          if (
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('OVER_QUERY_LIMIT') ||
            msg.includes('429')
          ) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          // Honest fallback only if real speed is available
          if (aggregatedBus.speed !== null && aggregatedBus.speed > 1.2) {
            const roadMeters = directDistance * 1.25;
            const ms = (roadMeters / aggregatedBus.speed) * 1000;
            onEtaUpdated({
              distanceMeters: Math.round(roadMeters),
              durationMillis: Math.round(ms),
              source: 'speed_estimate',
              updatedAt: Date.now(),
            });
          }
        });
    } else if (aggregatedBus.speed !== null && aggregatedBus.speed > 1.2) {
      const roadMeters = directDistance * 1.25;
      onEtaUpdated({
        distanceMeters: Math.round(roadMeters),
        durationMillis: Math.round((roadMeters / aggregatedBus.speed) * 1000),
        source: 'speed_estimate',
        updatedAt: Date.now(),
      });
    }
  }, [
    routesLib,
    aggregatedBus?.latitude,
    aggregatedBus?.longitude,
    aggregatedBus?.speed,
    userLocation?.lat,
    userLocation?.lng,
    onEtaUpdated,
  ]);

  return null;
}

function MapCameraControls({
  aggregatedBus,
  userLocation,
  stops,
  trafficEnabled,
  theme,
  onToggleTraffic,
  onToggleTheme,
}: {
  aggregatedBus: AggregatedBusLocation | null;
  userLocation: { lat: number; lng: number } | null;
  stops: RouteStop[];
  trafficEnabled: boolean;
  theme: 'light' | 'dark';
  onToggleTraffic: () => void;
  onToggleTheme: () => void;
}) {
  const map = useMap();
  const hasCenteredRef = useRef(false);

  // Initial fit bounds to route or bus
  useEffect(() => {
    if (!map || hasCenteredRef.current) return;
    if (stops.length >= 2) {
      const bounds = new google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
      if (aggregatedBus) {
        bounds.extend({ lat: aggregatedBus.latitude, lng: aggregatedBus.longitude });
      }
      map.fitBounds(bounds, { top: 64, bottom: 260, left: 40, right: 40 });
      hasCenteredRef.current = true;
    } else if (aggregatedBus) {
      map.setCenter({ lat: aggregatedBus.latitude, lng: aggregatedBus.longitude });
      map.setZoom(14);
      hasCenteredRef.current = true;
    } else if (userLocation) {
      map.setCenter(userLocation);
      map.setZoom(14);
      hasCenteredRef.current = true;
    }
  }, [map, stops, aggregatedBus, userLocation]);

  const handleRecenterBus = useCallback(() => {
    if (!map) return;
    if (aggregatedBus) {
      map.panTo({ lat: aggregatedBus.latitude, lng: aggregatedBus.longitude });
      map.setZoom(15);
    } else if (stops.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
      map.fitBounds(bounds, { top: 64, bottom: 260, left: 40, right: 40 });
    }
  }, [map, aggregatedBus, stops]);

  const handleRecenterUser = useCallback(() => {
    if (!map || !userLocation) return;
    map.panTo(userLocation);
    map.setZoom(15);
  }, [map, userLocation]);

  const handleZoom = useCallback(
    (delta: number) => {
      if (!map) return;
      const z = map.getZoom() ?? 13;
      map.setZoom(Math.min(20, Math.max(3, z + delta)));
    },
    [map]
  );

  return (
    <div className="absolute right-3 top-16 z-20 flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggleTraffic}
        title={trafficEnabled ? 'Hide live traffic' : 'Show live traffic'}
        aria-label={trafficEnabled ? 'Hide live traffic' : 'Show live traffic'}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 ${
          trafficEnabled
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-slate-200/90 bg-white/90 text-slate-700 hover:bg-white dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900'
        }`}
      >
        <Layers className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to light map' : 'Switch to night commuter mode'}
        aria-label={theme === 'dark' ? 'Switch to light map' : 'Switch to night commuter mode'}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      {aggregatedBus && (
        <button
          type="button"
          onClick={handleRecenterBus}
          title="Center on live bus"
          aria-label="Center on live bus"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-900 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-white dark:hover:bg-slate-900"
        >
          <Bus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </button>
      )}

      {userLocation && (
        <button
          type="button"
          onClick={handleRecenterUser}
          title="Center on my location"
          aria-label="Center on my location"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-sm backdrop-blur-md transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700/90 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      )}

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-700/90 dark:bg-slate-900/90">
        <button
          type="button"
          onClick={() => handleZoom(1)}
          title="Zoom in"
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center border-b border-slate-200/80 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          title="Zoom out"
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function BusMarkerWithInfo({
  bus,
  sessionName,
}: {
  bus: AggregatedBusLocation;
  sessionName: string;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  const ageSec = Math.max(0, Math.round((Date.now() - bus.timestamp) / 1000));

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: bus.latitude, lng: bus.longitude }}
        onClick={() => setOpen((v) => !v)}
        zIndex={100}
        title={bus.isEstimated ? 'Estimated Shared Bus Position' : 'Shared Bus GPS'}
      >
        <div className="relative flex flex-col items-center">
          <div className="flex items-center gap-1.5 rounded-xl border-2 border-white bg-slate-900 px-2.5 py-1.5 text-white shadow-lg dark:border-slate-950 dark:bg-blue-600">
            <Bus className="h-4 w-4 shrink-0" />
            <span className="text-xs font-semibold whitespace-nowrap tabular-nums">
              {bus.isEstimated ? 'Est. Bus' : 'Live Bus'}
            </span>
            {bus.heading !== null && (
              <Compass
                className="h-3.5 w-3.5 text-emerald-400"
                style={{ transform: `rotate(${bus.heading}deg)` }}
              />
            )}
          </div>
          <div className="h-2.5 w-2.5 -mt-1.5 rotate-45 border-r-2 border-b-2 border-white bg-slate-900 dark:border-slate-950 dark:bg-blue-600" />
        </div>
      </AdvancedMarker>

      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="min-w-[190px] p-1 text-slate-900">
            <p className="text-xs font-semibold text-slate-900">{sessionName}</p>
            <p className="mt-0.5 text-[11px] font-medium text-blue-700">
              {bus.isEstimated
                ? `Estimated from ${bus.activeContributors} onboard signals`
                : 'Single onboard GPS signal'}
            </p>
            <p className="mt-1 text-[11px] text-slate-600 tabular-nums">
              Accuracy ±{bus.accuracy}m · Updated {ageSec}s ago
            </p>
            {bus.outliersFiltered > 0 && (
              <p className="mt-0.5 text-[11px] text-amber-700 tabular-nums">
                {bus.outliersFiltered} outlier signal{bus.outliersFiltered > 1 ? 's' : ''} filtered
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export const LiveBusMap: React.FC<LiveBusMapProps> = ({
  session,
  passengers,
  aggregatedBus,
  currentPassengerId,
  userLocation,
  theme,
  trafficEnabled,
  onToggleTraffic,
  onToggleTheme,
  onSelectWaitingPin,
  onEtaUpdated,
  allowMapPinSelection = false,
}) => {
  const [selectedStop, setSelectedStop] = useState<RouteStop | null>(null);

  const initialCenter = useMemo(() => {
    if (aggregatedBus) {
      return { lat: aggregatedBus.latitude, lng: aggregatedBus.longitude };
    }
    if (userLocation) return userLocation;
    if (session.stops.length > 0) {
      return { lat: session.stops[0].latitude, lng: session.stops[0].longitude };
    }
    return DEFAULT_CENTER;
  }, [aggregatedBus, userLocation, session.stops]);

  const waitingPassengers = useMemo(
    () =>
      passengers.filter(
        (p) =>
          p.passengerStatus === 'waiting' &&
          p.id !== currentPassengerId &&
          p.location !== null
      ),
    [passengers, currentPassengerId]
  );

  const onboardContributors = useMemo(
    () =>
      passengers.filter(
        (p) => p.passengerStatus === 'onboard_sharing' && p.location !== null
      ),
    [passengers]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-200 dark:bg-slate-900">
      <GoogleMapView
        key={theme}
        mapId="DEMO_MAP_ID"
        colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
        defaultCenter={initialCenter}
        defaultZoom={14}
        gestureHandling="greedy"
        disableDefaultUI
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        className="h-full w-full"
        onClick={(ev) => {
          if (allowMapPinSelection && onSelectWaitingPin && ev.detail.latLng) {
            onSelectWaitingPin(ev.detail.latLng.lat, ev.detail.latLng.lng);
          }
          setSelectedStop(null);
        }}
      >
        <TrafficOverlay enabled={trafficEnabled} />
        <RoutePathLayer stops={session.stops} theme={theme} />
        <LiveEtaCalculator
          aggregatedBus={aggregatedBus}
          userLocation={userLocation}
          onEtaUpdated={onEtaUpdated}
        />

        <MapCameraControls
          aggregatedBus={aggregatedBus}
          userLocation={userLocation}
          stops={session.stops}
          trafficEnabled={trafficEnabled}
          theme={theme}
          onToggleTraffic={onToggleTraffic}
          onToggleTheme={onToggleTheme}
        />

        {/* Bus Accuracy Halo */}
        {aggregatedBus && (
          <AccuracyHalo
            center={{ lat: aggregatedBus.latitude, lng: aggregatedBus.longitude }}
            radiusMeters={aggregatedBus.accuracy}
            color="#2563eb"
          />
        )}

        {/* Route Stop Markers */}
        {session.stops.map((stop) => (
          <AdvancedMarker
            key={stop.id}
            position={{ lat: stop.latitude, lng: stop.longitude }}
            onClick={() => setSelectedStop(stop)}
            zIndex={10}
            title={stop.name}
          >
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-[10px] font-bold text-slate-900 shadow-sm dark:border-blue-400 dark:bg-slate-900 dark:text-white">
                {stop.order}
              </div>
            </div>
          </AdvancedMarker>
        ))}

        {selectedStop && (
          <InfoWindow
            position={{ lat: selectedStop.latitude, lng: selectedStop.longitude }}
            onCloseClick={() => setSelectedStop(null)}
          >
            <div className="p-1 text-slate-900">
              <p className="text-xs font-semibold">{selectedStop.name}</p>
              <p className="text-[11px] text-slate-500">Stop #{selectedStop.order}</p>
              {allowMapPinSelection && onSelectWaitingPin && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectWaitingPin(selectedStop.latitude, selectedStop.longitude);
                    setSelectedStop(null);
                  }}
                  className="mt-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                >
                  Wait at this stop
                </button>
              )}
            </div>
          </InfoWindow>
        )}

        {/* Waiting Passengers (Amber markers, distinct from onboard contributors) */}
        {waitingPassengers.map((p) => (
          <AdvancedMarker
            key={p.id}
            position={{ lat: p.location!.latitude, lng: p.location!.longitude }}
            zIndex={30}
            title={`Waiting: ${p.displayName}`}
          >
            <div className="flex items-center gap-1 rounded-lg border border-amber-500/80 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 shadow-sm dark:bg-amber-950/90 dark:text-amber-200">
              <Users className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="max-w-[80px] truncate">{p.displayName}</span>
            </div>
          </AdvancedMarker>
        ))}

        {/* Individual Onboard GPS Contributors (Emerald signal dots) */}
        {onboardContributors.map((p) => (
          <AdvancedMarker
            key={`contrib_${p.id}`}
            position={{ lat: p.location!.latitude, lng: p.location!.longitude }}
            zIndex={60}
            title={`Onboard sharer: ${p.displayName} (±${Math.round(p.location!.accuracy)}m)`}
          >
            <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md dark:border-slate-950">
              <div className="h-1.5 w-1.5 rounded-full bg-white" />
            </div>
          </AdvancedMarker>
        ))}

        {/* Current User Location Marker */}
        {userLocation && (
          <AdvancedMarker
            position={userLocation}
            zIndex={80}
            title="Your current position"
          >
            <div className="relative flex items-center justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-white bg-blue-600 shadow-md dark:border-slate-950" />
            </div>
          </AdvancedMarker>
        )}

        {/* Aggregated Shared Bus Marker */}
        {aggregatedBus && (
          <BusMarkerWithInfo bus={aggregatedBus} sessionName={session.sessionName} />
        )}
      </GoogleMapView>

      {/* Bottom-left compact map legend */}
      <div className="pointer-events-none absolute left-3 top-16 z-10 hidden sm:flex flex-col gap-1 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[11px] text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-900 dark:bg-blue-500" />
          <span>Estimated Bus</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>Onboard GPS Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span>Waiting Passenger</span>
        </div>
      </div>
    </div>
  );
};
