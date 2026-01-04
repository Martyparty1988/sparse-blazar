import React, { useRef, useEffect, useCallback } from 'react';

interface SplashScreenProps {
  onUnlock: (role: 'user' | 'admin') => void;
}

const TAP_SEQUENCE_COUNT = 5;
const TAP_TIMEOUT_MS = 400;

const SplashScreen: React.FC<SplashScreenProps> = ({ onUnlock }) => {
  const tapCount = useRef(0);
  const sequenceMode = useRef<'user' | 'admin' | null>(null);
  const resetTimeout = useRef<number | null>(null);

  const resetSequence = useCallback(() => {
    tapCount.current = 0;
    sequenceMode.current = null;
    if (resetTimeout.current) {
      window.clearTimeout(resetTimeout.current);
      resetTimeout.current = null;
    }
  }, []);

  const handleSequence = useCallback((mode: 'user' | 'admin') => {
    if (resetTimeout.current) {
      window.clearTimeout(resetTimeout.current);
    }
    resetTimeout.current = window.setTimeout(resetSequence, TAP_TIMEOUT_MS);

    if (sequenceMode.current === null) {
      sequenceMode.current = mode;
      tapCount.current = 1;
    } else if (sequenceMode.current !== mode) {
      resetSequence();
      sequenceMode.current = mode;
      tapCount.current = 1;
    } else {
      tapCount.current += 1;
    }

    if (tapCount.current >= TAP_SEQUENCE_COUNT) {
      onUnlock(sequenceMode.current!);
      resetSequence();
    }
  }, [onUnlock, resetSequence]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touches = e.touches.length;
    if (touches === 1) {
      handleSequence('user');
    } else if (touches === 2) {
      handleSequence('admin');
    } else {
      resetSequence();
    }
  }, [handleSequence, resetSequence]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === 't') {
      handleSequence('user');
    } else if (key === 'm') {
      handleSequence('admin');
    }
  }, [handleSequence]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (resetTimeout.current) {
        clearTimeout(resetTimeout.current);
      }
    };
  }, [handleKeyDown]);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ background: 'var(--bg-gradient)' }}
      onTouchStart={handleTouchStart}
    >
      <div className="absolute inset-0 bg-black/30"></div>
      <div className="relative text-center">
        <div className="cursor-pointer inline-block select-none p-4">
          <h1
            className="text-7xl sm:text-8xl md:text-9xl font-bold tracking-wider"
          >
            <span className="text-shimmer">MST</span>
          </h1>
          <p className="text-white/80 text-xl md:text-2xl mt-2">Martyho Solar Tracker</p>
          <div className="mt-12 flex flex-col items-center gap-2 animate-pulse">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Tap to start</p>
            <div className="flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;