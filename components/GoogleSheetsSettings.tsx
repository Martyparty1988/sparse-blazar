/**
 * 📊 Google Sheets Settings Component
 * Konfigurace synchronizace s Google Sheets přes Apps Script
 */

import React, { useState, useEffect } from 'react';
import { googleSheetsService, SyncConfig } from '../services/googleSheetsService';
import './GoogleSheetsSettings.css';

interface GoogleSheetSettingsProps {
    onConfigChange?: (config: SyncConfig) => void;
}

export const GoogleSheetsSettings: React.FC<GoogleSheetSettingsProps> = ({ onConfigChange }) => {
    const [deploymentUrl, setDeploymentUrl] = useState('');
    const [autoSync, setAutoSync] = useState(false);
    const [syncInterval, setSyncInterval] = useState(30);
    const [isConnected, setIsConnected] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    useEffect(() => {
        // Load current config
        const config = googleSheetsService.getConfig();
        setDeploymentUrl(config.deploymentUrl || '');
        setAutoSync(config.autoSync || false);
        setSyncInterval(config.syncInterval || 30);
        setIsConnected(googleSheetsService.isReady);

        // Listen to sync events
        googleSheetsService.onSync(() => {
            setLastSyncTime(new Date());
        });

        googleSheetsService.onError((error) => {
            console.error('Sync error:', error);
            setTestResult({
                success: false,
                message: error.message
            });
        });
    }, []);

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        try {
            // Temporarily set the URL for testing
            await googleSheetsService.init({ deploymentUrl, autoSync: false });

            const result = await googleSheetsService.testConnection();

            if (result.success) {
                setTestResult({
                    success: true,
                    message: '✅ Připojení úspěšné!'
                });
                setIsConnected(true);
            } else {
                setTestResult({
                    success: false,
                    message: `❌ Chyba: ${result.error}`
                });
                setIsConnected(false);
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: `❌ Chyba: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            setIsConnected(false);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveConfig = async () => {
        try {
            const config: SyncConfig = {
                deploymentUrl,
                autoSync,
                syncInterval
            };

            await googleSheetsService.init(config);
            setIsConnected(true);

            setTestResult({
                success: true,
                message: '✅ Konfigurace uložena!'
            });

            if (onConfigChange) {
                onConfigChange(config);
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: `❌ Chyba při ukládání: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    };

    const handleDisconnect = () => {
        googleSheetsService.disconnect();
        setIsConnected(false);
        setDeploymentUrl('');
        setAutoSync(false);
        setTestResult(null);
    };

    const handlePullData = async () => {
        try {
            setTestResult({ success: true, message: '⏳ Stahuji data...' });
            await googleSheetsService.pullAllData();
            setLastSyncTime(new Date());
            setTestResult({
                success: true,
                message: '✅ Data stažena!'
            });
        } catch (error) {
            setTestResult({
                success: false,
                message: `❌ Chyba: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    };

    const handlePushData = async () => {
        try {
            setTestResult({ success: true, message: '⏳ Nahrávám data...' });

            // Get data from your store/database
            const data = {
                workers: [], // TODO: Get from your store
                projects: [],
                fieldTables: [],
                timeRecords: [],
                dailyLogs: []
            };

            const result = await googleSheetsService.pushAllData(data);

            if (result.success) {
                setTestResult({
                    success: true,
                    message: `✅ Data nahrána! Updated: ${result.updated || 0}, Inserted: ${result.inserted || 0}`
                });
            } else {
                setTestResult({
                    success: false,
                    message: `❌ ${result.error}`
                });
            }
        } catch (error) {
            setTestResult({
                success: false,
                message: `❌ Chyba: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    };

    return (
        <div className="google-sheets-settings">
            <div className="settings-header">
                <h2>📊 Google Sheets Synchronizace</h2>
                {isConnected && (
                    <span className="status-badge connected">
                        ✅ Připojeno
                    </span>
                )}
            </div>

            <div className="settings-section">
                <h3>🔗 Nastavení Připojení</h3>

                <div className="form-group">
                    <label htmlFor="deployment-url">
                        Apps Script Deployment URL
                        <span className="help-text">
                            Zkopírujte URL z Google Apps Script deployment
                        </span>
                    </label>
                    <input
                        id="deployment-url"
                        type="url"
                        value={deploymentUrl}
                        onChange={(e) => setDeploymentUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/..."
                        disabled={isConnected}
                    />
                </div>

                {!isConnected && (
                    <div className="button-group">
                        <button
                            onClick={handleTestConnection}
                            disabled={!deploymentUrl || isTesting}
                            className="btn-primary"
                        >
                            {isTesting ? '⏳ Testuji...' : '🔍 Test Connection'}
                        </button>
                        <button
                            onClick={handleSaveConfig}
                            disabled={!deploymentUrl}
                            className="btn-success"
                        >
                            💾 Uložit a Připojit
                        </button>
                    </div>
                )}

                {isConnected && (
                    <button
                        onClick={handleDisconnect}
                        className="btn-danger"
                    >
                        🔌 Odpojit
                    </button>
                )}
            </div>

            {isConnected && (
                <>
                    <div className="settings-section">
                        <h3>⚙️ Nastavení Synchronizace</h3>

                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={autoSync}
                                    onChange={(e) => {
                                        const enabled = e.target.checked;
                                        setAutoSync(enabled);

                                        if (enabled) {
                                            googleSheetsService.startAutoSync();
                                        } else {
                                            googleSheetsService.stopAutoSync();
                                        }
                                    }}
                                />
                                Automatická synchronizace
                            </label>
                        </div>

                        {autoSync && (
                            <div className="form-group">
                                <label htmlFor="sync-interval">
                                    Interval (sekundy)
                                </label>
                                <input
                                    id="sync-interval"
                                    type="number"
                                    min="10"
                                    max="300"
                                    value={syncInterval}
                                    onChange={(e) => {
                                        const interval = parseInt(e.target.value);
                                        setSyncInterval(interval);
                                        googleSheetsService.init({
                                            deploymentUrl,
                                            autoSync: true,
                                            syncInterval: interval
                                        });
                                    }}
                                />
                            </div>
                        )}

                        {lastSyncTime && (
                            <div className="sync-status">
                                <span className="sync-time">
                                    Poslední synchronizace: {lastSyncTime.toLocaleTimeString('cs-CZ')}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="settings-section">
                        <h3>🔄 Manuální Synchronizace</h3>

                        <div className="button-group">
                            <button onClick={handlePullData} className="btn-primary">
                                ⬇️ Stáhnout z Sheets
                            </button>
                            <button onClick={handlePushData} className="btn-primary">
                                ⬆️ Nahrát do Sheets
                            </button>
                        </div>
                    </div>
                </>
            )}

            {testResult && (
                <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                    {testResult.message}
                </div>
            )}

            <div className="settings-section help-section">
                <h3>❓ Potřebujete pomoc?</h3>
                <p>
                    <a href="#" onClick={() => window.open('GOOGLE_SHEETS_SETUP.md', '_blank')}>
                        📖 Přečtěte si kompletního průvodce
                    </a>
                </p>
                <p className="help-steps">
                    <strong>Rychlý návod:</strong><br />
                    1. Vytvořte Google Sheets s listy: Workers, Projects, FieldTables, TimeRecords, DailyLogs<br />
                    2. Extensions → Apps Script<br />
                    3. Zkopírujte kód z <code>google-apps-script.js</code><br />
                    4. Deploy → New deployment → Web app<br />
                    5. Zkopírujte Deployment URL sem
                </p>
            </div>
        </div>
    );
};
