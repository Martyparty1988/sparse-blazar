
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { firebaseService } from '../services/firebaseService';

const ConnectionStatusIndicator: React.FC = () => {
    const { t } = useI18n();
    const [isOnline, setIsOnline] = useState(firebaseService.isOnline);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        // Initial state
        setIsOnline(firebaseService.isOnline);
        setIsSyncing(firebaseService.pendingOps > 0);

        // Subscribe to changes
        const unsubscribe = firebaseService.onStatusChange((online, pending) => {
            setIsOnline(online);
            setIsSyncing(pending > 0);
        });

        return () => { unsubscribe(); };
    }, []);

    return (
        <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all duration-500 ${!isOnline ? 'bg-red-500/10 border-red-500/30' :
                isSyncing ? 'bg-blue-500/10 border-blue-500/30' :
                    'bg-green-500/10 border-green-500/30'
                }`}
            title={!isOnline ? (t('offline') || 'Offline') : isSyncing ? 'Synchronizuji...' : (t('online') || 'Online')}
        >
            <div className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' :
                isSyncing ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6] animate-spin rounded-sm' :
                    'bg-green-500 shadow-[0_0_8px_#22c55e]'
                } ${!isSyncing && 'animate-pulse'}`}></div>

            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-white/80">
                {!isOnline ? (t('offline') || 'OFFLINE') : isSyncing ? 'SYNC' : (t('online') || 'ONLINE')}
            </span>
        </div>
    );
};

export default ConnectionStatusIndicator;
