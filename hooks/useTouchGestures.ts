import { useEffect, useRef, useState, useCallback } from 'react';

interface TouchGestureOptions {
    onPinch?: (scale: number) => void;
    onPan?: (deltaX: number, deltaY: number) => void;
    onDoubleTap?: () => void;
    minScale?: number;
    maxScale?: number;
}

interface TouchPoint {
    x: number;
    y: number;
}

export const useTouchGestures = (options: TouchGestureOptions) => {
    const {
        onPinch,
        onPan,
        onDoubleTap,
        minScale = 0.5,
        maxScale = 5
    } = options;

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const lastTouchRef = useRef<TouchPoint | null>(null);
    const lastDistanceRef = useRef<number>(0);
    const lastTapTimeRef = useRef<number>(0);
    const isPinchingRef = useRef(false);

    const getDistance = (touch1: Touch, touch2: Touch): number => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (e.touches.length === 1) {
            lastTouchRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };

            // Double tap detection
            const now = Date.now();
            if (now - lastTapTimeRef.current < 300 && onDoubleTap) {
                onDoubleTap();
            }
            lastTapTimeRef.current = now;
        } else if (e.touches.length === 2) {
            isPinchingRef.current = true;
            lastDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
        }
    }, [onDoubleTap]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (e.touches.length === 2 && isPinchingRef.current && onPinch) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const delta = currentDistance - lastDistanceRef.current;
            const scaleChange = 1 + (delta / 200);

            const newScale = Math.max(minScale, Math.min(maxScale, scale * scaleChange));
            setScale(newScale);
            onPinch(newScale);

            lastDistanceRef.current = currentDistance;
        } else if (e.touches.length === 1 && lastTouchRef.current && !isPinchingRef.current && onPan) {
            const touch = e.touches[0];
            const deltaX = touch.clientX - lastTouchRef.current.x;
            const deltaY = touch.clientY - lastTouchRef.current.y;

            setPosition(prev => ({
                x: prev.x + deltaX,
                y: prev.y + deltaY
            }));

            onPan(deltaX, deltaY);

            lastTouchRef.current = {
                x: touch.clientX,
                y: touch.clientY
            };
        }
    }, [scale, minScale, maxScale, onPinch, onPan]);

    const handleTouchEnd = useCallback(() => {
        lastTouchRef.current = null;
        isPinchingRef.current = false;
    }, []);

    const resetGestures = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    return {
        scale,
        position,
        resetGestures,
        touchHandlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd
        }
    };
};

export default useTouchGestures;
