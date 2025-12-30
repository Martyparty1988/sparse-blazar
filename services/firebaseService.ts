import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, child, update, remove, Database, onValue, off } from 'firebase/database';

// Hardcoded configuration for MST App
const firebaseConfig = {
    apiKey: "AIzaSyD5RkJAXUvuBAbuug9C1cU0PGNUMjbaGc8",
    authDomain: "mst-ap.firebaseapp.com",
    databaseURL: "https://mst-ap-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mst-ap",
    storageBucket: "mst-ap.firebasestorage.app",
    messagingSenderId: "708181032604",
    appId: "1:708181032604:web:4613ca54f8fd5c2805f759",
    measurementId: "G-2W5047GKL9"
};

export interface SyncResult {
    success: boolean;
    error?: string;
}

class FirebaseService {
    private app: FirebaseApp;
    private db: Database;
    public isInitialized = false;

    constructor() {
        try {
            this.app = initializeApp(firebaseConfig);
            this.db = getDatabase(this.app);
            this.isInitialized = true;
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

        return this.updateData('/', updates);
    }

    public async deleteRecords(collectionName: string, ids: string[]): Promise<SyncResult> {
        if (!this.isReady || ids.length === 0) return { success: true };

        const updates: any = {};
        ids.forEach(id => {
            updates[`/${collectionName}/${id}`] = null; // Setting to null deletes it
        });

        return this.updateData('/', updates);
    }
}

export const firebaseService = new FirebaseService();
