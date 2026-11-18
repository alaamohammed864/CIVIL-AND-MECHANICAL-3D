import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'menu';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isInstalled) {
    if (variant === 'header') return null;
    return (
      <div className="w-full min-h-[48px] px-4 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/40 flex items-center justify-between text-xs font-medium text-[#10b981]">
        <span className="flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> App Installed (Standalone Mode)
        </span>
        <Check className="w-4 h-4" />
      </div>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) setShowGuide(true);
    } else {
      setShowGuide(true);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(window.location.origin).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const guideModal =
    showGuide && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Install Mobile App Guide"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#111a24] border border-slate-200 dark:border-[#2c3f58] p-5 shadow-2xl space-y-4 text-xs text-slate-900 dark:text-[#dae3f1]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#1e2b3d] pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#00d2ff]" />
                  <h3 className="font-display font-bold text-sm text-slate-900 dark:text-[#dae3f1]">
                    Install 4M Cloud on Phone
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close install guide"
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[#8b9cb2] hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <ol className="space-y-2 text-slate-700 dark:text-[#bbc9cf] list-decimal list-inside leading-relaxed">
                  <li>
                    Open this URL in <strong>Safari</strong> on your iPhone or iPad.
                  </li>
                  <li>
                    Tap the <strong>Share</strong> icon in the bottom Safari toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                </ol>
              ) : (
                <ol className="space-y-2 text-slate-700 dark:text-[#bbc9cf] list-decimal list-inside leading-relaxed">
                  <li>
                    Open this link directly in <strong>Google Chrome</strong> on your Android phone (outside embedded previews).
                  </li>
                  <li>
                    Tap the browser menu <strong>⋮</strong> (top right) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                  <li>
                    Once installed, it launches full-screen as a standalone app and works offline via IndexedDB &amp; Service Worker cache.
                  </li>
                </ol>
              )}

              <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-[#0b1118] border border-slate-200 dark:border-[#1e2b3d] flex items-center justify-between gap-2">
                <span className="font-mono-tech text-[11px] text-[#0284c7] dark:text-[#00d2ff] truncate">
                  {window.location.origin}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-[#17202b] border border-slate-300 dark:border-[#2c3f58] text-slate-900 dark:text-[#dae3f1] flex items-center gap-1 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#10b981]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full min-h-[44px] rounded-2xl bg-[#00d2ff] text-[#0b1118] font-bold text-xs"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {variant === 'header' ? (
        isInstallable || isIOS ? (
          <button
            type="button"
            onClick={handleClick}
            aria-label="Install Mobile App"
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#00d2ff]/15 border border-[#00d2ff]/50 text-[#00d2ff] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:bg-[#00d2ff]/25 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        ) : null
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full min-h-[48px] px-4 rounded-2xl bg-[#00d2ff] text-[#0b1118] font-bold flex items-center justify-between text-xs shadow-sm hover:opacity-95 transition-opacity"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            {isIOS ? 'Install on iPhone / iPad' : 'Install Phone App (Offline PWA)'}
          </span>
          <span className="font-mono-tech text-[11px]">INSTALL</span>
        </button>
      )}
      {guideModal}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 left-3 z-40 flex items-center gap-2 rounded-xl bg-[#ff9f1c] px-3 py-1.5 text-xs font-medium text-[#0b1118] shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Cached BIM data active</span>
    </div>
  );
};
