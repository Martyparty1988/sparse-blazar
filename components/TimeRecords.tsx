
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
        <div className="space-y-12 pb-24 max-w-5xl mx-auto p-6 md:p-8">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <div className="space-y-2 relative z-10">
                    <h1 className="text-7xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.8]">
                        Pracovní<br /><span className="text-indigo-500">Log.</span>
                    </h1>
                    <div className="h-2 w-32 bg-indigo-600 rounded-full shadow-[0_4px_20px_rgba(79,70,229,0.5)] mt-4" />
                </div>

                <button
                    onClick={() => setShowForm(true)}
                    className="group relative overflow-hidden px-8 py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-[2rem] hover:bg-emerald-400 hover:text-black transition-all shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)] active:scale-95 flex items-center gap-3"
                >
                    <div className="absolute inset-0 bg-emerald-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <ClockIcon className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">{t('add_record')}</span>
                </button>
            </header>

            <div className="space-y-6 relative z-10">
                {/* Decorative Background for List */}
                <div className="absolute -top-20 -right-20 w-96 h-96 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

                {activityFeed.length > 0 ? activityFeed.map((item, idx) => (
                    <div
                        key={item.id}
                        className="group glass-dark p-8 rounded-[2.5rem] border border-white/5 hover:border-indigo-500/30 transition-all duration-500 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-4 relative overflow-hidden"
                        style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                        <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
                            <div className="flex gap-6 items-start">
                                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-lg border border-white/5 ${item.type === 'record' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white' :
                                        item.type === 'task' ? 'bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white' :
                                            'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white'
                                    } transition-all duration-500`}>
                                    {item.type === 'record' ? <ClockIcon className="w-7 h-7" /> :
                                        item.type === 'task' ? <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> :
                                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                </div>
                                <div className="space-y-2">
                                    <p className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-indigo-200 transition-colors">{item.description}</p>
                                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        <span>{item.workerName}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                                        <span className="text-indigo-400">{item.projectName}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-row md:flex-col justify-between items-center md:items-end w-full md:w-auto gap-4 pl-22 md:pl-0">
                                <div className="text-right">
                                    <p className="font-mono text-xl font-bold text-white">{item.details}</p>
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>

                                {item.type === 'record' && (
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 hover:border-transparent cursor-pointer"
                                            title={t('edit') || 'Upravit'}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </button>
                                        <button
                                            onClick={() => setDeletingId(item.originalId)}
                                            className="w-10 h-10 flex items-center justify-center bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20 hover:border-transparent cursor-pointer"
                                            title={t('delete') || 'Smazat'}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="glass-dark border border-white/5 rounded-[3rem] p-16 text-center animate-fade-in opacity-60">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <ClockIcon className="w-8 h-8 text-slate-500" />
                        </div>
                        <p className="text-2xl font-black text-slate-500 uppercase italic tracking-widest">{t('no_data')}</p>
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
