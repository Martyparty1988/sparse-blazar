import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, child, update, remove, Database, onValue, off } from 'firebase/database';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

// Hardcoded configuration for MST App
const firebaseConfig = {
    apiKey: "AIzaSyC0wgEBrqvx4Uge7upoSqZXFkSwXKb9hqE",
    authDomain: "mst-marty-solar-2025.firebaseapp.com",
    databaseURL: "https://mst-marty-solar-2025-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mst-marty-solar-2025",
    storageBucket: "mst-marty-solar-2025.firebasestorage.app",
    messagingSenderId: "706935785372",
    appId: "1:706935785372:web:0f21a739f8acbeb3e2ea59"
};

export interface SyncResult {
    success: boolean;
    error?: string;
}

class FirebaseService {
    private app: FirebaseApp;
    private db: Database;
    private messaging: Messaging | null = null;
    public isInitialized = false;
    public isOnline = false;
    public pendingOps = 0;
    private listeners: Set<(online: boolean, pending: number) => void> = new Set();

    constructor() {
        try {
            this.app = initializeApp(firebaseConfig);
            this.db = getDatabase(this.app);

            // Initialize Messaging only if supported (some browsers/incognito don't support it)
            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                try {
                    this.messaging = getMessaging(this.app);
                } catch (e) {
                    console.warn('Messaging not supported in this browser');
                }
            }

            this.isInitialized = true;
            this.setupConnectivityListener();
            this.setupForegroundMessageListener();
            console.log('🔥 Firebase initialized automatically');
        } catch (error) {
            console.error('Firebase auto-init failed:', error);
            // We can't do much if init fails, but we should handle it gracefully
            // By casting to any we allow usage but methods will likely fail or we check isInitialized
            this.app = null as any;
            this.db = null as any;
        }
    }

    public get isReady() {
        return this.isInitialized && this.db !== null;
    }

    private setupConnectivityListener() {
        const connectedRef = ref(this.db, ".info/connected");
        onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                this.isOnline = true;
                console.log("📡 App is ONLINE (Firebase)");
            } else {
                this.isOnline = false;
                console.log("🔌 App is OFFLINE (Firebase)");
            }
            this.notify();
        });
    }

    private notify() {
        this.listeners.forEach(cb => cb(this.isOnline, this.pendingOps));
    }

    public onStatusChange(callback: (online: boolean, pending: number) => void) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // --- Generic Data Operations ---

    // Write (Set/Overwrite) data to a path
    public async setData(path: string, data: any): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not initialized' };
        try {
            await set(ref(this.db, path), data);
            return { success: true };
        } catch (error: any) {
            console.error(`Firebase Set Error (${path}):`, error);
            return { success: false, error: error.message };
        }
    }

    // Update data at a path (updates specific keys, keeps others)
    public async updateData(path: string, data: any): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not initialized' };
        try {
            await update(ref(this.db, path), data);
            return { success: true };
        } catch (error: any) {
            console.error(`Firebase Update Error (${path}):`, error);
            return { success: false, error: error.message };
        }
    }

    // Read data once
    public async getData(path: string): Promise<any> {
        if (!this.isReady) return null;
        try {
            const snapshot = await get(child(ref(this.db), path));
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                return null;
            }
        } catch (error) {
            console.error(`Firebase Get Error (${path}):`, error);
            return null;
        }
    }

    // Remove data
    public async removeData(path: string): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not initialized' };
        try {
            await remove(ref(this.db, path));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // --- Realtime Listeners ---

    public subscribe(path: string, callback: (data: any) => void) {
        if (!this.isReady) return;
        const dataRef = ref(this.db, path);
        onValue(dataRef, (snapshot) => {
            const data = snapshot.val();
            callback(data);
        });
    }

    public unsubscribe(path: string) {
        if (!this.isReady) return;
        const dataRef = ref(this.db, path);
        off(dataRef);
    }

    // --- Specific MST Helpers (Migration from Google Sheets logic) ---

    // Upsert array of records (like workers, tools)
    // Firebase stores lists best as Objects with IDs as keys, OR arrays.
    // We will store as Objects: /workers/{id} = { ...workerData }
    public async upsertRecords(collectionName: string, records: any[]): Promise<SyncResult> {
        if (!this.isReady || records.length === 0) return { success: true };

        const updates: any = {};
        records.forEach(record => {
            if (record.id) {
                // Remove undefined values, Firebase doesn't like them
                const cleanRecord = JSON.parse(JSON.stringify(record));
                updates[`/${collectionName}/${record.id}`] = cleanRecord;
            }
        });

        this.pendingOps++;
        this.notify();
        const res = await this.updateData('/', updates);
        this.pendingOps = Math.max(0, this.pendingOps - 1);
        this.notify();
        return res;
    }

    public async deleteRecords(collectionName: string, ids: string[]): Promise<SyncResult> {
        if (!this.isReady || ids.length === 0) return { success: true };

        const updates: any = {};
        ids.forEach(id => {
            updates[`/${collectionName}/${id}`] = null; // Setting to null deletes it
        });

        return this.updateData('/', updates);
    }

    // --- Push Notifications (FCM) ---

    private setupForegroundMessageListener() {
        if (!this.messaging) return;
        onMessage(this.messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            // This is handled by the browser if the app is in background/closed,
            // but for foreground we can show a custom notification or toast.
            if (payload.notification) {
                const { title, body, icon } = payload.notification;
                new Notification(title || 'MST', {
                    body,
                    icon: icon || '/icon-192.svg'
                });
            }
        });
    }

    public async requestNotificationPermission(workerId?: number): Promise<string | null> {
        if (!this.messaging) return null;

        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(this.messaging, {
                    // vapidKey: "..." // Using default VAPID key from project config
                });

                if (token && workerId) {
                    // Save token to worker profile for backend use
                    await this.updateData(`/workers/${workerId}/fcmToken`, token);
                    console.log('FCM Token generated and saved:', token);
                }
                return token;
            }
        } catch (error) {
            console.error('Error getting notification permission:', error);
        }
        return null;
    }
}

export const firebaseService = new FirebaseService();
