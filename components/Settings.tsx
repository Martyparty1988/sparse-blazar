
import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useDarkMode } from '../hooks/useDarkMode';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useBackup } from '../contexts/BackupContext';
import { useToast } from '../contexts/ToastContext';
import { db } from '../services/db';
import { googleDriveService } from '../services/googleDriveService';
import TrashIcon from './icons/TrashIcon';
import ConfirmationModal from './ConfirmationModal';
import BackupManager from './BackupManager';
import ShareIcon from './icons/ShareIcon';
import BackButton from './BackButton';
import { FirebaseSettings } from './FirebaseSettings';

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
            <div className="md:hidden">
                <BackButton />
            </div>
            <h1 className="text-6xl font-black mb-12 text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.5)] italic uppercase tracking-tighter underline decoration-[var(--color-accent)] decoration-8">
                {t('settings')}
            </h1>


            <div className="space-y-8 max-w-5xl">

                {/* Firebase Section - Admin Only */}
                {user?.role === 'admin' && (
                    <SettingsSection title="Cloud Database" defaultOpen={true}>
                        <FirebaseSettings />
                    </SettingsSection>
                )}

                {/* Local Backup Section */}
                {user?.role === 'admin' && (
                    <SettingsSection title={t('backup_restore')}>
                        <BackupManager />
                    </SettingsSection>
                )}

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
