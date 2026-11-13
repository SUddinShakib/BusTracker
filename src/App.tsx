import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { SplashScreen } from './components/screens/SplashScreen.tsx';
import { WelcomeScreen } from './components/screens/WelcomeScreen.tsx';
import { EnterNameScreen } from './components/screens/EnterNameScreen.tsx';
import { LocationPermissionScreen } from './components/screens/LocationPermissionScreen.tsx';
import { JoinBusScreen } from './components/screens/JoinBusScreen.tsx';
import { TrackingWorkspace } from './components/screens/TrackingWorkspace.tsx';
import { PassengerListScreen } from './components/screens/PassengerListScreen.tsx';
import { SettingsScreen } from './components/screens/SettingsScreen.tsx';
import { useGeolocation, type GpsReading } from './hooks/useGeolocation.ts';
import { useRealtimeSession } from './hooks/useRealtimeSession.ts';
import { OfflineIndicator } from './components/PWAInstallBanner.tsx';
import type {
  AppScreen,
  AppSettings,
  Passenger,
  PassengerStatus,
} from './shared/types.ts';

const SETTINGS_STORAGE_KEY = 'busbridge_settings_v1';
const USER_STORAGE_KEY = 'busbridge_user_v1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  shareName: true,
  updateIntervalMs: 3000,
  trafficLayerDefault: true,
  arrivalAlertsEnabled: true,
  arrivalAlertDistanceMeters: 500,
};

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadSavedUser(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.name) return parsed;
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [user, setUser] = useState<{ id: string; name: string } | null>(loadSavedUser);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentPassenger, setCurrentPassenger] = useState<Passenger | null>(null);
  const [virtualDriveActive, setVirtualDriveActive] = useState(false);

  // Google Maps API key (env or /api/config) + Case A Demo Quota Banner
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  useEffect(() => {
    if (!mapsApiKey) {
      fetch('/api/config')
        .then((r) => r.json())
        .then((d) => {
          if (d?.mapsApiKey) setMapsApiKey(d.mapsApiKey);
        })
        .catch(() => {});
    }
  }, [mapsApiKey]);

  // Keep <html> .dark class in sync with settings.theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  // Real-time WebSocket connection for active bus session
  const {
    snapshot,
    setSnapshot,
    connectionState,
    recentEvents,
    sendLocationUpdate,
    sendStatusUpdate,
  } = useRealtimeSession({
    sessionId: activeSessionId,
    passengerId: currentPassenger?.id ?? null,
  });

  // Sync currentPassenger object from authoritative server snapshot
  useEffect(() => {
    if (!snapshot || !currentPassenger) return;
    const serverMe = snapshot.passengers.find((p) => p.id === currentPassenger.id);
    if (serverMe) {
      setCurrentPassenger(serverMe);
    }
  }, [snapshot, currentPassenger?.id]);

  // Broadcast initial GPS position when socket connects
  useEffect(() => {
    if (
      connectionState === 'connected' &&
      gpsLocation &&
      currentPassenger &&
      (currentPassenger.passengerStatus === 'waiting' ||
        currentPassenger.passengerStatus === 'onboard_sharing')
    ) {
      sendLocationUpdate({
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        accuracy: gpsLocation.accuracy,
        heading: gpsLocation.heading,
        speed: gpsLocation.speed,
        isSharing: true,
        timestamp: gpsLocation.timestamp,
      });
    }
  }, [connectionState, currentPassenger?.id]);

  const isOnboardSharing = currentPassenger?.passengerStatus === 'onboard_sharing';
  const isWaiting = currentPassenger?.passengerStatus === 'waiting';

  const handleGpsReading = useCallback(
    (reading: GpsReading) => {
      if (!activeSessionId || !currentPassenger) return;
      if (
        currentPassenger.passengerStatus === 'onboard_sharing' ||
        currentPassenger.passengerStatus === 'waiting'
      ) {
        sendLocationUpdate({
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracy: reading.accuracy,
          heading: reading.heading,
          speed: reading.speed,
          isSharing: true,
          timestamp: reading.timestamp,
        });
      }
    },
    [activeSessionId, currentPassenger, sendLocationUpdate]
  );

  const {
    permission,
    location: gpsLocation,
    error: gpsError,
    isRequesting: isRequestingGps,
    requestCurrentPosition,
    setManualLocation,
  } = useGeolocation({
    watchActive: Boolean(isOnboardSharing && !virtualDriveActive),
    minIntervalMs: settings.updateIntervalMs,
    onReading: handleGpsReading,
  });

  // Explicit desktop-testing Virtual Route Drive along stops (only when toggled on by user while onboard)
  const virtualProgressRef = useRef(0);
  useEffect(() => {
    if (!virtualDriveActive || !isOnboardSharing || !snapshot?.session.stops.length) {
      return;
    }
    const stops = snapshot.session.stops;
    if (stops.length < 2) return;

    const stepMs = settings.updateIntervalMs;
    const timer = window.setInterval(() => {
      virtualProgressRef.current = (virtualProgressRef.current + 0.08) % (stops.length - 1);
      const segIdx = Math.floor(virtualProgressRef.current);
      const frac = virtualProgressRef.current - segIdx;
      const a = stops[segIdx];
      const b = stops[Math.min(segIdx + 1, stops.length - 1)];

      const lat = a.latitude + (b.latitude - a.latitude) * frac;
      const lng = a.longitude + (b.longitude - a.longitude) * frac;

      const dLat = b.latitude - a.latitude;
      const dLng = b.longitude - a.longitude;
      const heading = ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;

      const reading = setManualLocation(lat, lng);
      sendLocationUpdate({
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy: 10,
        heading: Math.round(heading),
        speed: 9.5, // ~34 km/h urban bus speed
        isSharing: true,
        timestamp: Date.now(),
      });
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [
    virtualDriveActive,
    isOnboardSharing,
    snapshot?.session.stops,
    settings.updateIntervalMs,
    setManualLocation,
    sendLocationUpdate,
  ]);

  const handleSaveName = async (name: string, shareName: boolean) => {
    setIsSavingUser(true);
    setUserError(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId: user?.id }),
      });
      if (!res.ok) throw new Error('Unable to save your profile.');
      const saved = (await res.json()) as { id: string; name: string };
      setUser(saved);
      updateSettings({ shareName });
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(saved));
      setScreen('location-permission');
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleJoinSession = async (sessionIdOrCode: string) => {
    if (!user) return;
    const res = await fetch(`/api/sessions/${encodeURIComponent(sessionIdOrCode)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        shareName: settings.shareName,
        initialStatus: 'waiting',
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Could not join bus session.');
    }
    const data = await res.json();
    setActiveSessionId(data.snapshot.session.id);
    setCurrentPassenger(data.passenger);
    setSnapshot(data.snapshot);
    setVirtualDriveActive(false);
    setScreen('tracking');

    // Immediately broadcast waiting GPS pin if available
    if (gpsLocation) {
      setTimeout(() => {
        fetch(`/api/sessions/${data.snapshot.session.id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passengerId: data.passenger.id,
            passengerStatus: 'waiting',
            shareName: settings.shareName,
          }),
        }).catch(() => {});
      }, 100);
    }
  };

  const handleCreateSession = async (sessionName: string, routeName: string) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionName,
        routeName,
        originLat: gpsLocation?.latitude,
        originLng: gpsLocation?.longitude,
      }),
    });
    if (!res.ok) throw new Error('Failed to create bus session.');
    const data = await res.json();
    await handleJoinSession(data.session.id);
  };

  const changeStatus = useCallback(
    (nextStatus: PassengerStatus) => {
      if (!currentPassenger) return;
      setCurrentPassenger({ ...currentPassenger, passengerStatus: nextStatus });
      sendStatusUpdate(nextStatus, settings.shareName);
    },
    [currentPassenger, sendStatusUpdate, settings.shareName]
  );

  const handleBoardBus = async () => {
    changeStatus('onboard_sharing');
    const reading = await requestCurrentPosition();
    if (!reading && snapshot?.session.stops.length && !gpsLocation) {
      // If browser GPS is blocked/unavailable, place onboard pin near route start
      const firstStop = snapshot.session.stops[0];
      const fallback = setManualLocation(firstStop.latitude, firstStop.longitude);
      sendLocationUpdate({
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        accuracy: fallback.accuracy,
        heading: null,
        speed: 0,
        isSharing: true,
      });
    } else if (reading) {
      sendLocationUpdate({
        latitude: reading.latitude,
        longitude: reading.longitude,
        accuracy: reading.accuracy,
        heading: reading.heading,
        speed: reading.speed,
        isSharing: true,
      });
    }
  };

  const handleSplashDone = useCallback(() => {
    setScreen(user ? 'join-bus' : 'welcome');
  }, [user]);

  const handleSetManualPin = useCallback(
    (lat: number, lng: number) => {
      const reading = setManualLocation(lat, lng);
      if (currentPassenger && isWaiting) {
        sendLocationUpdate({
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracy: reading.accuracy,
          heading: null,
          speed: 0,
          isSharing: true,
        });
      }
    },
    [setManualLocation, currentPassenger, isWaiting, sendLocationUpdate]
  );

  const handleUpdateNameInSettings = async (newName: string) => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, userId: user?.id }),
    });
    if (!res.ok) throw new Error('Failed to update name.');
    const updated = await res.json();
    setUser(updated);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    if (currentPassenger) {
      sendStatusUpdate(currentPassenger.passengerStatus, settings.shareName);
    }
  };

  const handleLeaveSession = () => {
    setVirtualDriveActive(false);
    if (currentPassenger) {
      sendStatusUpdate('reached_destination');
    }
    setActiveSessionId(null);
    setCurrentPassenger(null);
    setSnapshot(null);
    setScreen('join-bus');
  };

  const renderScreen = () => {
    if (screen === 'splash') {
      return <SplashScreen onComplete={handleSplashDone} />;
    }

    if (screen === 'welcome') {
      return (
        <WelcomeScreen
          theme={settings.theme}
          onToggleTheme={toggleTheme}
          onGetStarted={() => setScreen('enter-name')}
        />
      );
    }

    if (screen === 'enter-name') {
      return (
        <EnterNameScreen
          initialName={user?.name ?? ''}
          initialShareName={settings.shareName}
          isSubmitting={isSavingUser}
          error={userError}
          onBack={() => setScreen('welcome')}
          onSubmit={handleSaveName}
        />
      );
    }

    if (screen === 'location-permission') {
      return (
        <LocationPermissionScreen
          permission={permission}
          currentLocation={gpsLocation}
          isRequesting={isRequestingGps}
          error={gpsError}
          onBack={() => setScreen('enter-name')}
          onRequestLocation={requestCurrentPosition}
          onContinue={() => setScreen('join-bus')}
        />
      );
    }

    if (screen === 'join-bus') {
      return (
        <JoinBusScreen
          userName={user?.name ?? 'Commuter'}
          onBack={() => setScreen('location-permission')}
          onJoinSession={handleJoinSession}
          onCreateSession={handleCreateSession}
        />
      );
    }

    if (screen === 'passengers' && snapshot && currentPassenger) {
      return (
        <PassengerListScreen
          session={snapshot.session}
          passengers={snapshot.passengers}
          aggregatedBus={snapshot.aggregatedBus}
          currentPassengerId={currentPassenger.id}
          onBack={() => setScreen('tracking')}
        />
      );
    }

    if (screen === 'settings') {
      return (
        <SettingsScreen
          userName={user?.name ?? 'Commuter'}
          settings={settings}
          activeSession={snapshot?.session ?? null}
          onUpdateName={handleUpdateNameInSettings}
          onUpdateSettings={(patch) => {
            updateSettings(patch);
            if (patch.shareName !== undefined && currentPassenger) {
              sendStatusUpdate(currentPassenger.passengerStatus, patch.shareName);
            }
          }}
          onLeaveSession={handleLeaveSession}
          onBack={() => setScreen(snapshot ? 'tracking' : 'join-bus')}
        />
      );
    }

    if (screen === 'tracking' && snapshot && currentPassenger) {
      if (!mapsApiKey) {
        return (
          <div className="flex h-full w-full items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Loading live map configuration...
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Initializing Google Maps Platform and real-time session socket.
              </p>
            </div>
          </div>
        );
      }

      return (
        <APIProvider apiKey={mapsApiKey} libraries={['maps', 'marker', 'routes']} language="en" region="US">
          <TrackingWorkspace
            session={snapshot.session}
            passengers={snapshot.passengers}
            aggregatedBus={snapshot.aggregatedBus}
            currentPassenger={currentPassenger}
            userLocation={gpsLocation}
            connectionState={connectionState}
            recentEvents={recentEvents}
            settings={settings}
            gpsError={gpsError}
            virtualDriveActive={virtualDriveActive}
            onToggleVirtualDrive={() => setVirtualDriveActive((v) => !v)}
            onBoardBus={handleBoardBus}
            onPauseSharing={() => {
              setVirtualDriveActive(false);
              changeStatus('onboard_not_sharing');
            }}
            onResumeSharing={() => changeStatus('onboard_sharing')}
            onReachedDestination={() => {
              setVirtualDriveActive(false);
              changeStatus('reached_destination');
            }}
            onReturnToWaiting={() => {
              setVirtualDriveActive(false);
              changeStatus('waiting');
            }}
            onRequestCurrentGps={requestCurrentPosition}
            onSetManualWaitingPin={handleSetManualPin}
            onToggleTheme={toggleTheme}
            onToggleTraffic={() =>
              updateSettings({ trafficLayerDefault: !settings.trafficLayerDefault })
            }
            onOpenPassengers={() => setScreen('passengers')}
            onOpenSettings={() => setScreen('settings')}
            onSwitchSession={() => {
              setVirtualDriveActive(false);
              setScreen('join-bus');
            }}
          />
        </APIProvider>
      );
    }

    return (
      <JoinBusScreen
        userName={user?.name ?? 'Commuter'}
        onBack={() => setScreen('welcome')}
        onJoinSession={handleJoinSession}
        onCreateSession={handleCreateSession}
      />
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Case A: Google Maps Platform Demo Key Quota Banner */}
      {quotaExceeded && (
        <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-900 shadow-sm md:text-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-950 underline hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">{renderScreen()}</div>
      <OfflineIndicator />
    </div>
  );
}
