import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, User } from 'lucide-react';

interface EnterNameScreenProps {
  initialName: string;
  initialShareName: boolean;
  isSubmitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (name: string, shareName: boolean) => void;
}

export const EnterNameScreen: React.FC<EnterNameScreenProps> = ({
  initialName,
  initialShareName,
  isSubmitting,
  error,
  onBack,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const [shareName, setShareName] = useState(initialShareName);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setLocalError('Please enter at least 2 characters so fellow riders can identify your session.');
      return;
    }
    setLocalError(null);
    onSubmit(trimmed, shareName);
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
          Step 1 of 3 · Profile
        </span>
        <div className="w-11" />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-24 pt-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
            <User className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            What should we call you?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            No passwords or email required. Enter a name to join a bus session right away.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="passenger-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Your name or nickname
              </label>
              <input
                id="passenger-name"
                type="text"
                autoFocus
                maxLength={40}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (localError) setLocalError(null);
                }}
                placeholder="e.g. Maya"
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500"
              />
              {(localError || error) && (
                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                  {localError || error}
                </p>
              )}
            </div>

            {/* Privacy Consent Toggle */}
            <button
              type="button"
              onClick={() => setShareName((prev) => !prev)}
              className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800/70"
            >
              <div className="flex items-start gap-3">
                {shareName ? (
                  <Eye className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                ) : (
                  <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    Show my name to session riders
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {shareName
                      ? 'Other passengers on this bus see your display name.'
                      : 'You appear anonymously as a numbered commuter.'}
                  </p>
                </div>
              </div>
              <div
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  shareName ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    shareName ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <span>{isSubmitting ? 'Saving...' : 'Continue'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
