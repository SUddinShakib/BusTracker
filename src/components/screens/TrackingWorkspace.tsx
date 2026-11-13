import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  Settings,
  Users,
} from 'lucide-react';
import { LiveBusMap, type RouteEtaInfo } from '../LiveBusMap.tsx';
import type { GpsReading } from '../../hooks/useGeolocation.ts';
import type {
  SessionActivityEvent,
  WsConnectionState,
} from '../../hooks/useRealtimeSession.ts';
import { haversineMeters } from '../../shared/locationAggregation.ts';
import type {
  AggregatedBusLocation,
  AppSettings,
  BusSession,
  Passenger,
  PassengerStatus,
} from '../../shared/types.ts';

interface TrackingWorkspaceProps {
  session: BusSession;
  passengers: Passenger[];
  aggregatedBus: AggregatedBusLocation | null;
  currentPassenger: Passenger;
  userLocation: GpsReading | null;
  connectionState: WsConnectionState;
  recentEvents: SessionActivityEvent[];
  settings: AppSettings;
  gpsError: string | null;
  virtualDriveActive: boolean;
  onToggleVirtualDrive: () => void;
  onBoardBus: () => void;
  onPauseSharing: () => void;
  onResumeSharing: () => void;
  onReachedDestination: () => void;
  onReturnToWaiting: () => void;
  onRequestCurrentGps: () => void;
  onSetManualWaitingPin: (lat: number, lng: number) => void;
  onToggleTheme: () => void;
  onToggleTraffic: () => void;
  onOpenPassengers: () => void;
  onOpenSettings: () => void;
  onSwitchSession: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatEta(durationMillis: number): string {
  const mins = Math.round(durationMillis / 60_000);
  if (mins <= 0) return 'Arriving now';
  if (mins === 1) return '1 min';
  return `${mins} mins`;
}

function formatUpdatedAge(timestamp: number): string {
  const sec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (sec < 5) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

export const TrackingWorkspace: React.FC<TrackingWorkspaceProps> = ({
  session,
  passengers,
  aggregatedBus,
  currentPassenger,
  userLocation,
  connectionState,
  recentEvents,
  settings,
  gpsError,
  virtualDriveActive,
  onToggleVirtualDrive,
  onBoardBus,
  onPauseSharing,
  onResumeSharing,
  onReachedDestination,
  onReturnToWaiting,
  onRequestCurrentGps,
  onSetManualWaitingPin,
  onToggleTheme,
  onToggleTraffic,
  onOpenPassengers,
  onOpenSettings,
  onSwitchSession,
}) => {
  const [trafficEnabled, setTrafficEnabled] = useState(settings.trafficLayerDefault);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [etaInfo, setEtaInfo] = useState<RouteEtaInfo | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [arrivalBannerDismissed, setArrivalBannerDismissed] = useState(false);

  // Refresh relative timestamps cleanly every 5s
  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 5000);
    return () => window.clearInterval(t);
  }, []);

  const counts = useMemo(() => {
    let waiting = 0;
    let onboard = 0;
    let sharing = 0;
    for (const p of passengers) {
      if (p.passengerStatus === 'waiting') waiting += 1;
      if (p.passengerStatus === 'onboard_sharing') {
        onboard += 1;
        sharing += 1;
      }
      if (p.passengerStatus === 'onboard_not_sharing') {
        onboard += 1;
      }
    }
    return { waiting, onboard, sharing };
  }, [passengers]);

  const directDistanceMeters = useMemo(() => {
    if (!aggregatedBus || !userLocation) return null;
    return haversineMeters(
      aggregatedBus.latitude,
      aggregatedBus.longitude,
      userLocation.latitude,
      userLocation.longitude
    );
  }, [aggregatedBus, userLocation]);

  const isStaleBusSignal =
    aggregatedBus !== null && nowTick - aggregatedBus.timestamp > 30_000;

  const isWaiting = currentPassenger.passengerStatus === 'waiting';
  const isOnboardSharing = currentPassenger.passengerStatus === 'onboard_sharing';
  const isOnboardPaused = currentPassenger.passengerStatus === 'onboard_not_sharing';
  const isReached = currentPassenger.passengerStatus === 'reached_destination';

  const showArrivalAlert =
    isWaiting &&
    settings.arrivalAlertsEnabled &&
    !arrivalBannerDismissed &&
    directDistanceMeters !== null &&
    directDistanceMeters <= settings.arrivalAlertDistanceMeters;

  const latestEvent = recentEvents[0];
  const showLatestEvent =
    latestEvent && nowTick - latestEvent.timestamp < 8000;

  const handleToggleTraffic = () => {
    setTrafficEnabled((prev) => !prev);
    onToggleTraffic();
  };

  const statusPanelBody = (
    <div className="space-y-4">
      {/* Reconnection / GPS Warning */}
      {connectionState !== 'connected' && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {connectionState === 'reconnecting'
              ? 'Connection interrupted. Reconnecting to live bus session...'
              : 'Connecting to live bus stream...'}
          </span>
        </div>
      )}

      {gpsError && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
          <span>{gpsError}</span>
          <button
            type="button"
            onClick={onRequestCurrentGps}
            className="shrink-0 font-semibold underline"
          >
            Retry
          </button>
        </div>
      )}

      {showArrivalAlert && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
          <span>
            Bus approaching: {formatDistance(directDistanceMeters!)} away from your stop.
          </span>
          <button
            type="button"
            onClick={() => setArrivalBannerDismissed(true)}
            className="shrink-0 font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Bus Status Telemetry */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {aggregatedBus
                ? aggregatedBus.isEstimated
                  ? 'Estimated Bus Position'
                  : 'Single-Signal Bus Position'
                : 'Bus Location Status'}
            </p>
            <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
              {aggregatedBus
                ? isWaiting && etaInfo
                  ? `${formatEta(etaInfo.durationMillis)} away`
                  : isWaiting && directDistanceMeters !== null
                  ? `${formatDistance(directDistanceMeters)} away`
                  : `${aggregatedBus.activeContributors} active GPS ${
                      aggregatedBus.activeContributors === 1 ? 'signal' : 'signals'
                    }`
                : 'Awaiting onboard GPS'}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {aggregatedBus ? (
              <>
                <p className={isStaleBusSignal ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}>
                  {formatUpdatedAge(aggregatedBus.timestamp)}
                </p>
                <p className="mt-0.5">±{aggregatedBus.accuracy}m</p>
              </>
            ) : (
              <p>No signal</p>
            )}
          </div>
        </div>

        {/* Clean unboxed inline metrics */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600 tabular-nums dark:border-slate-800 dark:text-slate-400">
          {isWaiting && (etaInfo || directDistanceMeters !== null) && (
            <>
              <span>
                Distance:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatDistance(etaInfo?.distanceMeters ?? directDistanceMeters!)}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>
            <strong className="text-slate-900 dark:text-white">{counts.sharing}</strong> sharing
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="text-slate-900 dark:text-white">{counts.waiting}</strong> waiting
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="text-slate-900 dark:text-white">{counts.onboard}</strong> onboard
          </span>
        </div>

        {aggregatedBus && aggregatedBus.outliersFiltered > 0 && (
          <p className="mt-2 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            Filtered {aggregatedBus.outliersFiltered} inaccurate or off-route GPS{' '}
            {aggregatedBus.outliersFiltered === 1 ? 'reading' : 'readings'}.
          </p>
        )}
      </div>

      {/* WAITING MODE CONTROLS */}
      {isWaiting && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  Status: I’m Waiting Here
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {userLocation
                    ? userLocation.isManual
                      ? 'Stop pin set on map · Tap map to adjust'
                      : `GPS locked (±${userLocation.accuracy}m)`
                    : 'Tap anywhere on the map or use GPS to mark your stop'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRequestCurrentGps}
              className="h-9 shrink-0 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Use GPS
            </button>
          </div>

          {/* MOST IMPORTANT CTA: I Got Into the Bus – Start Sharing */}
          <button
            type="button"
            onClick={onBoardBus}
            className="flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98]"
          >
            <Bus className="h-5 w-5 shrink-0" />
            <span>I Got Into the Bus – Start Sharing</span>
          </button>
        </div>
      )}

      {/* ONBOARD MODE CONTROLS */}
      {(isOnboardSharing || isOnboardPaused) && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {isOnboardSharing ? (
                  <>
                    {/* Live telemetry dot strictly for active GPS + WebSocket streaming */}
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Sharing Live Location
                    </span>
                  </>
                ) : (
                  <>
                    <Radio className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      On Board · Sharing Paused
                    </span>
                  </>
                )}
              </div>

              <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                Every {settings.updateIntervalMs / 1000}s
              </span>
            </div>

            {userLocation && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                <span>Accuracy ±{userLocation.accuracy}m</span>
                {userLocation.speed !== null && userLocation.speed >= 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{Math.round(userLocation.speed * 3.6)} km/h</span>
                  </>
                )}
              </div>
            )}

            {/* Explicit Virtual Route Test Toggle for stationary desktop testing */}
            {session.stops.length >= 2 && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Test GPS movement along route
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Moves your own pin along stops if testing from a stationary desk
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={virtualDriveActive}
                  onClick={onToggleVirtualDrive}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    virtualDriveActive ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      virtualDriveActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {isOnboardSharing ? (
              <button
                type="button"
                onClick={onPauseSharing}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Pause className="h-4 w-4" />
                <span>Pause Sharing</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onResumeSharing}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <Play className="h-4 w-4" />
                <span>Resume Sharing</span>
              </button>
            )}

            <button
              type="button"
              onClick={onReachedDestination}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>I’ve Reached</span>
            </button>
          </div>
        </div>
      )}

      {/* REACHED DESTINATION MODE */}
      {isReached && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            You’ve reached your destination
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Live GPS sharing has stopped. Have a safe rest of your trip.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onReturnToWaiting}
              className="h-11 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Track Another Bus
            </button>
            <button
              type="button"
              onClick={onSwitchSession}
              className="h-11 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Switch Route
            </button>
          </div>
        </div>
      )}

      {/* Live Session Activity Feed Line */}
      {showLatestEvent && (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          {latestEvent.displayName}{' '}
          {latestEvent.event === 'passenger_boarded'
            ? 'boarded the bus and started sharing GPS'
            : latestEvent.event === 'passenger_reached'
            ? 'reached their destination'
            : latestEvent.event === 'sharing_paused'
            ? 'paused GPS sharing'
            : 'is waiting on the route'}
        </p>
      )}
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-100 lg:flex-row dark:bg-slate-950">
      {/* DESKTOP SIDEBAR RAIL (lg+) */}
      <aside className="hidden lg:flex lg:w-[400px] lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white dark:lg:border-slate-800 dark:lg:bg-slate-900">
        {/* Top Session Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onSwitchSession}
              aria-label="Switch bus session"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {session.sessionName}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {session.routeName} · <span className="font-mono">{session.sessionCode}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Workspace Content */}
        <div className="flex-1 overflow-y-auto p-5">{statusPanelBody}</div>

        {/* Desktop Rail Footer Nav */}
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onOpenPassengers}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Users className="h-4 w-4" />
            <span>Passengers ({passengers.length})</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* PRIMARY INTERACTIVE GOOGLE MAP */}
      <div className="relative flex-1 h-full w-full">
        {/* Mobile Compact Floating Top Bar (<= 52px) */}
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex items-center justify-between gap-2 lg:hidden">
          <div className="pointer-events-auto flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-2 shadow-sm backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/90">
            <button
              type="button"
              onClick={onSwitchSession}
              aria-label="Switch bus session"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 pr-2">
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                {session.sessionName}
              </p>
              <p className="truncate text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                {session.sessionCode} · {counts.sharing} sharing · {counts.waiting} waiting
              </p>
            </div>
          </div>
        </div>

        <LiveBusMap
          session={session}
          passengers={passengers}
          aggregatedBus={aggregatedBus}
          currentPassengerId={currentPassenger.id}
          userLocation={
            userLocation
              ? { lat: userLocation.latitude, lng: userLocation.longitude }
              : null
          }
          theme={settings.theme}
          trafficEnabled={trafficEnabled}
          onToggleTraffic={handleToggleTraffic}
          onToggleTheme={onToggleTheme}
          allowMapPinSelection={isWaiting}
          onSelectWaitingPin={onSetManualWaitingPin}
          onEtaUpdated={setEtaInfo}
        />

        {/* MOBILE EXPANDABLE BOTTOM SHEET (above mobile tab bar) */}
        <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-20 px-2 pb-2 lg:hidden">
          <div className="pointer-events-auto mx-auto max-w-xl overflow-hidden rounded-t-3xl rounded-b-2xl border border-slate-200/90 bg-white/95 shadow-xl backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95">
            {/* Drag Handle & Compact Summary Bar */}
            <button
              type="button"
              onClick={() => setSheetExpanded((v) => !v)}
              className="flex w-full flex-col items-center px-4 pt-2.5 pb-2.5 text-left"
              aria-expanded={sheetExpanded}
            >
              <span className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="mt-2 flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bus className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="truncate text-xs font-semibold text-slate-900 tabular-nums dark:text-white">
                    {aggregatedBus
                      ? isWaiting && etaInfo
                        ? `ETA ${formatEta(etaInfo.durationMillis)} · ${formatDistance(etaInfo.distanceMeters)}`
                        : `${aggregatedBus.activeContributors} active GPS · ±${aggregatedBus.accuracy}m`
                      : 'Awaiting onboard GPS signal'}
                  </span>
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500">
                  {sheetExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </span>
              </div>
            </button>

            {sheetExpanded && (
              <div className="max-h-[52vh] overflow-y-auto border-t border-slate-200/80 px-4 pb-4 pt-3 dark:border-slate-800/80">
                {statusPanelBody}
              </div>
            )}
          </div>
        </div>

        {/* MOBILE FIXED BOTTOM TAB BAR */}
        <nav
          aria-label="Primary navigation"
          className="fixed bottom-0 left-0 right-0 z-30 grid h-16 grid-cols-3 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-slate-900/95"
        >
          <button
            type="button"
            onClick={() => setSheetExpanded(true)}
            className="flex flex-col items-center justify-center text-blue-600 dark:text-blue-400"
          >
            <Navigation className="h-5 w-5" />
            <span className="mt-1 text-[11px] font-semibold">Live Map</span>
          </button>

          <button
            type="button"
            onClick={onOpenPassengers}
            className="flex flex-col items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Users className="h-5 w-5" />
            <span className="mt-1 text-[11px] font-medium tabular-nums">
              Riders ({passengers.length})
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex flex-col items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <Settings className="h-5 w-5" />
            <span className="mt-1 text-[11px] font-medium">Settings</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
