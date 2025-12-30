
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import TimeRecordForm from './TimeRecordForm';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { TimeRecord, ProjectTask, TableStatusHistory, Worker, Project, SolarTable } from '../types';
import ClockIcon from './icons/ClockIcon';
import BackButton from './BackButton';
import ConfirmationModal from './ConfirmationModal';
import { firebaseService } from '../services/firebaseService';
import { useToast } from '../contexts/ToastContext';

// A unified type for all activities in the feed
type ActivityItem = {
    id: string;
    type: 'record' | 'task' | 'table';
    date: Date;
    workerName: string;
    projectName: string;
    description: string;
    details: string;
    originalId: number; // The actual ID from DB
};

const TimeRecords: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Fetch all data types for the activity feed, filtering if not admin
    const records = useLiveQuery(async () => {
        if (user?.role === 'admin') return db.records.toArray();
        if (user?.workerId) return db.records.where('workerId').equals(user.workerId).toArray();
        return [];
    }, [user]);

    const tasks = useLiveQuery(async () => {
        if (user?.role === 'admin') return db.projectTasks.where('completionDate').above(new Date(0)).toArray();
        if (user?.workerId) return db.projectTasks.where('assignedWorkerId').equals(user.workerId).filter(t => !!t.completionDate).toArray();
        return [];
    }, [user]);

    const tableHistory = useLiveQuery(async () => {
        if (user?.role === 'admin') return db.tableStatusHistory.where('status').equals('completed').toArray();
        if (user?.workerId) return db.tableStatusHistory.where('workerId').equals(user.workerId).filter(h => h.status === 'completed').toArray();
        return [];
    }, [user]);

    const workers = useLiveQuery(() => db.workers.toArray(), [], []);
    const projects = useLiveQuery(() => db.projects.toArray(), [], []);
    const tables = useLiveQuery(() => db.solarTables.toArray(), [], []);

    const activityFeed = useMemo(() => {
        if (!records || !tasks || !tableHistory) return [];

        const workerMap = new Map<number, string>(
            workers.filter(w => w.id != null).map(w => [w.id!, w.name] as [number, string])
        );
        const projectMap = new Map<number, string>(
            projects.filter(p => p.id != null).map(p => [p.id!, p.name] as [number, string])
        );
        const tableMap = new Map<number, SolarTable>(
            tables.filter(t => t.id != null).map(t => [t.id!, t] as [number, SolarTable])
        );

        const feed: ActivityItem[] = [];

        // Process TimeRecords
        records.forEach(r => {
            const start = new Date(r.startTime);
            const end = new Date(r.endTime);
            const durationMs = end.getTime() - start.getTime();

            let details = 'N/A';
            if (!isNaN(durationMs) && durationMs >= 0) {
                const hours = Math.floor(durationMs / 3600000);
                const minutes = Math.floor((durationMs % 3600000) / 60000);
                details = `${hours}h ${minutes}m`;
            }

            feed.push({
                id: `rec-${r.id}`,
                type: 'record',
                date: start,
                workerName: workerMap.get(r.workerId) || t('unassigned'),
                projectName: projectMap.get(r.projectId) || 'Unknown Project',
                description: r.description || 'General Work',
                details: details,
                originalId: r.id!
            });
        });

        // Process ProjectTasks
        tasks.forEach(task => {
            if (task.completionDate && task.assignedWorkerId) {
                feed.push({
                    id: `task-${task.id}`,
                    type: 'task',
                    date: new Date(task.completionDate),
                    workerName: workerMap.get(task.assignedWorkerId) || t('unassigned'),
                    projectName: projectMap.get(task.projectId) || 'Unknown Project',
                    description: task.description,
                    details: `€${task.price.toFixed(2)}`,
                    originalId: task.id!
                });
            }
        });

        // Process TableStatusHistory
        tableHistory.forEach(h => {
            const table = tableMap.get(h.tableId);
            if (table) {
                feed.push({
                    id: `table-${h.id}`,
                    type: 'table',
                    date: new Date(h.timestamp),
                    workerName: workerMap.get(h.workerId) || t('unassigned'),
                    projectName: projectMap.get(table.projectId) || 'Unknown Project',
                    description: t('completed_table_summary', { code: table.tableCode }),
                    details: t(table.tableType),
                    originalId: h.id!
                });
            }
        });

        return feed.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [records, tasks, tableHistory, workers, projects, tables, t]);

    const handleEdit = async (item: ActivityItem) => {
        if (item.type !== 'record') return;
        const record = await db.records.get(item.originalId);
        if (record) {
            setEditingRecord(record);
        }
    };

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            await db.records.delete(deletingId);
            if (firebaseService.isReady) {
                firebaseService.deleteRecords('timeRecords', [String(deletingId)])
                    .catch(console.error);
            }
            showToast(t('deleted_successfully') || 'Smazáno', 'success');
        } catch (error) {
            console.error("Failed to delete record:", error);
            showToast(t('delete_error') || 'Chyba při mazání', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-5xl font-bold text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.5)]">{t('work_log')}</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg text-lg transform hover:scale-105 flex items-center gap-2"
                >
                    <ClockIcon className="w-6 h-6" />
                    {t('add_record')}
                </button>
            </div>

            <div className="space-y-4">
                {activityFeed.length > 0 ? activityFeed.map(item => (
                    <div key={item.id} className="group p-6 bg-slate-900/40 backdrop-blur-3xl rounded-[2rem] border border-white/5 shadow-2xl hover:bg-slate-800/40 transition-all duration-500">
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${item.type === 'record' ? 'bg-blue-500/20 text-blue-400' :
                                    item.type === 'task' ? 'bg-amber-500/20 text-amber-500' :
                                        'bg-emerald-500/20 text-emerald-500'
                                    }`}>
                                    {item.type === 'record' ? <ClockIcon className="w-6 h-6" /> :
                                        item.type === 'task' ? <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> :
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                </div>
                                <div>
                                    <p className="text-xl font-black text-white italic uppercase tracking-tight leading-tight">{item.description}</p>
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
                                        {item.workerName} • <span className="text-indigo-400">{item.projectName}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg text-white">{item.details}</p>
                                <p className="text-sm text-gray-400">{item.date.toLocaleString()}</p>

                                {item.type === 'record' && (
                                    <div className="flex gap-2 mt-3 justify-end transition-opacity">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-all active:scale-95 border border-blue-500/20"
                                            title={t('edit') || 'Upravit'}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => setDeletingId(item.originalId)}
                                            className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20"
                                            title={t('delete') || 'Smazat'}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-12 text-gray-300 text-lg bg-slate-900/30 rounded-2xl border border-white/5">
                        {t('no_data')}
                    </div>
                )}
            </div>

            {(showForm || editingRecord) && (
                <TimeRecordForm
                    editRecord={editingRecord || undefined}
                    onClose={() => { setShowForm(false); setEditingRecord(null); }}
                />
            )}

            {deletingId && (
                <ConfirmationModal
                    title={t('delete_record_title') || 'Smazat záznam?'}
                    message={t('confirm_delete') || 'Opravdu chcete tento záznam smazat?'}
                    onConfirm={handleDelete}
                    onCancel={() => setDeletingId(null)}
                    variant="danger"
                />
            )}
        </div>
    );
};

export default TimeRecords;
