/**
 * 🚀 Google Sheets Sync Service
 * Používá Google Apps Script jako backend API
 *
 * Jednoduché, bezplatné a funkční řešení bez OAuth!
 */
class GoogleSheetsSyncService {
    constructor() {
        this.deploymentUrl = null;
        this.isInitialized = false;
        this.isConnected = false;
        this.autoSyncEnabled = false;
        this.syncIntervalId = null;
        this.syncInterval = 30000; // 30 sekund default
        // Event listeners
        this.onSyncCallbacks = [];
        this.onErrorCallbacks = [];
        this.loadConfig();
    }
    /**
     * Načte konfiguraci z localStorage
     */
    loadConfig() {
        const url = localStorage.getItem('google_sheets_deployment_url');
        const autoSync = localStorage.getItem('google_sheets_auto_sync') === 'true';
        const interval = parseInt(localStorage.getItem('google_sheets_sync_interval') || '30000');
        if (url) {
            this.deploymentUrl = url;
            this.isInitialized = true;
            this.isConnected = true;
        }
        this.autoSyncEnabled = autoSync;
        this.syncInterval = interval;
    }
    /**
     * Inicializace služby s deployment URL
     */
    async init(config) {
        if (config.deploymentUrl) {
            this.deploymentUrl = config.deploymentUrl;
            localStorage.setItem('google_sheets_deployment_url', config.deploymentUrl);
        }
        if (config.autoSync !== undefined) {
            this.autoSyncEnabled = config.autoSync;
            localStorage.setItem('google_sheets_auto_sync', config.autoSync.toString());
        }
        if (config.syncInterval) {
            this.syncInterval = config.syncInterval * 1000; // převod na ms
            localStorage.setItem('google_sheets_sync_interval', this.syncInterval.toString());
        }
        // Test připojení
        const testResult = await this.testConnection();
        if (testResult.success) {
            this.isInitialized = true;
            this.isConnected = true;
            // Spusť auto-sync pokud je enabled
            if (this.autoSyncEnabled) {
                this.startAutoSync();
            }
        }
        else {
            throw new Error(testResult.error || 'Failed to connect to Google Sheets');
        }
    }
    /**
     * Test připojení k Apps Script endpoint
     */
    async testConnection() {
        if (!this.deploymentUrl) {
            return {
                success: false,
                error: 'Deployment URL is not set'
            };
        }
        try {
            const response = await fetch(this.deploymentUrl, {
                method: 'GET',
                mode: 'cors'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                success: data.success || true,
                timestamp: data.timestamp
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Získá všechna data z Google Sheets
     */
    async pullAllData() {
        if (!this.deploymentUrl) {
            throw new Error('Not initialized - missing deployment URL');
        }
        try {
            const response = await fetch(this.deploymentUrl, {
                method: 'GET',
                mode: 'cors'
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to pull data');
            }
            // Parsuj data - některé hodnoty můžou být stringified JSON
            const data = this.parseData(result.data);
            // Trigger callbacks
            this.onSyncCallbacks.forEach(cb => cb(data));
            return data;
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            this.onErrorCallbacks.forEach(cb => cb(err));
            throw error;
        }
    }
    /**
     * Nahraje data do Google Sheets (full sync)
     */
    async pushAllData(data) {
        if (!this.deploymentUrl) {
            throw new Error('Not initialized - missing deployment URL');
        }
        try {
            const response = await fetch(this.deploymentUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'sync',
                    data: this.serializeData(data)
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to push data');
            }
            return {
                success: true,
                timestamp: result.timestamp,
                ...result.result
            };
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            this.onErrorCallbacks.forEach(cb => cb(err));
            return {
                success: false,
                error: err.message
            };
        }
    }
    /**
     * Upsert dat do konkrétního sheetu
     */
    async upsertData(sheet, records) {
        if (!this.deploymentUrl) {
            throw new Error('Not initialized - missing deployment URL');
        }
        try {
            const response = await fetch(this.deploymentUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'upsert',
                    sheet: sheet,
                    data: this.serializeRecords(records)
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to upsert data');
            }
            return {
                success: true,
                ...result.result
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Smaže záznamy z konkrétního sheetu
     */
    async deleteData(sheet, ids) {
        if (!this.deploymentUrl) {
            throw new Error('Not initialized - missing deployment URL');
        }
        try {
            const response = await fetch(this.deploymentUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'delete',
                    sheet: sheet,
                    ids: ids
                })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to delete data');
            }
            return {
                success: true,
                ...result.result
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Spustí automatickou synchronizaci
     */
    startAutoSync() {
        if (this.syncIntervalId) {
            this.stopAutoSync();
        }
        this.autoSyncEnabled = true;
        localStorage.setItem('google_sheets_auto_sync', 'true');
        this.syncIntervalId = window.setInterval(() => {
            this.pullAllData().catch(err => {
                console.error('Auto-sync failed:', err);
            });
        }, this.syncInterval);
        console.log(`✅ Auto-sync started (interval: ${this.syncInterval / 1000}s)`);
    }
    /**
     * Zastaví automatickou synchronizaci
     */
    stopAutoSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
        this.autoSyncEnabled = false;
        localStorage.setItem('google_sheets_auto_sync', 'false');
        console.log('⏸️ Auto-sync stopped');
    }
    /**
     * Odpojení od služby
     */
    disconnect() {
        this.stopAutoSync();
        this.deploymentUrl = null;
        this.isConnected = false;
        this.isInitialized = false;
        localStorage.removeItem('google_sheets_deployment_url');
        localStorage.removeItem('google_sheets_auto_sync');
    }
    /**
     * Event listener pro sync události
     */
    onSync(callback) {
        this.onSyncCallbacks.push(callback);
    }
    /**
     * Event listener pro chyby
     */
    onError(callback) {
        this.onErrorCallbacks.push(callback);
    }
    /**
     * Parsuje data ze Sheets (deserializace)
     */
    parseData(data) {
        const parse = (records) => {
            return records.map(record => {
                const parsed = {};
                Object.keys(record).forEach(key => {
                    const value = record[key];
                    // Pokus o parse JSON
                    if (typeof value === 'string') {
                        if (value.startsWith('{') || value.startsWith('[')) {
                            try {
                                parsed[key] = JSON.parse(value);
                                return;
                            }
                            catch (e) {
                                // Not JSON, keep as string
                            }
                        }
                        // Pokus o parse Date
                        if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
                            parsed[key] = new Date(value);
                            return;
                        }
                        // Pokus o parse Number
                        if (!isNaN(Number(value)) && value !== '') {
                            parsed[key] = Number(value);
                            return;
                        }
                    }
                    parsed[key] = value;
                });
                return parsed;
            });
        };
        return {
            workers: data.workers ? parse(data.workers) : [],
            projects: data.projects ? parse(data.projects) : [],
            fieldTables: data.fieldTables ? parse(data.fieldTables) : [],
            timeRecords: data.timeRecords ? parse(data.timeRecords) : [],
            dailyLogs: data.dailyLogs ? parse(data.dailyLogs) : [],
        };
    }
    /**
     * Serializuje data pro Google Sheets
     */
    serializeData(data) {
        return {
            workers: data.workers ? this.serializeRecords(data.workers) : [],
            projects: data.projects ? this.serializeRecords(data.projects) : [],
            fieldTables: data.fieldTables ? this.serializeRecords(data.fieldTables) : [],
            timeRecords: data.timeRecords ? this.serializeRecords(data.timeRecords) : [],
            dailyLogs: data.dailyLogs ? this.serializeRecords(data.dailyLogs) : [],
        };
    }
    /**
     * Serializuje jednotlivé záznamy
     */
    serializeRecords(records) {
        return records.map(record => {
            const serialized = {};
            Object.keys(record).forEach(key => {
                const value = record[key];
                if (value instanceof Date) {
                    serialized[key] = value.toISOString();
                }
                else if (typeof value === 'object' && value !== null) {
                    serialized[key] = JSON.stringify(value);
                }
                else {
                    serialized[key] = value;
                }
            });
            return serialized;
        });
    }
    /**
     * Získá současnou konfiguraci
     */
    getConfig() {
        return {
            deploymentUrl: this.deploymentUrl || undefined,
            autoSync: this.autoSyncEnabled,
            syncInterval: this.syncInterval / 1000
        };
    }
    /**
     * Je služba připravena?
     */
    get isReady() {
        return this.isInitialized && this.isConnected && !!this.deploymentUrl;
    }
}
// Export singleton instance
export const googleSheetsService = new GoogleSheetsSyncService();
