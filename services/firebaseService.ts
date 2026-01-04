import { initializeApp, FirebaseApp, getApps, getApp } from 'firebase/app';
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
import { getDatabase, ref, set, push, onValue, off, remove, goOnline, goOffline, onDisconnect, get, Database } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { db } from './db'; // Import Dexie instance
import { safety } from './safetyService';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
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
    public currentFcmToken: string | null = null;
    public isInitialized = false;
    public isOnline = false;
    public pendingOps = 0;
    private listeners: Set<(online: boolean, pending: number) => void> = new Set();

    constructor() {
        try {
            if (!getApps().length) {
                this.app = initializeApp(firebaseConfig);
            } else {
                this.app = getApp();
            }

            this.db = getFirestore(this.app);
            this.rtdb = getDatabase(this.app);
            this.auth = getAuth(this.app);

            if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                try { this.messaging = getMessaging(this.app); } catch (e) { console.warn('Messaging not supported'); }
            }
            this.isInitialized = true;
            this.setupConnectivityListener();
            this.setupForegroundMessageListener();
            console.log('🔥 Firebase initialized');
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

    public async toggleReaction(channelId: string, messageId: string, emoji: string, userId: number) {
        if (!this.rtdb) return; // Changed from this.db to this.rtdb
        const path = `chat/${channelId}/${messageId}/reactions/${emoji}`;
        const snapshot = await get(ref(this.rtdb, path)); // Changed from this.db to this.rtdb
        const users: number[] = snapshot.val() || [];

        let newUsers;
        if (users.includes(userId)) {
            newUsers = users.filter(id => id !== userId);
        } else {
            newUsers = [...users, userId];
        }

        if (newUsers.length === 0) {
            await remove(ref(this.rtdb, path)); // Changed from this.db to this.rtdb
        } else {
            await set(ref(this.rtdb, path), newUsers); // Changed from this.db to this.rtdb
        }
    }

    public async markAsSeen(channelId: string, userId: number) {
        if (!this.rtdb) return;
        try {
            const path = `chat/${channelId}/seen/${userId}`;
            await set(ref(this.rtdb, path), new Date().toISOString());
        } catch (error) {
            console.warn('markAsSeen failed:', error);
        }
    }

    public async setTypingStatus(channelId: string, userId: number, userName: string, isTyping: boolean) {
        if (!this.rtdb) return;
        try {
            const path = `chat/${channelId}/typing/${userId}`;
            const typingRef = ref(this.rtdb, path);

            if (isTyping) {
                // Set timestamp and remove on disconnect
                await set(typingRef, { name: userName, timestamp: serverTimestamp() });
                onDisconnect(typingRef).remove();
            } else {
                await set(typingRef, null);
            }
        } catch (error) {
            console.warn('setTypingStatus failed:', error);
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

        // Safety check using SafetyService or direct check
        if (!safety.notification) {
            console.warn('Notifications not supported in this environment');
            return null;
        }

        try {
            const permission = await safety.notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(this.messaging, {
                    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
                });

                if (token) {
                    this.currentFcmToken = token;
                    console.log('FCM Token:', token);
                    // Update worker in RTDB and Firestore
                    if (workerId) {
                        await this.setData(`workers/${workerId}`, { id: workerId, fcmToken: token, lastSeen: new Date().toISOString() });
                        await this.updateRecord('workers', String(workerId), { fcmToken: token });
                    }
                    return token;
                }
            }
        } catch (error) {
            console.error('Permission/Token error:', error);
        }
        return null;
    }

    public updateBadge(count: number) {
        if (safety.has('navigator') && 'setAppBadge' in navigator) {
            if (count > 0) {
                (navigator as any).setAppBadge(count).catch(console.error);
            } else {
                (navigator as any).clearAppBadge().catch(console.error);
            }
        }
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
        if (!this.rtdb) return;
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
    private isSyncing = false;

    public async synchronize(forceFull: boolean = false): Promise<SyncResult> {
        if (!this.isReady) return { success: false, error: 'Firebase not ready' };

        // Debounce: prevent overlapping syncs (User Rule 5: prevent spam)
        if (this.isSyncing) {
            console.log('⏳ Sync already in progress, skipping...');
            return { success: true, error: 'In Progress' };
        }

        // Phase 0: Check Online Status
        if (!this.isOnline) {
            console.log('⚠️ Skipping sync: App is Offline');
            return { success: false, error: 'Offline' };
        }

        this.isSyncing = true;
        console.log(`🔄 Starting sync... ${forceFull ? '(Full Sync)' : '(Incremental Sync)'}`);

        this.pendingOps++;
        this.notify();

        try {
            // Phase 1: Push Local Changes (Upstream)
            await this.pushLocalChanges();

            // Phase 2: Pull Remote Changes (Downstream)
            const result = await this.pullRemoteChanges(forceFull);

            return result;
        } catch (error: any) {
            // Handle Permission Denied Gracefully (User Request C)
            if (error.code === 'permission-denied' || error.message?.includes('permission-denied')) {
                console.warn('⛔ Firebase Permission Denied - Switching to Offline Mode effectively.');
                return { success: false, error: 'Permission Denied' };
            }

            console.error('Sync failed:', error);
            return { success: false, error: error.message };
        } finally {
            this.isSyncing = false;
            this.pendingOps = Math.max(0, this.pendingOps - 1);
            this.notify();
        }
    }

    private async pushLocalChanges() {
        console.log('📤 Pushing local changes...');
        const tables = [
            { name: 'records', table: db.records },
            { name: 'fieldTables', table: db.fieldTables, idField: (r: any) => `${r.projectId}_${r.tableId}` },
            { name: 'projectTasks', table: db.projectTasks },
            { name: 'dailyReports', table: db.dailyReports },
            { name: 'tools', table: db.tools }
        ];

        let pushedCount = 0;

        for (const { name, table, idField } of tables) {
            // Find records that are NOT synced (0)
            // Check if 'synced' field exists first (it should based on schema update)
            const unsynced = await table.where('synced').equals(0).toArray();

            if (unsynced.length > 0) {
                console.log(`Found ${unsynced.length} unsynced items in ${name}`);

                const batch = writeBatch(this.db);
                // We need to track which Dexie IDs correspond to which Firebase IDs to update them back
                const updates: { id: number, firebaseId: string }[] = [];

                unsynced.forEach(record => {
                    // Determine ID: use firebaseId if exists, otherwise generate or use specialized ID
                    let finalId = record.firebaseId;
                    if (!finalId) {
                        // Logic for special tables
                        if (idField) {
                            finalId = idField(record);
                        } else {
                            // Generate new ID if needed. 
                            finalId = doc(collection(this.db, name)).id;
                        }
                    }

                    const docRef = doc(this.db, name, String(finalId));

                    // Prepare data: remove local-only fields
                    const { id, synced, firebaseId, ...dataToUpload } = record;

                    // Add standard metadata
                    const payload = {
                        ...dataToUpload,
                        id: finalId, // Ensure ID is in document body too
                        updatedAt: serverTimestamp(),
                        syncedBy: this.auth.currentUser?.uid
                    };

                    batch.set(docRef, payload, { merge: true });
                    updates.push({ id: record.id!, firebaseId: finalId });
                });

                await batch.commit();

                // Mark local as synced
                await db.transaction('rw', table, async () => {
                    for (const update of updates) {
                        await table.update(update.id, {
                            synced: 1,
                            firebaseId: update.firebaseId
                        });
                    }
                });

                pushedCount += unsynced.length;
            }
        }
        console.log(`✅ Pushed ${pushedCount} local records.`);
    }

    private async pullRemoteChanges(forceFull: boolean): Promise<SyncResult> {
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

        // 1. Fetch data
        const syncedData: { [key: string]: any[] } = {};
        let fetchedCount = 0;

        console.log('📥 Pulling data from Firebase...');
        const fetchPromises = Object.entries(collectionsToSync).map(async ([name, table]) => {
            const q = lastSyncDate
                ? query(collection(this.db, name), where("updatedAt", ">", Timestamp.fromDate(lastSyncDate)))
                : collection(this.db, name);

            const snapshot = await getDocs(q);
            if (snapshot.empty) return;

            const records: any[] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                const record: { [key: string]: any } = {
                    ...data,
                    // Map Firebase ID to local field
                    firebaseId: doc.id,
                    synced: 1 // Coming from server, so it is synced
                };

                // Convert Timestamps
                for (const key in record) {
                    if (record[key] instanceof Timestamp) {
                        record[key] = record[key].toDate();
                    }
                }
                records.push(record);
            });
            syncedData[name] = records;
            fetchedCount += records.length;
        });

        await Promise.all(fetchPromises);

        // 2. Write to Dexie safely
        console.log(`Writing ${fetchedCount} records to Dexie...`);
        let totalSynced = 0;

        await db.transaction('rw', Object.values(collectionsToSync), async () => {
            // Full Sync Policy: Only delete SYNCED records. Keep unsynced (offline work).
            if (lastSyncDate === null) {
                console.log('Cleaning up old synced data...');
                for (const table of Object.values(collectionsToSync)) {
                    // Delete where synced == 1. 
                    await table.where('synced').equals(1).delete();
                }
            }

            // Upsert Logic
            for (const [name, records] of Object.entries(syncedData)) {
                if (records.length > 0) {
                    const table = collectionsToSync[name as keyof typeof collectionsToSync];

                    for (const record of records) {
                        // Check if exists by firebaseId
                        const existing = await table.where('firebaseId').equals(record.firebaseId).first();

                        if (existing) {
                            // Update, preserving Dexie ID
                            await table.put({ ...record, id: existing.id });
                        } else {
                            // Insert new (auto-increment Dexie ID)
                            // Remove conflicting 'id' from data if it's a string from firebase
                            // We shouldn't use the firebase ID as the Dexie Key if the Dexie table uses ++id
                            const { id, ...dataWithoutId } = record;
                            await table.add(dataWithoutId as any);
                        }
                    }
                    totalSynced += records.length;
                }
            }
        });

        localStorage.setItem('lastSyncTimestamp', String(newSyncTime.getTime()));
        console.log(`✅ Sync finished. Synced ${totalSynced} records.`);
        return { success: true, syncedRecords: totalSynced };
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

}

export const firebaseService = new FirebaseService();
