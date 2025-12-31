
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
        // Target the main scrollable area defined in Layout.tsx
        const scrollContainer = document.querySelector('main') || window;

        const handleTouchStart = (e: any) => {
            // Check scrollTop of the container, or scrollY if it's the window
            const scrollTop = 'scrollTop' in scrollContainer ? scrollContainer.scrollTop : window.scrollY;

            if (scrollTop === 0) { // Only when at the top
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        };

        const handleTouchMove = (e: any) => {
            if (!isPulling) return;

            // If we scrolled down during the pull, cancel
            const scrollTop = 'scrollTop' in scrollContainer ? scrollContainer.scrollTop : window.scrollY;
            if (scrollTop > 0) {
                isPulling = false;
                return;
            }

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

        // We need to attach to the container if possible, but touch events often bubble. 
        // Attaching to window is usually safer for capturing swipes, but we must check scrollTop of the CONTAINER.
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
