
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { useTheme, themesData } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useBackup } from '../contexts/BackupContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/db';
import { googleDriveService } from '../services/googleDriveService';
import { googleSheetsService } from '../services/googleSheetsService';
import TrashIcon from './icons/TrashIcon';
import ConfirmationModal from './ConfirmationModal';
import BackupManager from './BackupManager';
import ShareIcon from './icons/ShareIcon';

const Settings: React.FC = () => {
    const { t, language, setLanguage } = useI18n();
    const [colorTheme, toggleTheme] = useDarkMode();
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();
    const { createBackup, importBackup } = useBackup();
    const { showToast } = useToast();
    const [isResetting, setIsResetting] = useState(false);

    // Cloud Sync State (Google Drive)
    const [clientId, setClientId] = useState('');
    const [isDriveConnected, setIsDriveConnected] = useState(false);
    const [cloudBackups, setCloudBackups] = useState<any[]>([]);
    const [loadingDrive, setLoadingDrive] = useState(false);

    // Google Sheets API State
    const [sheetsApiKey, setSheetsApiKey] = useState('');
    const [isSheetsConnected, setIsSheetsConnected] = useState(false);

    useEffect(() => {
        // Google Drive initialization
        const storedId = localStorage.getItem('google_drive_client_id');
        if (storedId) setClientId(storedId);
        // Attempt silent auth if client ID exists
        if (storedId) {
            googleDriveService.setClientId(storedId);
            googleDriveService.init().then(() => {
                if (googleDriveService.isLoggedIn) {
                    setIsDriveConnected(true);
                    loadCloudBackups();
                }
            }).catch(console.error);
        }

        // Google Sheets initialization (Apps Script)
        const storedDeploymentUrl = localStorage.getItem('google_sheets_deployment_url');
        if (storedDeploymentUrl) {
            setSheetsApiKey(storedDeploymentUrl);
            googleSheetsService.init({
                deploymentUrl: storedDeploymentUrl,
                autoSync: localStorage.getItem('google_sheets_auto_sync') === 'true'
            }).then(() => {
                setIsSheetsConnected(googleSheetsService.isReady);
            }).catch(console.error);
        }
    }, []);

    const handleClearAll = async () => {
        await db.transaction('rw', db.tables, async () => {
            for (const table of db.tables) await table.clear();
        });
        window.location.reload();
    };

    const handleConnectDrive = async () => {
        if (!clientId) {
            showToast('Please enter a Client ID', 'error');
            return;
        }
        setLoadingDrive(true);
        try {
            googleDriveService.setClientId(clientId);
            await googleDriveService.init();
            await googleDriveService.signIn();
            setIsDriveConnected(true);
            showToast(t('drive_connected'), 'success');
            loadCloudBackups();
        } catch (error) {
            console.error(error);
            showToast('Failed to connect to Drive. Check console.', 'error');
        } finally {
            setLoadingDrive(false);
        }
    };

    const handleDisconnectDrive = async () => {
        await googleDriveService.signOut();
        setIsDriveConnected(false);
        setCloudBackups([]);
        showToast('Odpojeno', 'info');
    };

    const loadCloudBackups = async () => {
        try {
            const files = await googleDriveService.listBackups();
            setCloudBackups(files || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleUploadToCloud = async () => {
        setLoadingDrive(true);
        try {
            const backupId = await createBackup('manual');
            const backup = await db.backups.get(backupId);
            if (backup) {
                const fileName = `mst_backup_${new Date().toISOString().split('T')[0]}.json`;
                await googleDriveService.uploadFile(fileName, JSON.stringify(backup));
                showToast('Backup uploaded to Drive', 'success');
                loadCloudBackups();
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to upload', 'error');
        } finally {
            setLoadingDrive(false);
        }
    };

    const handleRestoreFromCloud = async (fileId: string) => {
        if (!window.confirm(t('restore_confirm_message'))) return;
        setLoadingDrive(true);
        try {
            const content = await googleDriveService.downloadFile(fileId);
            const file = new File([content], "cloud_backup.json", { type: "application/json" });
            await importBackup(file, 'replace');
            showToast(t('backup_restored'), 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to restore', 'error');
        } finally {
            setLoadingDrive(false);
        }
    };

    const handleConnectSheets = async () => {
        if (!sheetsApiKey) {
            showToast('Please enter Google Apps Script Deployment URL', 'error');
            return;
        }
        try {
            await googleSheetsService.init({
                deploymentUrl: sheetsApiKey,
                autoSync: false
            });
            localStorage.setItem('google_sheets_deployment_url', sheetsApiKey);
            setIsSheetsConnected(true);
            showToast('Google Sheets connected!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to connect. Check deployment URL.', 'error');
        }
    };

    const handleDisconnectSheets = () => {
        googleSheetsService.disconnect();
        setIsSheetsConnected(false);
        setSheetsApiKey('');
        showToast('Google Sheets disconnected', 'info');
    };

    const handleSyncToSheets = async () => {
        try {
            showToast('⏳ Uploading to Google Sheets...', 'info');

            // Get all data from database
            const [workers, projects, fieldTables, timeRecords, dailyLogs, tools, projectTasks] = await Promise.all([
                db.workers.toArray(),
                db.projects.toArray(),
                db.fieldTables.toArray(),
                db.timeRecords.toArray(),
                db.dailyLogs.toArray(),
                db.tools.toArray(),
                db.projectTasks.toArray()
            ]);

            const result = await googleSheetsService.pushAllData({
                workers,
                projects,
                fieldTables,
                timeRecords,
                dailyLogs,
                tools,
                projectTasks
            });

            if (result.success) {
                showToast(`✅ Synced! Updated: ${result.updated || 0}, Inserted: ${result.inserted || 0}`, 'success');
            } else {
                showToast(`❌ Sync failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to sync!', 'error');
        }
    };

    const handlePullFromSheets = async () => {
        if (!window.confirm('Pull data from Google Sheets? This will merge with local data.')) return;

        try {
            showToast('⏳ Downloading from Google Sheets...', 'info');
            const data = await googleSheetsService.pullAllData();

            // Merge data into database
            let totalUpdated = 0;

            if (data.workers && data.workers.length > 0) {
                await db.workers.bulkPut(data.workers);
                totalUpdated += data.workers.length;
            }

            if (data.projects && data.projects.length > 0) {
                await db.projects.bulkPut(data.projects);
                totalUpdated += data.projects.length;
            }

            if (data.fieldTables && data.fieldTables.length > 0) {
                await db.fieldTables.bulkPut(data.fieldTables);
                totalUpdated += data.fieldTables.length;
            }

            if (data.timeRecords && data.timeRecords.length > 0) {
                await db.timeRecords.bulkPut(data.timeRecords);
                totalUpdated += data.timeRecords.length;
            }

            if (data.dailyLogs && data.dailyLogs.length > 0) {
                await db.dailyLogs.bulkPut(data.dailyLogs);
                totalUpdated += data.dailyLogs.length;
            }

            if (data.tools && data.tools.length > 0) {
                await db.tools.bulkPut(data.tools);
                totalUpdated += data.tools.length;
            }

            if (data.projectTasks && data.projectTasks.length > 0) {
                await db.projectTasks.bulkPut(data.projectTasks);
                totalUpdated += data.projectTasks.length;
            }

            showToast(`✅ Downloaded ${totalUpdated} records!`, 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to pull data!', 'error');
        }
    };

    const SettingsSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => (
        <details className="group p-6 md:p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden" open={defaultOpen}>
            <summary className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest cursor-pointer list-none flex items-center justify-between outline-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">{title}</span>
                <svg className="w-8 h-8 transform group-open:rotate-180 transition-transform duration-300 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
            </summary>
            <div className="mt-8 animate-fade-in">
                {children}
            </div>
        </details>
    );

    return (
        <div className="pb-12">
            <h1 className="text-6xl font-black mb-12 text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.5)] italic uppercase tracking-tighter underline decoration-[var(--color-accent)] decoration-8">
                {t('settings')}
            </h1>


            <div className="space-y-8 max-w-5xl">

                {/* Google Sheets API Section - Admin Only */}
                {user?.role === 'admin' && (
                    <SettingsSection title="Google Sheets" defaultOpen={true}>
                        {!isSheetsConnected ? (
                            <div className="space-y-6 max-w-lg">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                                    <p className="text-emerald-200 text-sm font-medium">
                                        🚀 Pro synchronizaci s Google Sheets potřebujete <strong>Google Apps Script Deployment URL</strong>.
                                        <br /><br />
                                        📖 <a href="GOOGLE_SHEETS_SETUP.md" target="_blank" className="underline text-white font-bold">Přečtěte si kompletního průvodce</a>
                                        <br /><br />
                                        Zkrácený postup:
                                        <ol className="list-decimal ml-4 mt-2 space-y-1">
                                            <li>Vytvořte Google Sheets</li>
                                            <li>Extensions → Apps Script</li>
                                            <li>Zkopírujte kód z <code className="bg-black/40 px-1 rounded">google-apps-script.js</code></li>
                                            <li>Deploy → Web app → Zkopírujte URL</li>
                                        </ol>
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">Deployment URL</label>
                                    <input
                                        type="text"
                                        value={sheetsApiKey}
                                        onChange={e => setSheetsApiKey(e.target.value)}
                                        className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-mono text-sm shadow-inner"
                                        placeholder="https://script.google.com/macros/s/..."
                                    />
                                </div>
                                <button
                                    onClick={handleConnectSheets}
                                    disabled={!sheetsApiKey}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    🔗 Connect Google Sheets
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                    <span className="flex items-center gap-2 text-emerald-400 font-bold">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                                        ✅ Google Sheets Connected
                                    </span>
                                    <button onClick={handleDisconnectSheets} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">Disconnect</button>
                                </div>

                                <div className="flex flex-col md:flex-row gap-4">
                                    <button
                                        onClick={handleSyncToSheets}
                                        className="flex-1 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                                    >
                                        ⬆️ Push to Sheets
                                    </button>
                                    <button
                                        onClick={handlePullFromSheets}
                                        className="flex-1 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
                                    >
                                        ⬇️ Pull from Sheets
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-white">Auto Synchronizace</h4>
                                        <p className="text-xs text-gray-400">Automaticky stahovat data každých 30 sekund</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={googleSheetsService.getConfig().autoSync}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    googleSheetsService.startAutoSync();
                                                } else {
                                                    googleSheetsService.stopAutoSync();
                                                }
                                                // Force re-render
                                                setSheetsApiKey(prev => prev + ' ');
                                                setTimeout(() => setSheetsApiKey(prev => prev.trim()), 0);
                                                showToast(e.target.checked ? 'Auto-sync zapnut' : 'Auto-sync vypnut', 'info');
                                            }}
                                        />
                                        <div className="w-14 h-8 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </label>
                                </div>

                                <p className="text-sm text-gray-400 text-center">
                                    💡 Můžete také editovat data přímo v Google Sheets!
                                </p>
                            </div>
                        )}
                    </SettingsSection>
                )}



                {/* Local Backup Section */}
                {user?.role === 'admin' && (
                    <SettingsSection title={t('backup_restore')}>
                        <BackupManager />
                    </SettingsSection>
                )}

                <SettingsSection title={t('app_theme')}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {themesData.map(themeOption => (
                            <button
                                key={themeOption.id}
                                onClick={() => setTheme(themeOption.id)}
                                className={`p-1 rounded-2xl transition-all border-4 ${theme === themeOption.id ? 'border-[var(--color-accent)] scale-105 shadow-xl' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-102'}`}
                            >
                                <div className="h-20 rounded-xl flex overflow-hidden shadow-inner">
                                    <div style={{ backgroundColor: themeOption.colors[0] }} className="w-1/2 h-full"></div>
                                    <div style={{ backgroundColor: themeOption.colors[1] }} className="w-1/2 h-full"></div>
                                </div>
                                <span className="block mt-2 font-bold text-sm text-white truncate">{t(themeOption.nameKey)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-10 pt-8 border-t border-white/10 flex items-center justify-between bg-white/5 p-6 rounded-2xl">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">{t('theme')}</h3>
                            <p className="text-gray-400 text-sm">{colorTheme === 'light' ? t('dark_mode_active') : t('light_mode_active')}</p>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="px-8 py-3 bg-white/10 text-white font-black rounded-xl hover:bg-white/20 transition-all border border-white/20 uppercase tracking-tighter"
                        >
                            {colorTheme === 'light' ? t('switch_to_dark') : t('switch_to_light')}
                        </button>
                    </div>
                </SettingsSection>

                <SettingsSection title={t('language')}>
                    <div className="grid grid-cols-2 gap-4">
                        {(['cs', 'en'] as const).map(lang => (
                            <button
                                key={lang}
                                onClick={() => setLanguage(lang)}
                                className={`p-6 rounded-2xl font-black text-2xl transition-all border-4 ${language === lang ? 'bg-indigo-600 border-white text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                            >
                                {lang.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </SettingsSection>

                {/* Data Management - Admin Only */}
                {user?.role === 'admin' && (
                    <SettingsSection title={t('data_management')}>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => setIsResetting(true)}
                                className="flex-1 min-w-[200px] px-8 py-4 bg-red-600/20 text-red-400 border-2 border-red-500/50 font-black rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-lg text-lg uppercase tracking-tighter flex items-center justify-center gap-3"
                            >
                                <TrashIcon className="w-6 h-6" />
                                {t('reset_app_title')}
                            </button>
                        </div>
                    </SettingsSection>
                )}
            </div>

            {isResetting && (
                <ConfirmationModal
                    title={t('reset_app_title')}
                    message={t('reset_app_confirm')}
                    confirmLabel="RESET"
                    onConfirm={handleClearAll}
                    onCancel={() => setIsResetting(false)}
                    variant="danger"
                />
            )}
        </div>
    );
};

export default Settings;
