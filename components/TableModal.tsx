
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { FieldTable, Worker } from '../types';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';

interface TableModalProps {
    table: FieldTable;
    onClose: () => void;
    onUpdate?: () => void;
}

const TableModal: React.FC<TableModalProps> = ({ table, onClose, onUpdate }) => {
    const { t } = useI18n();
    const { currentUser } = useAuth();
    const [selectedWorkers, setSelectedWorkers] = useState<number[]>(table.assignedWorkers || []);

    const workers = useLiveQuery(() => db.workers.toArray());
    const project = useLiveQuery(() => db.projects.get(table.projectId));

    const completedWorker = table.completedBy
        ? workers?.find(w => w.id === table.completedBy)
        : null;

    const handleToggleWorker = (workerId: number) => {
        setSelectedWorkers(prev => {
            if (prev.includes(workerId)) {
                return prev.filter(id => id !== workerId);
            } else if (prev.length < 2) {
                return [...prev, workerId];
            } else {
                // Replace first worker
                return [prev[1], workerId];
            }
        });
    };

    const handleMarkAsCompleted = async () => {
        if (!currentUser?.workerId) {
            alert(t('login_required') || 'Musíte být přihlášeni');
            return;
        }

        try {
            await db.fieldTables.update(table.id!, {
                status: 'completed',
                completedAt: new Date(),
                completedBy: currentUser.workerId,
            });

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to mark table as completed:', error);
            alert(t('update_failed') || 'Nepodařilo se aktualizovat stůl');
        }
    };

    const handleMarkAsPending = async () => {
        try {
            await db.fieldTables.update(table.id!, {
                status: 'pending',
                completedAt: undefined,
                completedBy: undefined,
            });

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to mark table as pending:', error);
            alert(t('update_failed') || 'Nepodařilo se aktualizovat stůl');
        }
    };

    const handleSaveAssignments = async () => {
        try {
            await db.fieldTables.update(table.id!, {
                assignedWorkers: selectedWorkers,
            });

            onUpdate?.();
            onClose();
        } catch (error) {
            console.error('Failed to save assignments:', error);
            alert(t('update_failed') || 'Nepodařilo se uložit přiřazení');
        }
    };

    const tableColor = completedWorker
        ? getWorkerColor(completedWorker.id!, completedWorker.color, workers)
        : '#f59e0b';

    const tableTypeLabels = {
        small: 'IT28 - Malý',
        medium: 'IT42 - Střední',
        large: 'IT56 - Velký',
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full md:max-w-2xl bg-slate-900/95 backdrop-blur-2xl md:rounded-[3rem] rounded-t-[3rem] shadow-2xl border-t md:border border-white/20 max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                {/* Header */}
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
                                        {tableTypeLabels[table.tableType]}
                                    </p>
                                </div>
                            </div>

                            {/* Status badge */}
                            <div className="mt-4">
                                {table.status === 'completed' ? (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-green-400 font-black text-xs uppercase tracking-widest">
                                            ✓ {t('completed') || 'Hotovo'}
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
                            onClick={onClose}
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

                    {/* Assigned workers */}
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
                    {table.status === 'pending' ? (
                        <>
                            <button
                                onClick={handleSaveAssignments}
                                className="flex-1 px-6 py-4 bg-white/10 text-white font-black rounded-2xl hover:bg-white/20 transition-all uppercase tracking-widest text-xs"
                            >
                                {t('save_assignments') || 'Uložit přiřazení'}
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
