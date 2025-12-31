
import { useState, useEffect, useCallback } from 'react';

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<any>;
    debounceTime?: number;
}

const usePullToRefresh = (options: UsePullToRefreshOptions) => {
    const { onRefresh, debounceTime = 500 } = options;
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(0);

    const handleRefresh = useCallback(async () => {
        const now = Date.now();
        if (now - lastRefresh < debounceTime) return;
        
        setIsRefreshing(true);
        setLastRefresh(now);
        try {
            await onRefresh();
        } finally {
            // Add a small delay to make the refresh indicator visible
            setTimeout(() => setIsRefreshing(false), 300);
        }
    }, [onRefresh, lastRefresh, debounceTime]);

    useEffect(() => {
        let startY = 0;
        let isPulling = false;

        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) { // Only when at the top of the page
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 80) { // Threshold to trigger refresh
                handleRefresh();
                isPulling = false; // Prevent multiple refreshes
            }
        };

        const handleTouchEnd = () => {
            isPulling = false;
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };

    }, [handleRefresh]);

    return { isRefreshing };
};

export default usePullToRefresh;
