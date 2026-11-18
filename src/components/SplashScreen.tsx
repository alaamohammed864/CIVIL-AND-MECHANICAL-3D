import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  durationMs = 3000,
}) => {
  const [progress, setProgress] = useState(1);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let frameId = 0;
    let finishTimer: number | undefined;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / durationMs);
      const nextValue = Math.min(100, Math.max(1, Math.floor(ratio * 99) + 1));
      setProgress(nextValue);

      if (ratio < 1) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setExiting(true);
        finishTimer = window.setTimeout(onComplete, 220);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      if (finishTimer) window.clearTimeout(finishTimer);
    };
  }, [durationMs, onComplete]);

  return (
    <div
      role="status"
      aria-label="Loading 4M Engineering Cloud"
      className={`fixed inset-0 z-[100] flex flex-col justify-between bg-[#0b1118] overflow-hidden select-none transition-opacity duration-200 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Full-Screen Splash Image */}
      <img
        src="/assets/aistudio/______bcb28203.png"
        alt="Splash Background"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Subtle gradient scrims for legibility without hiding the image */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/15 to-black/75" />

      {/* Top Brand & Developer Card */}
      <div className="relative z-10 pt-8 px-4 flex justify-center">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 shadow-xl max-w-sm w-full">
          <img
            src="/assets/aistudio/file_00000000aab48211b10c0f662c6d35c8_7abda86e.png"
            alt="App Icon"
            className="w-12 h-12 rounded-xl object-cover border border-white/25 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-display font-bold text-sm sm:text-base text-white tracking-wide truncate">
              4M ENGINEERING CLOUD
            </h1>
            <p className="text-xs font-semibold text-[#00d2ff] tracking-wider truncate">
              ENG ALAA MOHAMMED
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Transparent 1-100% Counter (3 Seconds) */}
      <div className="relative z-10 pb-10 px-5 flex flex-col items-center">
        <div className="w-full max-w-xs rounded-2xl bg-black/25 backdrop-blur-md border border-white/25 px-4 py-3.5 shadow-2xl space-y-2.5">
          <div className="flex items-center justify-between text-white">
            <span className="text-xs font-medium tracking-wide text-white/90">
              جاري تشغيل التطبيق...
            </span>
            <span
              data-testid="splash-counter"
              className="font-mono-tech text-lg font-bold tabular-nums text-[#00d2ff]"
            >
              {progress}%
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-white/15 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-[#00d2ff] transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-center text-[11px] font-mono-tech text-white/80 tracking-wider">
            Developer: ENG ALAA MOHAMMED
          </div>
        </div>
      </div>
    </div>
  );
};
