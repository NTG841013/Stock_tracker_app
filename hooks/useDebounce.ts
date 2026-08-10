'use client';

import { useCallback, useEffect, useRef } from 'react';

// Debounces a callback while keeping a stable debounced function reference between renders.
// This prevents infinite loops when used inside effects.
export function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callbackRef = useRef<T>(callback);

    // Always keep latest callback in a ref so the debounced function doesn't change identity
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return useCallback((...args: Parameters<T>) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            callbackRef.current(...args);
        }, delay);
    }, [delay]);
}