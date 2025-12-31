import { initializeApp, FirebaseApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    Firestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getDatabase, ref, onValue, Database } from 'firebase/database'; // Kept for .info/connected

// Hardcoded configuration for MST App
const firebaseConfig = {
    apiKey: "AIzaSyC0wgEBrqvx4Uge7upoSqZXFkSwXKb9hqE",
    authDomain: "mst-marty-solar-2025.firebaseapp.com",
    projectId: "mst-marty-solar-2025",
    storageBucket: "mst-marty-solar-2025.firebasestorage.app",
    messagingSenderId: "706935785372",
    appId: "1:706935785372:web:0f21a739f8acbeb3e2ea59",
    databaseURL: "https://mst-marty-solar-2025-default-rtdb.europe-west1.firebasedatabase.app" // Kept for presence/connectivity
};

export interface SyncResult {
    success: boolean;
    error?: string;
}

class FirebaseService {
    private app: FirebaseApp;
    private db: Firestore;
    private rtdb: Database; // For connectivity status
    private messaging: Messaging | null = null;
    public isInitialized = false;
    public isOnline = false;
    public pendingOps = 0;
    private listeners: Set<(online: boolean, pending: number) => void> = new Set();

    constructor() {
        try {
            this.app = initializeApp(firebaseConfig);

            // Initialize Firestore with Persistent Local Cache (Offline Persistence)
            this.db = initializeFirestore(this.app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });

            // Initialize Realtime DB just for connectivity monitoring
            this.rtdb = getDatabase(this.app);

            // Initialize Messaging
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
            console.log('🔥 Firebase (Firestore) initialized with Persistence');
        } catch (error) {
            console.error('Firebase auto-init failed:', error);
            this.app = null as any;
            this.db = null as any;
            this.rtdb = null as any;
        }
    }

    public get isReady() {
        return this.isInitialized && this.db !== null;
    }

    private setupConnectivityListener() {
        // We use Realtime DB for accurate connection status, as Firestore doesn't have a direct equivalent
        const connectedRef = ref(this.rtdb, ".info/connected");
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

    // --- Data Operations (Firestore) ---

    // Helper to parse path 'collection' or 'collection/docId'
    private getRef(path: string) {
        const parts = path.split('/').filter(p => p);
        if (parts.length % 2 === 0) {
            return doc(this.db, path);
        } else {
            return collection(this.db, path);
        }
    }

    // Write (Set/Overwrite) - compatible with 'path' argument usually being collection/docId
    public async setData(path: string, data: any): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not initialized' };
        try {
            const parts = path.split('/').filter(p => p);
            // If path is just a collection name, we can't 'set' it directly without an ID.
            // But App usage is mostly specific documents or lists.
            // If we are setting a specific document:
            if (parts.length % 2 === 0) {
                await setDoc(doc(this.db, path), data);
            } else {
                return { success: false, error: 'Cannot set entire collection directly via setData' };
            }
            return { success: true };
        } catch (error: any) {
            console.error(`Firebase Set Error (${path}):`, error);
            return { success: false, error: error.message };
        }
    }

    // Update
    public async updateData(path: string, data: any): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not initialized' };
        try {
            // Firestore update requires a document reference
            // RTDB updates could be at root, but Firestore needs Collection/Doc structure.

            // Handling generic root updates (migration compatibility):
            // If path is '/', data keys are likely paths like 'workers/1'
            if (path === '/') {
                const batchPromises = Object.keys(data).map(key => {
                    const cleanKey = key.startsWith('/') ? key.slice(1) : key;
                    // key is like 'workers/123'
                    const val = data[key];
                    if (val === null) {
                        return deleteDoc(doc(this.db, cleanKey));
                    } else {
                        // Use setDoc with merge to simulate update/upsert
                        return setDoc(doc(this.db, cleanKey), val, { merge: true });
                    }
                });
                await Promise.all(batchPromises);
            } else {
                // Determine if path is doc or collection
                const parts = path.split('/').filter(p => p);
                if (parts.length % 2 === 0) {
                    await updateDoc(doc(this.db, path), data);
                } else {
                    // It's a collection? Can't update collection. 
                    // But if usage is updateData('workers/1', {...}), it works.
                    return { success: false, error: 'Invalid path for update' };
                }
            }
            return { success: true };
        } catch (error: any) {
            console.error(`Firebase Update Error (${path}):`, error);
            return { success: false, error: error.message };
        }
    }

    // Read - Returns Object Map {id: data} for collections to match RTDB behavior
    public async getData(path: string): Promise<any> {
        if (!this.isReady) return null;
        try {
            const parts = path.split('/').filter(p => p);

            // If Fetching Collection (e.g., "workers")
            if (parts.length % 2 !== 0) {
                const querySnapshot = await getDocs(collection(this.db, path));
                const result: any = {};
                querySnapshot.forEach((doc) => {
                    result[doc.id] = { id: doc.id, ...doc.data() };
                });
                return Object.keys(result).length > 0 ? result : null;
            }
            // If Fetching Document (e.g., "workers/123")
            else {
                const docSnap = await getDoc(doc(this.db, path));
                if (docSnap.exists()) {
                    return { id: docSnap.id, ...docSnap.data() };
                }
                return null;
            }
        } catch (error) {
            console.error(`Firebase Get Error (${path}):`, error);
            return null;
        }
    }

    // Remove
    public async removeData(path: string): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not initialized' };
        try {
            await deleteDoc(doc(this.db, path));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // --- Realtime Listeners ---

    public subscribe(path: string, callback: (data: any) => void) {
        if (!this.isReady) return;
        const parts = path.split('/').filter(p => p);

        let unsub;
        if (parts.length % 2 !== 0) {
            // Collection listener
            unsub = onSnapshot(collection(this.db, path), (snapshot) => {
                const result: any = {};
                snapshot.forEach((doc) => {
                    result[doc.id] = { id: doc.id, ...doc.data() };
                });
                callback(result);
            });
        } else {
            // Document listener
            unsub = onSnapshot(doc(this.db, path), (doc) => {
                if (doc.exists()) callback({ id: doc.id, ...doc.data() });
                else callback(null);
            });
        }
        // Ideally store unsub to call later, but currently specific unsubscribe not implemented fully in this shim
    }

    public unsubscribe(path: string) {
        // Firestore unsubscription is function-based, this placeholder prevents errors
        // In a full implementation, we'd map paths to unsub functions.
    }

    // --- MST Helpers ---

    public async upsertRecords(collectionName: string, records: any[]): Promise<SyncResult> {
        if (!this.isReady || records.length === 0) return { success: true };

        this.pendingOps++;
        this.notify();

        try {
            const batchPromises = records.map(record => {
                if (record.id) {
                    const cleanRecord = JSON.parse(JSON.stringify(record));
                    // Ensure ID is string for doc ref
                    return setDoc(doc(this.db, collectionName, String(record.id)), cleanRecord, { merge: true });
                }
                return Promise.resolve();
            });

            await Promise.all(batchPromises);

            this.pendingOps = Math.max(0, this.pendingOps - 1);
            this.notify();
            return { success: true };
        } catch (error: any) {
            this.pendingOps = Math.max(0, this.pendingOps - 1);
            this.notify();
            return { success: false, error: error.message };
        }
    }

    public async deleteRecords(collectionName: string, ids: string[]): Promise<SyncResult> {
        if (!this.isReady || ids.length === 0) return { success: true };

        try {
            await Promise.all(ids.map(id => deleteDoc(doc(this.db, collectionName, String(id)))));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // --- Push Notifications (FCM) ---

    private setupForegroundMessageListener() {
        if (!this.messaging) return;
        onMessage(this.messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
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
                const token = await getToken(this.messaging);
                if (token && workerId) {
                    await setDoc(doc(this.db, 'workers', String(workerId)), { fcmToken: token }, { merge: true });
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
