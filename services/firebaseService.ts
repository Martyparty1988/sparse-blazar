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
    persistentMultipleTabManager,
    query,
    where,
    Timestamp,
    WriteBatch,
    writeBatch,
    serverTimestamp
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getDatabase, ref, onValue, off, set, Database, onDisconnect } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';
import { db } from './db'; // Import Dexie instance

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
    syncedRecords?: number;
}

class FirebaseService {
    private app: FirebaseApp;
    private db: Firestore;
    private rtdb: Database;
    private auth: Auth;
    private messaging: Messaging | null = null;
    public isInitialized = false;
    public isOnline = false;
    public pendingOps = 0;
    private listeners: Set<(online: boolean, pending: number) => void> = new Set();

    constructor() {
        try {
            this.app = initializeApp(firebaseConfig);
            this.db = initializeFirestore(this.app, {
                localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
            });
            this.rtdb = getDatabase(this.app);
            this.auth = getAuth(this.app);

            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                try { this.messaging = getMessaging(this.app); } catch (e) { console.warn('Messaging not supported'); }
            }
            this.isInitialized = true;
            this.setupConnectivityListener();
            this.setupForegroundMessageListener();
            console.log('🔥 Firebase (Firestore) initialized with Persistence');
        } catch (error) {
            console.error('Firebase auto-init failed:', error);
            this.app = null as any; this.db = null as any; this.rtdb = null as any;
        }
    }

    public get isReady() { return this.isInitialized && this.db !== null; }
    public get getAuth() { return this.auth; }

    public subscribe(path: string, callback: (data: any) => void) {
        if (!this.rtdb) return () => { };
        const dbRef = ref(this.rtdb, path);
        onValue(dbRef, (snapshot) => {
            callback(snapshot.val());
        });
        return () => off(dbRef);
    }

    public unsubscribe(path: string) {
        if (!this.rtdb) return;
        off(ref(this.rtdb, path));
    }

    public async setTypingStatus(channelId: string, userId: number, userName: string, isTyping: boolean) {
        if (!this.rtdb) return;
        const path = `chat/${channelId}/typing/${userId}`;
        const typingRef = ref(this.rtdb, path);

        if (isTyping) {
            // Set timestamp and remove on disconnect
            await set(typingRef, { name: userName, timestamp: serverTimestamp() });
            onDisconnect(typingRef).remove();
        } else {
            await set(typingRef, null);
        }
    }

    public subscribeTypingStatus(channelId: string, callback: (typingUsers: { [key: string]: { name: string, timestamp: number } }) => void) {
        if (!this.rtdb) return () => { };
        const path = `chat/${channelId}/typing`;
        const typingRef = ref(this.rtdb, path);

        onValue(typingRef, (snapshot) => {
            callback(snapshot.val() || {});
        });

        return () => off(typingRef);
    }

    public async setData(path: string, data: any): Promise<SyncResult> {
        if (!this.rtdb) return { success: false, error: 'RTDB not ready' };
        try {
            await set(ref(this.rtdb, path), data);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    public async requestNotificationPermission(workerId?: number) {
        if (!this.messaging) return null;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(this.messaging, {
                    vapidKey: 'BM6F-pXyU3R_5e7H8u1X2zR_L6VqW6X0H_Z0z2X0W_z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z' // Use real VAPID key if possible, or omit if default works
                });

                if (token) {
                    console.log('FCM Token:', token);
                    // Update worker in RTDB and Firestore
                    await this.setData(`workers/${workerId}`, { id: workerId, fcmToken: token });
                    await this.updateRecord('workers', String(workerId), { fcmToken: token });
                    return token;
                }
            }
        } catch (error) {
            console.error('Permission/Token error:', error);
        }
        return null;
    }

    private setupForegroundMessageListener() {
        if (this.messaging) {
            onMessage(this.messaging, (payload) => {
                console.log('Foreground Message received: ', payload);
                // In foreground, we can just show a toast or rely on UI updates
                // But typically we don't show a system notification
            });
        }
    }

    private setupConnectivityListener() {
        const connectedRef = ref(this.rtdb, ".info/connected");
        onValue(connectedRef, (snap) => {
            this.isOnline = snap.val() === true;
            console.log(this.isOnline ? "📡 App is ONLINE" : "🔌 App is OFFLINE");
            this.notify();
        });
    }

    private notify() { this.listeners.forEach(cb => cb(this.isOnline, this.pendingOps)); }

    public onStatusChange(callback: (online: boolean, pending: number) => void) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    // ========== NEW: CENTRALIZED SYNC LOGIC ==========
    public async synchronize(forceFull: boolean = false): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not ready' };
        console.log(`🔄 Starting sync... ${forceFull ? '(Full Sync)' : '(Incremental Sync)'}`);

        this.pendingOps++;
        this.notify();

        try {
            const lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');
            const lastSyncDate = (lastSyncTimestamp && !forceFull) ? new Date(parseInt(lastSyncTimestamp, 10)) : null;

            const collectionsToSync = {
                workers: db.workers,
                projects: db.projects,
                tools: db.tools,
                fieldTables: db.fieldTables,
                dailyReports: db.dailyReports,
                records: db.records,
                projectTasks: db.projectTasks
            };

            const newSyncTime = new Date();

            // 1. Fetch all data from Firebase first (outside of Dexie transaction)
            const syncedData: { [key: string]: any[] } = {};
            let fetchedCount = 0;

            console.log('Fetching data from Firebase...');
            const fetchPromises = Object.entries(collectionsToSync).map(async ([name, table]) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                const q = lastSyncDate
                    ? query(collection(this.db, name), where("updatedAt", ">", Timestamp.fromDate(lastSyncDate)))
                    : collection(this.db, name);

                const snapshot = await getDocs(q);
                if (snapshot.empty) return;

                const records: any[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const record: { [key: string]: any } = { id: doc.id };
                    // Convert Timestamps to Dates for Dexie
                    for (const key in data) {
                        if (data[key] instanceof Timestamp) {
                            record[key] = data[key].toDate();
                        } else {
                            record[key] = data[key];
                        }
                    }
                    records.push(record);
                });
                syncedData[name] = records;
                fetchedCount += records.length;
                console.log(`Fetched ${records.length} records for ${name}`);
            });

            await Promise.all(fetchPromises);

            // 2. Write to Dexie in a single transaction
            console.log(`Writing ${fetchedCount} records to Dexie...`);
            let totalSynced = 0;

            await db.transaction('rw', Object.values(collectionsToSync), async () => {
                // If full sync, clear tables first
                if (lastSyncDate === null) {
                    console.log('Clearing local tables for full sync...');
                    const clearPromises = Object.values(collectionsToSync).map(table => table.clear());
                    await Promise.all(clearPromises);
                }

                // Bulk Put
                const putPromises = Object.entries(syncedData).map(async ([name, records]) => {
                    if (records.length > 0) {
                        const table = collectionsToSync[name as keyof typeof collectionsToSync];
                        if (table) {
                            await (table as any).bulkPut(records);
                            totalSynced += records.length;
                        }
                    }
                });
                await Promise.all(putPromises);
            });

            localStorage.setItem('lastSyncTimestamp', String(newSyncTime.getTime()));
            console.log(`✅ Sync finished. Synced ${totalSynced} records.`);
            return { success: true, syncedRecords: totalSynced };

        } catch (error: any) {
            console.error('Sync failed:', error);
            // In case of error, remove timestamp to force full sync next time
            localStorage.removeItem('lastSyncTimestamp');
            return { success: false, error: error.message };
        } finally {
            this.pendingOps = Math.max(0, this.pendingOps - 1);
            this.notify();
        }
    }


    // Original methods below (can be simplified later if needed)
    public async upsertRecords(collectionName: string, records: any[]): Promise<SyncResult> {
        if (!this.isReady || records.length === 0) return { success: true };
        this.pendingOps++; this.notify();
        try {
            const batch = writeBatch(this.db);
            records.forEach(record => {
                if (record.id) {
                    // Add updatedAt timestamp for incremental sync
                    const data = { ...record, updatedAt: serverTimestamp() };
                    batch.set(doc(this.db, collectionName, String(record.id)), data, { merge: true });
                }
            });
            await batch.commit();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        } finally {
            this.pendingOps = Math.max(0, this.pendingOps - 1); this.notify();
        }
    }

    public async updateRecord(collectionName: string, id: string, data: any): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not ready' };
        try {
            // Add updatedAt timestamp for incremental sync
            const recordToUpdate = { ...data, updatedAt: serverTimestamp() };
            await updateDoc(doc(this.db, collectionName, id), recordToUpdate);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    public async deleteRecords(collectionName: string, ids: string[]): Promise<SyncResult> {
        // Deletion needs special handling for sync (e.g. `deletedAt` flag), not implemented yet.
        if (!this.isReady || ids.length === 0) return { success: true };
        try {
            const batch = writeBatch(this.db);
            ids.forEach(id => batch.delete(doc(this.db, collectionName, String(id))));
            await batch.commit();
            return { success: true };
        } catch (error: any) { return { success: false, error: error.message }; }
    }

    // ... other methods from original file (getData, setData, etc.)

}

export const firebaseService = new FirebaseService();
