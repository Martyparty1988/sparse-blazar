import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { FieldTable, Worker } from '../types';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import type { ProjectTask } from '../types';
import { soundService } from '../services/soundService';
import { hapticService } from '../services/hapticService';

interface TableModalProps {
    table: FieldTable;
    onClose: () => void;
    onUpdate?: () => void;
}

const TableModal: React.FC<TableModalProps> = ({ table, onClose, onUpdate }) => {
    const { t } = useI18n();
    const { currentUser } = useAuth();
    const [selectedWorkers, setSelectedWorkers] = useState<number[]>(table.assignedWorkers || []);
    const [defectNotes, setDefectNotes] = useState(table.defectNotes || '');
    const [photos, setPhotos] = useState<string[]>(table.photos || []);
    const [isUploading, setIsUploading] = useState(false);

    // Swipe Logic State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchCurrent, setTouchCurrent] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Close Logic with simplified check
    const handleClose = () => {
        onClose();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        // Only allow drag if scrolled to top
        const target = e.currentTarget;
        if (target.scrollTop > 0) return;

        setTouchStart(e.touches[0].clientY);
        setTouchCurrent(e.touches[0].clientY);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStart === null) return;
        const currentY = e.touches[0].clientY;
        setTouchCurrent(currentY);

        if (currentY - touchStart > 10) {
            setIsDragging(true);
        }
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchCurrent) return;
        const diff = touchCurrent - touchStart;

        if (diff > 150) { // Threshold to close
            handleClose();
        }

        setTouchStart(null);
        setTouchCurrent(null);
        setIsDragging(false);
    };

    const workers = useLiveQuery(() => db.workers.toArray());
    const project = useLiveQuery(() => db.projects.get(table.projectId));
    const tableTasks = useLiveQuery(() =>
        db.projectTasks
            .where('projectId').equals(table.projectId)
            .filter(t => t.tableIds?.includes(table.tableId))
            .toArray()
        , [table.projectId, table.tableId]);

    const [showQuickTask, setShowQuickTask] = useState(false);
    const [quickTaskType, setQuickTaskType] = useState<'construction' | 'panels' | 'cables'>('construction');
    const [quickTaskPrice, setQuickTaskPrice] = useState('10'); // Default price for quick task

    const completedWorker = table.completedBy
        ? workers?.find(w => w.id === table.completedBy)
        : null;

    const handleToggleWorker = (workerId: number) => {
        hapticService.light();
        setSelectedWorkers(prev => {
            if (prev.includes(workerId)) {
                return prev.filter(id => id !== workerId);
            } else if (prev.length < 2) {
                return [...prev, workerId];
            } else {
                return [prev[1], workerId];
            }
        });
    };

    const handleMarkAsCompleted = async () => {
        if (!currentUser?.workerId) {
            alert(t('login') || 'Musíte být přihlášeni');
            return;
        }

        try {
            soundService.playSuccess();
            hapticService.success();
            await db.fieldTables.update(table.id!, {
                status: 'completed',
                completedAt: new Date(),
                completedBy: currentUser.workerId,
                synced: 0
            });

            if (firebaseService.isReady) {
                firebaseService.synchronize().catch(console.error);
            }

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to mark table as completed:', error);
            alert('Nepodařilo se aktualizovat stůl'); // Fallback string to avoid type error
        }
    };

    const handleMarkAsPending = async () => {
        try {
            soundService.playClick();
            hapticService.medium();
            await db.fieldTables.update(table.id!, {
                status: 'pending',
                completedAt: undefined,
                completedBy: undefined,
                synced: 0
            });

            if (firebaseService.isReady) {
                firebaseService.synchronize().catch(console.error);
            }

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to mark table as pending:', error);
            alert('Nepodařilo se aktualizovat stůl');
        }
    };

    const handleSaveAssignments = async () => {
        try {
            await db.fieldTables.update(table.id!, {
                assignedWorkers: selectedWorkers,
                synced: 0
            });

            if (firebaseService.isReady) {
                firebaseService.synchronize().catch(console.error);
            }

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to save assignments:', error);
            alert('Nepodařilo se uložit přiřazení');
        }
    };

    const handleMarkAsDefect = async () => {
        try {
            soundService.playError();
            hapticService.error();
            await db.fieldTables.update(table.id!, {
                status: 'defect',
                defectNotes: defectNotes,
                photos: photos,
                synced: 0
            });

            if (firebaseService.isReady) {
                firebaseService.synchronize().catch(console.error);
            }

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to mark table as defect:', error);
            alert('Nepodařilo se nahlásit závadu');
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            // In a real app, we would upload to Firebase Storage
            // For now, we use FileReader to get a base64 for preview
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target?.result as string;
                const newPhotos = [...photos, base64];
                setPhotos(newPhotos);

                // Save immediately to DB
                await db.fieldTables.update(table.id!, { photos: newPhotos, synced: 0 });
                setIsUploading(false);
                if (firebaseService.isReady) firebaseService.synchronize();
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Photo upload failed:', error);
            setIsUploading(false);
        }
    };

    const handleRemovePhoto = async (index: number) => {
        const newPhotos = photos.filter((_, i) => i !== index);
        setPhotos(newPhotos);
        await db.fieldTables.update(table.id!, { photos: newPhotos, synced: 0 });
        if (firebaseService.isReady) firebaseService.synchronize();
    };

    const handleAddQuickTask = async () => {
        if (!currentUser?.workerId) return;
        soundService.playClick();
        hapticService.light();

        const taskData: Omit<ProjectTask, 'id'> = {
            projectId: table.projectId,
            taskType: quickTaskType,
            description: `${quickTaskType.toUpperCase()} - Stůl ${table.tableId}`,
            price: Number(quickTaskPrice),
            tableIds: [table.tableId],
            assignedWorkerId: currentUser.workerId,
        };

        const newId = Number(await db.projectTasks.add({ ...taskData, synced: 0 } as ProjectTask));
        if (firebaseService.isReady) {
            firebaseService.synchronize().catch(console.error);
        }
        setShowQuickTask(false);
    };

    const handleToggleTaskStatus = async (task: ProjectTask) => {
        soundService.playClick();
        hapticService.light();
        const newDate = task.completionDate ? undefined : new Date();
        await db.projectTasks.update(task.id!, { completionDate: newDate, synced: 0 });
        if (firebaseService.isReady) {
            firebaseService.synchronize().catch(console.error);
        }
    };

    const tableColor = completedWorker
        ? getWorkerColor(completedWorker.id!, completedWorker.color, workers)
        : '#f59e0b';

    const tableTypeLabels: Record<string, string> = {
        small: 'IT28 - Malý',
        medium: 'IT42 - Střední',
        large: 'IT56 - Velký',
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in overflow-hidden">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity" onClick={handleClose} />

            <div
                className={`relative w-full md:max-w-2xl bg-slate-900/95 backdrop-blur-2xl md:rounded-[3rem] rounded-t-[3rem] shadow-2xl border-t md:border border-white/20 max-h-[100dvh] md:max-h-[90dvh] flex flex-col overflow-hidden animate-slide-up transition-transform duration-200 modal-scroll ${isDragging ? 'scale-[0.98] translate-y-4' : ''}`}
                style={{ transform: isDragging && touchStart && touchCurrent ? `translateY(${Math.max(0, touchCurrent - touchStart)}px)` : undefined }}
            >

                {/* Drag Handle for Mobile including touch area */}
                <div
                    className="md:hidden w-full flex justify-center pt-4 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing pt-safe"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    <div className="w-12 h-1.5 bg-white/20 rounded-full" />
                </div>
                <div
                    className="p-8 border-b border-white/10 shrink-0"
                    style={{
                        background: `linear-gradient(135deg, ${tableColor}20 0%, transparent 100%)`,
                    }}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl border-2 border-white/20 shadow-lg"
                                    style={{ backgroundColor: tableColor }}
                                >
                                    {table.tableId}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">
                                        {t('table') || 'Stůl'} {table.tableId}
                                    </h2>
                                    <p className="text-gray-400 text-sm font-bold mt-1">
                                        {tableTypeLabels[table.tableType] || table.tableType}
                                    </p>
                                </div>
                            </div>

                            {/* Status badge */}
                            <div className="mt-4 flex gap-2">
                                {table.status === 'completed' ? (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-green-400 font-black text-xs uppercase tracking-widest">
                                            ✓ {t('completed') || 'Hotovo'}
                                        </span>
                                    </div>
                                ) : table.status === 'defect' ? (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/20 border border-rose-500/30 rounded-xl shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                                        <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                        <span className="text-rose-400 font-black text-xs uppercase tracking-widest">
                                            ⚠️ {t('defect') || 'Závada'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                        <span className="text-yellow-400 font-black text-xs uppercase tracking-widest">
                                            ⏳ {t('pending') || 'Čeká'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={() => { soundService.playClick(); hapticService.light(); handleClose(); }}
                            className="p-3 text-gray-400 hover:text-white transition-all bg-white/5 rounded-2xl hover:bg-white/10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto grow custom-scrollbar space-y-6">
                    {/* Completed info */}
                    {table.status === 'completed' && completedWorker && (
                        <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl">
                            <h3 className="text-xs font-black text-green-500 uppercase tracking-widest mb-4">
                                {t('completed_by') || 'Dokončil'}
                            </h3>
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm border-2 border-white/20"
                                    style={{ backgroundColor: getWorkerColor(completedWorker.id!, completedWorker.color, workers) }}
                                >
                                    {getInitials(completedWorker.name)}
                                </div>
                                <div className="flex-1">
                                    <div className="text-white font-bold text-lg">{completedWorker.name}</div>
                                    {table.completedAt && (
                                        <div className="text-gray-400 text-sm font-bold">
                                            {new Date(table.completedAt).toLocaleString('cs-CZ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Table Tasks Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                {t('tasks') || 'Úkoly u tohoto stolu'}
                            </h3>
                            <button
                                onClick={() => { setShowQuickTask(!showQuickTask); hapticService.light(); }}
                                className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors"
                            >
                                {showQuickTask ? t('cancel') : `+ ${t('add_task') || 'Přidat úkol'}`}
                            </button>
                        </div>

                        {showQuickTask && (
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3 animate-fade-in">
                                <div className="flex gap-2">
                                    {(['construction', 'panels', 'cables'] as const).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setQuickTaskType(type)}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${quickTaskType === type ? 'bg-white text-black' : 'bg-black/40 text-gray-500'}`}
                                        >
                                            {t(type as any) || type}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        value={quickTaskPrice}
                                        onChange={e => setQuickTaskPrice(e.target.value)}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2 text-white font-bold text-sm"
                                        placeholder="Cena (€)"
                                    />
                                    <button
                                        onClick={handleAddQuickTask}
                                        className="px-4 py-2 bg-blue-500 text-white font-black rounded-xl text-[10px] uppercase shadow-lg shadow-blue-500/20"
                                    >
                                        Přidat
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {tableTasks?.map(task => (
                                <div key={task.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${task.completionDate ? 'bg-emerald-500/5 border-emerald-500/10 opacity-70' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${task.taskType === 'construction' ? 'bg-amber-500' :
                                            task.taskType === 'panels' ? 'bg-blue-500' : 'bg-emerald-500'
                                            }`}>
                                            {task.taskType === 'construction' ? 'K' : task.taskType === 'panels' ? 'P' : 'C'}
                                        </div>
                                        <div>
                                            <div className={`text-sm font-bold ${task.completionDate ? 'text-gray-500 line-through' : 'text-white'}`}>{task.description}</div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">€{task.price} • {workers?.find(w => w.id === task.assignedWorkerId)?.name || 'Nepřiřazeno'}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleTaskStatus(task)}
                                        className={`p-2 rounded-lg transition-all ${task.completionDate ? 'text-emerald-500 bg-emerald-500/10' : 'text-gray-500 hover:text-white bg-white/5'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                    </button>
                                </div>
                            ))}
                            {(!tableTasks || tableTasks.length === 0) && !showQuickTask && (
                                <div className="text-center py-6 border-2 border-dashed border-white/5 rounded-2xl">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Žádné úkoly u tohoto stolu</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Defect Notes Section (Always visible or visible when defect status?) */}
                    {/* Let's make it visible so users can add notes even if it's pending */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest">
                            {t('defect_notes') || 'Poznámky k závadám'}
                        </h3>
                        <textarea
                            value={defectNotes}
                            onChange={(e) => setDefectNotes(e.target.value)}
                            placeholder={t('defect_placeholder') || 'Popište problém...'}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-bold text-sm focus:border-rose-500/50 transition-all outline-none min-h-[100px]"
                        />
                    </div>

                    {/* Photo Evidence Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">
                                {t('photo_evidence') || 'Foto-evidence'}
                            </h3>
                            <label className="cursor-pointer">
                                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={isUploading} />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors">
                                    {isUploading ? 'Nahrávám...' : `+ ${t('add_photo') || 'Přidat fotku'}`}
                                </span>
                            </label>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {photos.map((photo, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                                    <img src={photo} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => handleRemovePhoto(idx)}
                                        className="absolute top-1 right-1 bg-black/60 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            {photos.length === 0 && (
                                <div className="col-span-3 py-6 border-2 border-dashed border-white/5 rounded-2xl text-center">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Žádné fotografie</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                            {t('assigned_workers') || 'Přiřazení pracovníci'} (max 2)
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {workers?.map(worker => {
                                const isSelected = selectedWorkers.includes(worker.id!);
                                const workerColor = getWorkerColor(worker.id!, worker.color, workers);

                                return (
                                    <button
                                        key={worker.id}
                                        onClick={() => handleToggleWorker(worker.id!)}
                                        disabled={!isSelected && selectedWorkers.length >= 2}
                                        className={`flex items-center gap-4 p-4 rounded-xl transition-all ${isSelected
                                            ? 'bg-white/10 border-2 border-white/20'
                                            : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                                            } ${!isSelected && selectedWorkers.length >= 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm border-2 border-white/20"
                                            style={{ backgroundColor: workerColor }}
                                        >
                                            {getInitials(worker.name)}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-white font-bold">{worker.name}</div>
                                        </div>
                                        {isSelected && (
                                            <div className="text-green-500">
                                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 pb-12 md:pb-8 border-t border-white/10 bg-black/20 flex flex-col md:flex-row gap-3 shrink-0">
                    {table.status === 'pending' || table.status === 'defect' ? (
                        <>
                            <button
                                onClick={handleMarkAsDefect}
                                className="flex-1 px-6 py-4 bg-rose-500/10 text-rose-500 font-black rounded-2xl hover:bg-rose-500/20 transition-all border border-rose-500/20 uppercase tracking-widest text-[10px]"
                            >
                                ⚠️ {table.status === 'defect' ? 'Uložit poznámky' : 'Nahlásit závadu'}
                            </button>
                            <button
                                onClick={handleMarkAsCompleted}
                                className="flex-1 px-6 py-4 bg-green-500 text-white font-black rounded-2xl hover:bg-green-600 transition-all shadow-xl uppercase tracking-widest text-xs active:scale-95"
                            >
                                ✓ {t('mark_as_completed') || 'Označit jako hotový'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleMarkAsPending}
                            className="flex-1 px-6 py-4 bg-yellow-500 text-white font-black rounded-2xl hover:bg-yellow-600 transition-all shadow-xl uppercase tracking-widest text-xs active:scale-95"
                        >
                            ⏳ {t('mark_as_pending') || 'Vrátit do čekání'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TableModal;
