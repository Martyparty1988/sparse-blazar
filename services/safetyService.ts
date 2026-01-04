export class SafetyService {
    /**
     * Safely checks if an API exists in the global scope.
     */
    static has(api: string): boolean {
        return typeof window !== 'undefined' && api in window;
    }

    /**
     * Safely accesses localStorage without throwing SecurityError (Safari Private Mode).
     */
    static get storage(): Storage {
        try {
            const testKey = '__safety_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            return window.localStorage;
        } catch (e) {
            console.warn('LocalStorage not available (Private Mode?), using fallback.');
            return new InMemoryStorage();
        }
    }

    /**
     * Safely accesses sessionStorage without throwing.
     */
    static get session(): Storage {
        try {
            const testKey = '__safety_test__';
            window.sessionStorage.setItem(testKey, testKey);
            window.sessionStorage.removeItem(testKey);
            return window.sessionStorage;
        } catch (e) {
            return new InMemoryStorage();
        }
    }

    /**
     * Safe wrapper for Vibration API
     */
    static vibrate(pattern: number | number[]) {
        if (this.has('navigator') && 'vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignore vibration errors
            }
        }
    }

    /**
     * Safe wrapper for Notifications
     */
    static get notification(): typeof Notification | null {
        if (this.has('Notification')) {
            return Notification;
        }
        return null;
    }

    /**
     * Safe wrapper for Service Worker
     */
    static get serviceWorker() {
        if (this.has('navigator') && 'serviceWorker' in navigator) {
            return navigator.serviceWorker;
        }
        return null;
    }
}

/**
 * In-memory fallback for Storage interface
 */
class InMemoryStorage implements Storage {
    private data: Record<string, string> = {};

    getItem(key: string): string | null {
        return this.data[key] || null;
    }

    setItem(key: string, value: string): void {
        this.data[key] = String(value);
    }

    removeItem(key: string): void {
        delete this.data[key];
    }

    clear(): void {
        this.data = {};
    }

    key(index: number): string | null {
        return Object.keys(this.data)[index] || null;
    }

    get length(): number {
        return Object.keys(this.data).length;
    }
}

export const safety = SafetyService;
