class SoundService {
    private audioContext: AudioContext | null = null;
    private isMuted: boolean = false;

    constructor() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext not supported');
        }
    }

    private ensureContext() {
        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    private vibrate(duration: number = 10) {
        if (typeof window.navigator.vibrate === 'function') {
            window.navigator.vibrate(duration);
        }
    }

    setMuted(muted: boolean) {
        this.isMuted = muted;
    }

    // Příjemný "cink" pro zprávu
    playMessageReceived() {
        this.vibrate(20);
        if (this.isMuted || !this.audioContext) return;
        this.ensureContext();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, this.audioContext.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.3);
    }

    // Pozitivní "akord" pro úspěch
    playSuccess() {
        this.vibrate(50);
        if (this.isMuted || !this.audioContext) return;
        this.ensureContext();

        const now = this.audioContext.currentTime;

        // Tři tóny (akord C major)
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = this.audioContext!.createOscillator();
            const gain = this.audioContext!.createGain();

            osc.connect(gain);
            gain.connect(this.audioContext!.destination);

            osc.type = 'triangle';
            osc.frequency.value = freq;

            // Postupný nástup pro "arpeggio" efekt
            const start = now + (i * 0.05);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.4);

            osc.start(start);
            osc.stop(start + 0.5);
        });
    }

    // Krátké haptické "kliknutí" (zvuk)
    playClick() {
        this.vibrate(10);
        if (this.isMuted || !this.audioContext) return;
        this.ensureContext();

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.frequency.setValueAtTime(800, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.05);

        gain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.05);
    }
}

export const soundService = new SoundService();
