import { initializeApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, child, update, remove, Database, onValue, off } from 'firebase/database';

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

export interface SyncResult {
    success: boolean;
    error?: string;
}

class FirebaseService {
    private app: FirebaseApp | null = null;
    private db: Database | null = null;
    private isInitialized = false;

    constructor() {
        this.loadConfig();
    }

    private loadConfig() {
        const storedConfig = localStorage.getItem('firebase_config');
        if (storedConfig) {
            try {
                const config = JSON.parse(storedConfig);
                this.init(config);
            } catch (e) {
                console.error('Failed to load firebase config', e);
            }
        }
    }

    public init(config: FirebaseConfig) {
        try {
            this.app = initializeApp(config);
            this.db = getDatabase(this.app);
            this.isInitialized = true;
            localStorage.setItem('firebase_config', JSON.stringify(config));
            console.log('🔥 Firebase initialized successfully');
            return true;
        } catch (error) {
            console.error('Firebase init failed:', error);
            return false;
        }
    }

    public disconnect() {
        this.app = null;
        this.db = null;
        this.isInitialized = false;
        localStorage.removeItem('firebase_config');
    }

    public get isReady() {
        return this.isInitialized && this.db !== null;
    }

    public getConfig(): FirebaseConfig | null {
        const stored = localStorage.getItem('firebase_config');
        return stored ? JSON.parse(stored) : null;
    }

    // --- Generic Data Operations ---

    // Write (Set/Overwrite) data to a path
    public async setData(path: string, data: any): Promise<SyncResult> {
        if (!this.db) return { success: false, error: 'Firebase not initialized' };
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
        if (!this.db) return { success: false, error: 'Firebase not initialized' };
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
        if (!this.db) return null;
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
        if (!this.db) return { success: false, error: 'Firebase not initialized' };
        try {
            await remove(ref(this.db, path));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    // --- Realtime Listeners ---

    public subscribe(path: string, callback: (data: any) => void) {
        if (!this.db) return;
        const dataRef = ref(this.db, path);
        onValue(dataRef, (snapshot) => {
            const data = snapshot.val();
            callback(data);
        });
    }

    public unsubscribe(path: string) {
        if (!this.db) return;
        const dataRef = ref(this.db, path);
        off(dataRef);
    }

    // --- Specific MST Helpers (Migration from Google Sheets logic) ---

    // Upsert array of records (like workers, tools)
    // Firebase stores lists best as Objects with IDs as keys, OR arrays.
    // We will store as Objects: /workers/{id} = { ...workerData }
    public async upsertRecords(collectionName: string, records: any[]): Promise<SyncResult> {
        if (!this.db || records.length === 0) return { success: true };

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
        if (!this.db || ids.length === 0) return { success: true };

        const updates: any = {};
        ids.forEach(id => {
            updates[`/${collectionName}/${id}`] = null; // Setting to null deletes it
        });

        return this.updateData('/', updates);
    }
}

export const firebaseService = new FirebaseService();
