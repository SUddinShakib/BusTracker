import React, { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Check,
  Eye,
  Gauge,
  Layers,
  LogOut,
  Moon,
  Shield,
  Sun,
  User,
} from 'lucide-react';
import type { AppSettings, BusSession } from '../../shared/types.ts';
import { PWAInstallButton } from '../PWAInstallBanner.tsx';

interface SettingsScreenProps {
  userName: string;
  settings: AppSettings;
  activeSession: BusSession | null;
  onUpdateName: (newName: string) => Promise<void>;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onLeaveSession: () => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  userName,
  settings,
  activeSession,
  onUpdateName,
  onUpdateSettings,
  onLeaveSession,
  onBack,
}) => {
  const [nameInput, setNameInput] = useState(userName);
  const [savingName, setSavingName] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim().length < 2) return;
    setSavingName(true);
    try {
      await onUpdateName(nameInput.trim());
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2000);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 pb-20 text-slate-900 lg:pb-8 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to tracking"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">
              Settings & Privacy
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        {/* Profile */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Commuter Profile
            </h2>
          </div>

          <form onSubmit={handleSaveName} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={40}
              className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <button
              type="submit"
              disabled={savingName || nameInput.trim().length < 2}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {savedNotice ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Saved</span>
                </>
              ) : (
                <span>{savingName ? 'Saving...' : 'Update Name'}</span>
              )}
            </button>
          </form>
        </section>

        {/* Location & Privacy */}
        <section className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Display my name to riders
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  When disabled, you appear as an anonymous commuter ID in passenger lists.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.shareName}
              onClick={() => onUpdateSettings({ shareName: !settings.shareName })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                settings.shareName ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.shareName ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  GPS Broadcast Cadence
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Balances real-time smoothness with mobile battery usage while onboard.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => onUpdateSettings({ updateIntervalMs: 3000 })}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.updateIntervalMs === 3000
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                3s Live
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ updateIntervalMs: 5000 })}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                  settings.updateIntervalMs === 5000
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                5s Battery Saver
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Bus Approaching Alert (500m)
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Show an arrival alert when the bus gets within 500 meters of your waiting stop.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.arrivalAlertsEnabled}
              onClick={() =>
                onUpdateSettings({
                  arrivalAlertsEnabled: !settings.arrivalAlertsEnabled,
                })
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                settings.arrivalAlertsEnabled
                  ? 'bg-blue-600'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.arrivalAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Map & Appearance */}
        <section className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              {settings.theme === 'dark' ? (
                <Moon className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              ) : (
                <Sun className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Night Commuter Dark Mode
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Reduces glare on both the interface and Google Maps canvas at night.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.theme === 'dark'}
              onClick={() =>
                onUpdateSettings({
                  theme: settings.theme === 'dark' ? 'light' : 'dark',
                })
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                settings.theme === 'dark'
                  ? 'bg-blue-600'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <Layers className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Real-Time Traffic Layer
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Display live road congestion lines on the map by default.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.trafficLayerDefault}
              onClick={() =>
                onUpdateSettings({
                  trafficLayerDefault: !settings.trafficLayerDefault,
                })
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                settings.trafficLayerDefault
                  ? 'bg-blue-600'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings.trafficLayerDefault ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </section>

        {/* Privacy Promise & Session Actions */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Your GPS coordinates are shared exclusively with members of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {activeSession?.sessionName ?? 'your active bus session'}
              </span>{' '}
              and overwritten with each reading. No location history is stored publicly, and inactive sessions expire automatically.
            </div>
          </div>

          {activeSession && (
            <button
              type="button"
              onClick={onLeaveSession}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
            >
              <LogOut className="h-4 w-4" />
              <span>Leave Current Bus Session</span>
            </button>
          )}

          <div className="mt-4">
            <PWAInstallButton variant="card" />
          </div>
        </section>
      </main>
    </div>
  );
};
