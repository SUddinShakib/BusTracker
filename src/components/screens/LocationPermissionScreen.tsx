import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, MapPin, Navigation, Shield } from 'lucide-react';
import type { GeolocationPermissionState, GpsReading } from '../../hooks/useGeolocation.ts';

interface LocationPermissionScreenProps {
  permission: GeolocationPermissionState;
  currentLocation: GpsReading | null;
  isRequesting: boolean;
  error: string | null;
  onBack: () => void;
  onRequestLocation: () => Promise<GpsReading | null>;
  onContinue: () => void;
}

export const LocationPermissionScreen: React.FC<LocationPermissionScreenProps> = ({
  permission,
  currentLocation,
  isRequesting,
  error,
  onBack,
  onRequestLocation,
  onContinue,
}) => {
  const [imgError, setImgError] = useState(false);

  const handleAllowGps = async () => {
    const reading = await onRequestLocation();
    if (reading) {
      onContinue();
    }
  };

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Step 2 of 3 · Location Access
        </span>
        <div className="w-11" />
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 pb-12 pt-2">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-44 w-full bg-slate-100 dark:bg-slate-800">
            {!imgError ? (
              <img
                src="/src/assets/images/permission_gps_illustration_1794604224309.jpg"
                alt="GPS location beacon over transit street grid"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-950 to-slate-900">
                <Navigation className="h-10 w-10 text-emerald-400" />
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Enable location for live tracking
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              BusBridge uses your GPS coordinates only inside the bus session you join—to calculate your distance to the bus when waiting, or to share the bus location when you are onboard.
            </p>

            <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-800">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="text-slate-700 dark:text-slate-300">
                  Shows your stop pin and real-time arrival distance while waiting.
                </span>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-700 dark:text-slate-300">
                  Location history is never stored publicly; pause or stop sharing anytime.
                </span>
              </div>
            </div>

            {currentLocation && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="tabular-nums">
                  GPS locked (±{currentLocation.accuracy}m accuracy)
                </span>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-300">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {permission === 'granted' && currentLocation ? (
                <button
                  type="button"
                  onClick={onContinue}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <span>Continue to Bus Sessions</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isRequesting}
                  onClick={handleAllowGps}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Navigation className="h-4 w-4" />
                  <span>{isRequesting ? 'Checking GPS...' : 'Allow Location Access'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onContinue}
                className="flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-transparent text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Continue without GPS (pick stop on map)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
