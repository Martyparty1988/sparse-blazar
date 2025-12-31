
import { useRef, useCallback } from 'react';

interface SwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    threshold?: number;
}

export const useSwipe = (options: SwipeOptions) => {
    const { onSwipeLeft, onSwipeRight, threshold = 50 } = options;
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
        };
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current) {
            return;
        }

        const touchCurrentX = e.touches[0].clientX;
        const deltaX = touchStartRef.current.x - touchCurrentX;

        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0 && onSwipeLeft) {
                onSwipeLeft();
            } else if (onSwipeRight) {
                onSwipeRight();
            }
            touchStartRef.current = null;
        }
    }, [onSwipeLeft, onSwipeRight, threshold]);
    
    const handleTouchEnd = useCallback(() => {
        touchStartRef.current = null;
    }, []);

    return {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
    };
};

export default useSwipe;
