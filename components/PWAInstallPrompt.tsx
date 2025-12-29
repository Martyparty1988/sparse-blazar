
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import ShareIcon from './icons/ShareIcon';
import PlusSquareIcon from './icons/PlusSquareIcon';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallPrompt: React.FC = () => {
    const { t } = useI18n();
    const [isVisible, setIsVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | null>(null);

    useEffect(() => {
        // Detect platform
        const userAgent = navigator.userAgent.toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;

        const hasSeenPrompt = localStorage.getItem('hasSeenPWAInstallPrompt');
        const dismissCount = parseInt(localStorage.getItem('pwaPromptDismissCount') || '0');

        // Don't show if already installed or dismissed too many times
        if (isInStandaloneMode || dismissCount >= 3) {
            return;
        }

        // iOS detection
        if (isIOS && !hasSeenPrompt) {
            setPlatform('ios');
            // Show after 3 seconds delay
            setTimeout(() => setIsVisible(true), 3000);
        }

        // Android/Desktop - listen for beforeinstallprompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            const promptEvent = e as BeforeInstallPromptEvent;
            setDeferredPrompt(promptEvent);

            if (!hasSeenPrompt && dismissCount < 3) {
                setPlatform(isAndroid ? 'android' : 'desktop');
                setTimeout(() => setIsVisible(true), 3000);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        try {
            await deferredPrompt.prompt();
            const choiceResult = await deferredPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
                localStorage.setItem('hasSeenPWAInstallPrompt', 'true');
            }

            setDeferredPrompt(null);
            setIsVisible(false);
        } catch (error) {
            console.error('Error showing install prompt:', error);
        }
    };

    const handleDismiss = () => {
        const currentCount = parseInt(localStorage.getItem('pwaPromptDismissCount') || '0');
        localStorage.setItem('pwaPromptDismissCount', (currentCount + 1).toString());
        localStorage.setItem('hasSeenPWAInstallPrompt', 'true');
        setIsVisible(false);
    };

    if (!isVisible || !platform) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-slide-up">
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-center">
                    <div className="text-6xl mb-3">📱</div>
                    <h3 className="font-bold text-2xl text-white mb-2">
                        {platform === 'ios' ? 'Nainstalovat MST' : 'Přidat na plochu'}
                    </h3>
                    <p className="text-white/90 text-sm">
                        Rychlý přístup, offline režim, push notifikace
                    </p>
                </div>

                {/* Content */}
                <div className="p-6 text-white">
                    {platform === 'ios' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                Pro instalaci aplikace MST:
                            </p>
                            <ol className="space-y-3 text-sm">
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                    <span className="flex-1">
                                        Klepněte na tlačítko <ShareIcon className="inline-block w-4 h-4 mx-1" /> <strong>Sdílet</strong> v dolní liště Safari
                                    </span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                    <span className="flex-1">
                                        Posuňte dolů a vyberte <PlusSquareIcon className="inline-block w-4 h-4 mx-1" /> <strong>"Přidat na plochu"</strong>
                                    </span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                                    <span className="flex-1">
                                        Potvrďte klepnutím na <strong>"Přidat"</strong>
                                    </span>
                                </li>
                            </ol>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                Získejte rychlý přístup k MST přímo z domovské obrazovky. Aplikace funguje offline a nabízí nativní zážitek.
                            </p>
                            <div className="flex gap-3 text-xs text-gray-400">
                                <div className="flex items-center gap-1">
                                    <span className="text-green-400">✓</span> Offline režim
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-green-400">✓</span> Push notifikace
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-green-400">✓</span> Rychlý start
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={handleDismiss}
                        className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all duration-200 active:scale-95"
                    >
                        Možná později
                    </button>
                    {platform !== 'ios' && deferredPrompt && (
                        <button
                            onClick={handleInstallClick}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all duration-200 active:scale-95 shadow-lg"
                        >
                            Instalovat
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
