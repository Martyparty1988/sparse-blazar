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
    writeBatch
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { getDatabase, ref, onValue, Database } from 'firebase/database';
import { db } from './db'; // Import Dexie instance

const firebaseConfig = {
    apiKey: "AIzaSyC0wgEBrqvx4Uge7upoSqZXFkSwXKb9hqE",
    authDomain: "mst-marty-solar-2025.firebaseapp.com",
    databaseURL: "https://mst-marty-solar-2025-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mst-marty-solar-2025",
    storageBucket: "mst-marty-solar-2025.firebasestorage.app",
    messagingSenderId: "706935785372",
    appId: "1:706935785372:web:ccb7e109ba3eccd7e2ea59"
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

            if (lastSyncDate === null) {
                console.log('Performing full sync, clearing local data...');
                for (const table of Object.values(collectionsToSync)) {
                    await table.clear();
                }
            }

            const newSyncTime = new Date();
            let totalSynced = 0;

            await db.transaction('rw', Object.values(collectionsToSync), async () => {
                const syncPromises = Object.entries(collectionsToSync).map(async ([name, table]) => {
                    const q = lastSyncDate
                        ? query(collection(this.db, name), where("updatedAt", ">", Timestamp.fromDate(lastSyncDate)))
                        : collection(this.db, name);

                    const snapshot = await getDocs(q);
                    if (snapshot.empty) return;

                    const recordsToUpsert: any[] = [];
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
                        recordsToUpsert.push(record);
                    });

                    if (recordsToUpsert.length > 0) {
                        await table.bulkPut(recordsToUpsert);
                        totalSynced += recordsToUpsert.length;
                        console.log(`Synced ${recordsToUpsert.length} records for ${name}`);
                    }
                });
                await Promise.all(syncPromises);
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

// Helper to get server-side timestamp
import { serverTimestamp } from 'firebase/firestore';

export const firebaseService = new FirebaseService();
