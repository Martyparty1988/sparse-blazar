import { safety } from './safetyService';

/**
 * Service for providing haptic feedback using the Web Vibration API.
 * This enhances the "native app" feel on mobile devices.
 */
class HapticService {
    private enabled: boolean = true;

    constructor() {
        // Safe storage access
        const saved = safety.storage.getItem('haptics_enabled');
        if (saved !== null) {
            this.enabled = saved === 'true';
        }
    }

    public setEnabled(enabled: boolean) {
        this.enabled = enabled;
        safety.storage.setItem('haptics_enabled', String(enabled));
        if (enabled) this.light(); // Confirm selection
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Very light vibration for UI interactions like taps
     */
    public light() {
        if (!this.enabled) return;
        safety.vibrate(10);
    }

    /**
     * Medium vibration for significant actions (e.g. toggles)
     */
    public medium() {
        if (!this.enabled) return;
        safety.vibrate(40);
    }

    /**
     * Heavy vibration for destructive actions or long presses
     */
    public heavy() {
        if (!this.enabled) return;
        safety.vibrate(80);
    }

    /**
     * Success pattern (two light taps)
     */
    public success() {
        if (!this.enabled) return;
        safety.vibrate([10, 40, 20]);
    }

    /**
     * Error pattern (double heavy tap)
     */
    public error() {
        if (!this.enabled) return;
        safety.vibrate([80, 50, 80]);
    }
}

export const hapticService = new HapticService();
