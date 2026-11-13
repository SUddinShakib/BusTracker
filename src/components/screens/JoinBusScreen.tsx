import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bus,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import type { BusSession } from '../../shared/types.ts';

interface JoinBusScreenProps {
  userName: string;
  onBack: () => void;
  onJoinSession: (sessionIdOrCode: string) => Promise<void>;
  onCreateSession: (sessionName: string, routeName: string) => Promise<void>;
}

export const JoinBusScreen: React.FC<JoinBusScreenProps> = ({
  userName,
  onBack,
  onJoinSession,
  onCreateSession,
}) => {
  const [sessions, setSessions] = useState<BusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBusName, setNewBusName] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Unable to load active bus routes.');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleJoin = async (idOrCode: string) => {
    setJoiningId(idOrCode);
    setError(null);
    try {
      await onJoinSession(idOrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join session.');
    } finally {
      setJoiningId(null);
    }
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeInput.trim()) return;
    handleJoin(codeInput.trim());
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await onCreateSession(newBusName.trim(), newRouteName.trim() || 'Community Route');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create bus session.');
    } finally {
      setCreating(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      s.sessionName.toLowerCase().includes(q) ||
      s.routeName.toLowerCase().includes(q) ||
      s.sessionCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                Join a Bus Session
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchSessions}
            aria-label="Refresh sessions"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Signed in as <span className="font-semibold text-slate-900 dark:text-white">{userName}</span>. Select an active corridor below or enter a shared session code.
        </p>

        {/* Join by Session Code + Search Grid */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <form
            onSubmit={handleCodeSubmit}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter session code (e.g. 38R-SF)"
              className="h-11 flex-1 bg-transparent px-3 text-sm font-mono uppercase text-slate-900 placeholder:normal-case placeholder:font-sans placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
            <button
              type="submit"
              disabled={!codeInput.trim() || joiningId !== null}
              className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Join Code
            </button>
          </form>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter routes or stops..."
              className="h-11 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Active Sessions Header */}
        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Active Bus Routes ({filteredSessions.length})
          </h2>
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/60"
          >
            <Plus className="h-4 w-4" />
            <span>{showCreateForm ? 'Cancel' : 'New Bus Session'}</span>
          </button>
        </div>

        {/* Create New Session Drawer */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateSubmit}
            className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Start a community bus session
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Share the generated code with fellow commuters waiting along this route.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                value={newBusName}
                onChange={(e) => setNewBusName(e.target.value)}
                placeholder="Bus name (e.g. Shuttle Line 4)"
                className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <input
                type="text"
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                placeholder="Corridor (e.g. Central Station → Oak Park)"
                className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={creating || !newBusName.trim()}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                {creating ? 'Creating...' : 'Create & Join Session'}
              </button>
            </div>
          </form>
        )}

        {/* Session List */}
        {loading && sessions.length === 0 ? (
          <div className="mt-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <Bus className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">
              No matching bus sessions found
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Try clearing your filter or create a new session for your route.
            </p>
          </div>
        ) : (
          <div className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredSessions.map((session) => {
              const isJoining = joiningId === session.id;
              return (
                <button
                  key={session.id}
                  type="button"
                  disabled={joiningId !== null}
                  onClick={() => handleJoin(session.id)}
                  className="flex min-h-[76px] w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 sm:px-6 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-blue-600">
                      <Bus className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 sm:text-base dark:text-white">
                        {session.sessionName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {session.routeName}
                      </p>
                      {/* Zero-pill clean inline metadata */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums dark:text-slate-400">
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                          {session.sessionCode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          {session.waitingCount ?? 0} waiting
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            (session.sharingCount ?? 0) > 0
                              ? 'font-medium text-emerald-700 dark:text-emerald-400'
                              : ''
                          }
                        >
                          {session.sharingCount ?? 0} sharing GPS
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <span>{isJoining ? 'Joining...' : 'Track'}</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
