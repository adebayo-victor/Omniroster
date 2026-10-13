import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Check, Monitor, X, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    // Detect if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowInfoModal(true);
    }
  };

  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono">
        <Check className="w-3.5 h-3.5" />
        PWA Installed
      </span>
    );
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs transition shadow-md shadow-cyan-500/20 flex items-center gap-1.5 active:scale-95 cursor-pointer"
        title="Install OmniRoster OS for offline terminal access"
      >
        {isIOS ? <Smartphone className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
        <span>Install App</span>
      </button>

      {/* Installation Instructions / Guide Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-slate-100 shadow-2xl relative">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                {isIOS ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Install OmniRoster OS
                </h3>
                <p className="text-xs text-slate-400">PWA Offline Biometric Terminal</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Install on your iPhone or iPad for fullscreen offline biometric kiosk mode:
                </p>
                <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <li>Tap the <strong className="text-white">Share</strong> button in Safari's bottom toolbar.</li>
                  <li>Scroll down and tap <strong className="text-cyan-400">Add to Home Screen</strong>.</li>
                  <li>Tap <strong className="text-white">Add</strong> in the top-right corner.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  OmniRoster OS is a Progressive Web App (PWA) with full offline support.
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">1.</span>
                    <span>Look for the <strong>Install OmniRoster</strong> icon in your browser's address bar (Chrome, Edge, Brave).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">2.</span>
                    <span>Or click browser menu (<span className="font-mono">⋮</span>) &rarr; <strong>"Install OmniRoster OS"</strong>.</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
