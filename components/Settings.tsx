
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

        // Google Sheets API initialization
        const storedApiKey = localStorage.getItem('google_sheets_api_key');
        if (storedApiKey) {
            setSheetsApiKey(storedApiKey);
            googleSheetsService.init(storedApiKey).then(() => {
                setIsSheetsConnected(true);
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
            showToast('Please enter a Google Sheets API Key', 'error');
            return;
        }
        try {
            await googleSheetsService.init(sheetsApiKey);
            localStorage.setItem('google_sheets_api_key', sheetsApiKey);
            setIsSheetsConnected(true);
            showToast('Google Sheets API connected!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to connect. Check API key.', 'error');
        }
    };

    const handleDisconnectSheets = () => {
        googleSheetsService.signOut();
        setIsSheetsConnected(false);
        setSheetsApiKey('');
        showToast('Google Sheets disconnected', 'info');
    };

    return (
        <div className="pb-12">
            <h1 className="text-6xl font-black mb-12 text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.5)] italic uppercase tracking-tighter underline decoration-[var(--color-accent)] decoration-8">
                {t('settings')}
            </h1>


            <div className="space-y-8 max-w-5xl">

                {/* Google Sheets API Section - Admin Only */}
                {user?.role === 'admin' && (
                    <section className="p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <ShareIcon className="w-32 h-32" />
                        </div>
                        <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest flex items-center gap-3">
                            Google Sheets API <span className="text-sm font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">Simple</span>
                        </h2>

                        {!isSheetsConnected ? (
                            <div className="space-y-6 max-w-lg">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                                    <p className="text-emerald-200 text-sm font-medium">
                                        Pro synchronizaci s Google Sheets potřebujete <strong>API Key</strong>.
                                        Vytvořte si klíč v <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline text-white">Google Cloud Console</a>,
                                        povolte <strong>Google Sheets API</strong>.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">API Key</label>
                                    <input
                                        type="text"
                                        value={sheetsApiKey}
                                        onChange={e => setSheetsApiKey(e.target.value)}
                                        className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-emerald-500 font-mono text-sm shadow-inner"
                                        placeholder="AIzaSy..."
                                    />
                                </div>
                                <button
                                    onClick={handleConnectSheets}
                                    disabled={!sheetsApiKey}
                                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Connect Google Sheets
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                    <span className="flex items-center gap-2 text-emerald-400 font-bold">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]"></div>
                                        Google Sheets API Connected
                                    </span>
                                    <button onClick={handleDisconnectSheets} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">Disconnect</button>
                                </div>
                                <p className="text-sm text-gray-400">
                                    ✅ Synchronizace je aktivní. Použijte tlačítko "Sync" u projektů pro nahrání dat do Google Sheets.
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {/* Cloud Sync Section - Only visible to Admin */}
                {user?.role === 'admin' && (
                    <section className="p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <ShareIcon className="w-32 h-32" />
                        </div>
                        <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest flex items-center gap-3">
                            {t('cloud_sync')} <span className="text-sm font-bold text-gray-500 bg-black/30 px-2 py-1 rounded">Beta</span>
                        </h2>

                        {!isDriveConnected ? (
                            <div className="space-y-6 max-w-lg">
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                                    <p className="text-blue-200 text-sm font-medium">
                                        Pro aktivaci synchronizace potřebujete <strong>Google Client ID</strong>.
                                        Vytvořte si projekt v <a href="https://console.cloud.google.com/" target="_blank" className="underline text-white">Google Cloud Console</a>,
                                        povolte <strong>Drive API</strong> a vytvořte <strong>OAuth 2.0 Client ID</strong> pro Web Application.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">{t('client_id')}</label>
                                    <input
                                        type="text"
                                        value={clientId}
                                        onChange={e => setClientId(e.target.value)}
                                        className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] font-mono text-sm shadow-inner"
                                        placeholder="YOUR_CLIENT_ID.apps.googleusercontent.com"
                                    />
                                </div>
                                <button
                                    onClick={handleConnectDrive}
                                    disabled={loadingDrive || !clientId}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loadingDrive ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : t('connect_drive')}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                                    <span className="flex items-center gap-2 text-green-400 font-bold">
                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></div>
                                        {t('drive_connected')}
                                    </span>
                                    <button onClick={handleDisconnectDrive} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">{t('disconnect_drive')}</button>
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={handleUploadToCloud}
                                        disabled={loadingDrive}
                                        className="flex-1 px-8 py-4 bg-[var(--color-primary)] text-white font-black rounded-2xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                                    >
                                        {loadingDrive ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : t('sync_upload')}
                                    </button>
                                    <button
                                        onClick={loadCloudBackups}
                                        className="px-6 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all border border-white/10"
                                        title="Obnovit seznam"
                                    >
                                        ↻
                                    </button>
                                </div>

                                <div>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Dostupné zálohy na Disku</h3>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar bg-black/20 p-2 rounded-2xl border border-white/5">
                                        {cloudBackups.length > 0 ? cloudBackups.map(file => (
                                            <div key={file.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group">
                                                <div className="overflow-hidden">
                                                    <p className="font-bold text-white text-sm truncate">{file.name}</p>
                                                    <p className="text-xs text-gray-500">{new Date(file.createdTime).toLocaleString()} • {(Number(file.size) / 1024).toFixed(1)} KB</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRestoreFromCloud(file.id)}
                                                    className="px-4 py-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-bold transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    {t('restore_backup')}
                                                </button>
                                            </div>
                                        )) : (
                                            <p className="text-gray-500 text-sm italic text-center py-4">Žádné zálohy ve složce 'MST_Backups'.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}

                {/* Local Backup Section */}
                {user?.role === 'admin' && (
                    <section className="p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl">
                        <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest">{t('backup_restore')}</h2>
                        <BackupManager />
                    </section>
                )}

                <section className="p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl">
                    <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest">{t('app_theme')}</h2>
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
                </section>

                <section className="p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl">
                    <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest">{t('language')}</h2>
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
                </section>

                {/* Data Management - Admin Only */}
                {user?.role === 'admin' && (
                    <section className="p-8 bg-slate-900/40 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl">
                        <h2 className="text-3xl font-black mb-8 text-white uppercase tracking-widest">{t('data_management')}</h2>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => setIsResetting(true)}
                                className="flex-1 min-w-[200px] px-8 py-4 bg-red-600/20 text-red-400 border-2 border-red-500/50 font-black rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-lg text-lg uppercase tracking-tighter flex items-center justify-center gap-3"
                            >
                                <TrashIcon className="w-6 h-6" />
                                {t('reset_app_title')}
                            </button>
                        </div>
                    </section>
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
