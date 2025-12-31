
import React, { useState, useRef } from 'react';
import { useBackup } from '../contexts/BackupContext';
import { useI18n } from '../contexts/I18nContext';
import UploadIcon from './icons/UploadIcon';
import TrashIcon from './icons/TrashIcon';
import ConfirmationModal from './ConfirmationModal';

// Icons needed for UI
const ClockIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
const DatabaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const RestoreIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>;

const BackupManager: React.FC = () => {
    const { t } = useI18n();
    const {
        backups, createBackup, deleteBackup, restoreBackup, importBackup, exportBackup,
        autoBackupEnabled, setAutoBackupEnabled, backupInterval, setBackupInterval
    } = useBackup();

    const [importMode, setImportMode] = useState<'merge' | 'replace'>('replace');
    const [backupToRestore, setBackupToRestore] = useState<number | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            if (window.confirm(t('restore_confirm_message'))) {
                await importBackup(file, importMode);
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (window.confirm(t('restore_confirm_message'))) {
                await importBackup(file, importMode);
            }
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/40 border border-white/5 p-10 rounded-[2.5rem] shadow-xl space-y-8">
                    <header className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                                <ClockIcon />
                            </div>
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">{t('auto_backup')}</h3>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={autoBackupEnabled} onChange={e => setAutoBackupEnabled(e.target.checked)} />
                            <div className="w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600 shadow-inner"></div>
                        </label>
                    </header>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">{t('backup_interval')}</span>
                            <select
                                value={backupInterval}
                                onChange={e => setBackupInterval(Number(e.target.value))}
                                className="bg-white/5 border border-white/10 rounded-xl text-white text-sm font-bold p-3 outline-none focus:border-indigo-500 transition-colors"
                            >
                                <option value="5">5 {t('minutes')}</option>
                                <option value="15">15 {t('minutes')}</option>
                                <option value="30">30 {t('minutes')}</option>
                                <option value="60">60 {t('minutes')}</option>
                            </select>
                        </div>
                        <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest text-center">
                            Uchováváme posledních 10 verzí
                        </div>
                    </div>
                </div>

                <div className="bg-black/40 border border-white/5 p-10 rounded-[2.5rem] shadow-xl flex flex-col items-center justify-center text-center space-y-2">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-600 mb-4 border border-white/5">
                        <DatabaseIcon />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{t('storage_used')}</p>
                    <h2 className="text-5xl font-black text-white italic tracking-tighter leading-none">
                        {formatBytes(backups.reduce((acc, b) => acc + (b.metadata?.dataSize || 0), 0))}
                    </h2>
                    <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mt-4">
                        {backups.length} {t('backups_count')}
                    </p>
                </div>
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Manual Operations */}
                <div className="space-y-6">
                    <button
                        onClick={() => createBackup('manual')}
                        className="group w-full p-8 bg-white text-black font-black rounded-[2.5rem] transition-all shadow-2xl active:scale-95 flex items-center justify-between overflow-hidden relative"
                    >
                        <span className="text-lg uppercase italic tracking-tighter relative z-10">{t('create_backup')}</span>
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white relative z-10 group-hover:scale-110 transition-transform">
                            <UploadIcon className="w-6 h-6" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </button>

                    <div
                        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`group border-2 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer transition-all flex flex-col items-center gap-4 ${isDragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 hover:border-white/20 hover:bg-white/5 bg-black/20'}`}
                    >
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileSelect} />
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition-colors">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <div className="space-y-1">
                            <p className="text-white font-black italic uppercase tracking-tighter text-xl">{t('upload_backup')}</p>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">{t('drop_backup_here')}</p>
                        </div>
                    </div>

                    <div className="flex justify-center flex-col items-center gap-4">
                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Režim importu</p>
                        <div className="flex p-2 bg-black/40 rounded-2xl border border-white/5 gap-2">
                            {[
                                { id: 'replace', label: 'Nahradit data' },
                                { id: 'merge', label: 'Sloučit data' }
                            ].map(mode => (
                                <button
                                    key={mode.id}
                                    onClick={() => setImportMode(mode.id as any)}
                                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${importMode === mode.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-white'}`}
                                >
                                    {mode.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="bg-[#0a0c1a]/60 backdrop-blur-3xl rounded-[3rem] border border-white/5 overflow-hidden flex flex-col h-[550px] shadow-2xl">
                    <div className="px-8 py-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <h4 className="font-black text-white italic uppercase tracking-tighter text-xl">{t('backup_manager')}</h4>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,1)]" />
                    </div>
                    <div className="overflow-y-auto p-6 space-y-4 flex-1 custom-scrollbar">
                        {backups.map(backup => (
                            <div key={backup.id} className="p-6 bg-white/[0.03] hover:bg-white/[0.07] rounded-3xl transition-all border border-white/5 group relative overflow-hidden">
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${backup.type === 'auto' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                                            <span className="font-black text-white italic uppercase tracking-tighter text-lg">{backup.name || t('backup')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-[10px] font-bold uppercase tracking-tight">{new Date(backup.timestamp).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
                                        {formatBytes(backup.metadata?.dataSize || 0)}
                                    </div>
                                </div>

                                <div className="flex gap-3 mt-6 relative z-10 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                    <button
                                        onClick={() => setBackupToRestore(backup.id!)}
                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all text-[10px] font-black uppercase tracking-widest border border-white/5 flex items-center justify-center gap-2"
                                    >
                                        <RestoreIcon /> {t('restore_backup')}
                                    </button>
                                    <button
                                        onClick={() => exportBackup(backup.id!)}
                                        className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all flex items-center justify-center border border-white/5"
                                        title={t('download_backup')}
                                    >
                                        <DownloadIcon />
                                    </button>
                                    <button
                                        onClick={() => deleteBackup(backup.id!)}
                                        className="w-12 h-12 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-all flex items-center justify-center border border-rose-500/20"
                                        title={t('delete')}
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {backups.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20">
                                <DatabaseIcon />
                                <p className="text-sm font-black uppercase italic tracking-widest mt-4">{t('no_data')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {backupToRestore && (
                <ConfirmationModal
                    title={t('restore_confirm_title')}
                    message={t('restore_confirm_message')}
                    confirmLabel="OBNOVIT DATA"
                    onConfirm={() => { restoreBackup(backupToRestore, 'replace'); setBackupToRestore(null); }}
                    onCancel={() => setBackupToRestore(null)}
                    variant="warning"
                />
            )}
        </div>
    );
};

export default BackupManager;
