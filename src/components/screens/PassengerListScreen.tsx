import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bus,
  CheckCircle2,
  Clock,
  EyeOff,
  Radio,
  Users,
  WifiOff,
} from 'lucide-react';
import type {
  AggregatedBusLocation,
  BusSession,
  Passenger,
  PassengerStatus,
} from '../../shared/types.ts';

interface PassengerListScreenProps {
  session: BusSession;
  passengers: Passenger[];
  aggregatedBus: AggregatedBusLocation | null;
  currentPassengerId: string | null;
  onBack: () => void;
}

type FilterTab = 'all' | 'onboard' | 'waiting' | 'completed';

const STATUS_LABEL: Record<PassengerStatus, string> = {
  onboard_sharing: 'On Board · Sharing Live GPS',
  onboard_not_sharing: 'On Board · Sharing Paused',
  waiting: 'Waiting at Stop',
  reached_destination: 'Reached Destination',
  disconnected: 'Disconnected',
};

function formatTimeAgo(ts: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export const PassengerListScreen: React.FC<PassengerListScreenProps> = ({
  session,
  passengers,
  aggregatedBus,
  currentPassengerId,
  onBack,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all');

  const counts = useMemo(() => {
    let onboard = 0;
    let sharing = 0;
    let waiting = 0;
    let completed = 0;

    for (const p of passengers) {
      if (p.passengerStatus === 'onboard_sharing') {
        onboard += 1;
        sharing += 1;
      } else if (p.passengerStatus === 'onboard_not_sharing') {
        onboard += 1;
      } else if (p.passengerStatus === 'waiting') {
        waiting += 1;
      } else {
        completed += 1;
      }
    }
    return { total: passengers.length, onboard, sharing, waiting, completed };
  }, [passengers]);

  const filteredPassengers = useMemo(() => {
    return passengers.filter((p) => {
      if (filter === 'onboard') {
        return (
          p.passengerStatus === 'onboard_sharing' ||
          p.passengerStatus === 'onboard_not_sharing'
        );
      }
      if (filter === 'waiting') return p.passengerStatus === 'waiting';
      if (filter === 'completed') {
        return (
          p.passengerStatus === 'reached_destination' ||
          p.passengerStatus === 'disconnected'
        );
      }
      return true;
    });
  }, [passengers, filter]);

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 pb-20 text-slate-900 lg:pb-8 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to live map"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                Passengers
              </h1>
            </div>
          </div>

          <span className="font-mono text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
            {session.sessionCode}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {/* Overview Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Waiting
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
              {counts.waiting}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              On Board
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
              {counts.onboard}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sharing GPS
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
              {counts.sharing}
            </p>
          </div>
        </div>

        {/* Bus Consensus Summary */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-blue-600">
                <Bus className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {aggregatedBus
                    ? aggregatedBus.isEstimated
                      ? 'Multi-Signal Bus Estimate Active'
                      : 'Single-Signal Live Bus Position'
                    : 'Awaiting Onboard GPS Signal'}
                </p>
                <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  {aggregatedBus
                    ? `${aggregatedBus.activeContributors} active contributor${aggregatedBus.activeContributors > 1 ? 's' : ''} · ±${aggregatedBus.accuracy}m · Updated ${formatTimeAgo(aggregatedBus.timestamp)}`
                    : 'Waiting passengers do not affect the bus marker until someone boards.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Segmented Filter Control */}
        <div className="mt-6 flex items-center gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1 dark:bg-slate-900">
          {(
            [
              { id: 'all', label: `All (${counts.total})` },
              { id: 'onboard', label: `On Board (${counts.onboard})` },
              { id: 'waiting', label: `Waiting (${counts.waiting})` },
              { id: 'completed', label: `Other (${counts.completed})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`h-10 flex-1 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Passenger Roster */}
        {filteredPassengers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <Users className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
              No passengers in this category
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Share your session code <span className="font-mono">{session.sessionCode}</span> with other commuters on your bus.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredPassengers.map((p) => {
              const isMe = p.id === currentPassengerId;
              return (
                <div
                  key={p.id}
                  className="flex min-h-[68px] items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        p.passengerStatus === 'onboard_sharing'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : p.passengerStatus === 'onboard_not_sharing'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                          : p.passengerStatus === 'waiting'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          : p.passengerStatus === 'reached_destination'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                      }`}
                    >
                      {p.passengerStatus === 'onboard_sharing' ? (
                        <Radio className="h-4 w-4" />
                      ) : p.passengerStatus === 'onboard_not_sharing' ? (
                        <EyeOff className="h-4 w-4" />
                      ) : p.passengerStatus === 'waiting' ? (
                        <Clock className="h-4 w-4" />
                      ) : p.passengerStatus === 'reached_destination' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {p.displayName}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {STATUS_LABEL[p.passengerStatus]}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    <p>{formatTimeAgo(p.updatedAt)}</p>
                    {p.location && (
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        ±{Math.round(p.location.accuracy)}m
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
