import React, { useState } from 'react';
import { ArrowRight, Bus, MapPin, Moon, ShieldCheck, Sun } from 'lucide-react';
import { PWAInstallButton } from '../PWAInstallBanner.tsx';

interface WelcomeScreenProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onGetStarted: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  theme,
  onToggleTheme,
  onGetStarted,
}) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Compact Top Bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          BusBridge
        </span>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="compact" />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to night commuter mode'}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="whitespace-nowrap">Day Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-slate-600" />
                <span className="whitespace-nowrap">Night Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 pb-24 pt-2 sm:px-8 lg:pb-12">
        <div className="grid w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left: Hero Illustration */}
          <div className="lg:col-span-6">
            <div className="relative h-64 w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-sm sm:h-80 lg:h-full lg:min-h-[420px] dark:border-slate-800">
              {!imgError ? (
                <img
                  src="/src/assets/images/welcome_bus_illustration_1794604224456.jpg"
                  alt="Electric commuter bus arriving at an illuminated transit shelter"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 text-center text-white">
                  <Bus className="mb-3 h-12 w-12 text-blue-400" />
                  <p className="text-sm font-medium text-slate-200">
                    Real-time community bus tracking
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Copy & Core Concept */}
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Live Transit · Shared by Riders
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl text-balance dark:text-white">
              Know exactly where your bus is, powered by riders onboard.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              When onboard commuters share their live GPS, waiting passengers see accurate bus movement, live road traffic, and honest arrival times.
            </p>

            <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              <div className="flex items-start gap-3.5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Waiting at a stop
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    See bus distance, traffic-aware ETA, and how many riders are waiting ahead.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <Bus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Boarded the bus
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    Tap once to share your signal. Multiple onboard signals merge into one filtered bus position.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Privacy by default
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    No account signup required. Pause sharing anytime or stop automatically when you reach your stop.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 hidden lg:block">
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-8 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Thumb CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent p-4 lg:hidden dark:from-slate-950 dark:via-slate-950">
        <button
          type="button"
          onClick={onGetStarted}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-lg transition-transform active:scale-[0.98] dark:bg-blue-600"
        >
          <span>Get Started</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
