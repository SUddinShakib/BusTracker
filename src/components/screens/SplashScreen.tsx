import React, { useEffect } from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, 1400);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="flex max-w-sm flex-col items-center text-center">
        {/* Animated Bus Vector Illustration */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-6 flex h-28 w-44 items-center justify-center"
        >
          <svg
            viewBox="0 0 180 100"
            className="h-full w-full"
            fill="none"
            aria-label="BusBridge animated commuter bus"
          >
            {/* Road baseline */}
            <line
              x1="12"
              y1="86"
              x2="168"
              y2="86"
              stroke="#334155"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <motion.line
              x1="28"
              y1="86"
              x2="152"
              y2="86"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeDasharray="10 14"
              strokeLinecap="round"
              animate={{ strokeDashoffset: [0, -48] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            />

            {/* Bus Chassis */}
            <motion.g
              animate={{ y: [0, -1.5, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <rect
                x="30"
                y="26"
                width="116"
                height="48"
                rx="10"
                fill="#1e3a8a"
                stroke="#60a5fa"
                strokeWidth="2"
              />
              {/* Roof GPS beacon */}
              <rect x="78" y="20" width="22" height="6" rx="3" fill="#10b981" />
              {/* Windows */}
              <rect x="38" y="34" width="22" height="18" rx="3" fill="#93c5fd" fillOpacity="0.9" />
              <rect x="65" y="34" width="22" height="18" rx="3" fill="#93c5fd" fillOpacity="0.9" />
              <rect x="92" y="34" width="22" height="18" rx="3" fill="#93c5fd" fillOpacity="0.9" />
              <path
                d="M119 34H137C139.2 34 141 35.8 141 38V52H119V34Z"
                fill="#bfdbfe"
              />
              {/* Headlight */}
              <rect x="142" y="59" width="4" height="7" rx="1.5" fill="#fbbf24" />
              {/* Wheels */}
              <circle cx="56" cy="76" r="9" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2.5" />
              <circle cx="56" cy="76" r="3" fill="#64748b" />
              <circle cx="122" cy="76" r="9" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2.5" />
              <circle cx="122" cy="76" r="3" fill="#64748b" />
            </motion.g>
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-white">BusBridge</h1>
          <p className="mt-2 text-sm text-slate-400">
            Community-powered live bus tracking
          </p>
        </motion.div>
      </div>
    </div>
  );
};
